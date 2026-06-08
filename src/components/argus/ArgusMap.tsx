import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { WorkRead } from "@/types";
import { getScoreHex } from "@/lib/score";
import { fmtBRL } from "@/lib/format";

// Fix default marker icons in Leaflet + webpack/vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface GeoLayerData {
  key: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geojson: any;
  color: string;
  fillOpacity?: number;
  weight?: number;
  /** Se false, a camada começa oculta (padrão: true). */
  defaultActive?: boolean;
}

/** Alvo de flyTo para busca geocodificada */
export interface FlyToTarget {
  lat: number;
  lng: number;
  zoom?: number;
}

interface ArgusMapProps {
  works: WorkRead[];
  layers?: GeoLayerData[];
  className?: string;
  height?: string;
  /** Se informado, executa flyTo para as coordenadas especificadas */
  flyToTarget?: FlyToTarget;
}

/* ─── Status badge color helper ─────────────────────────────────────── */

function getStatusColor(status?: string | null): { bg: string; text: string } {
  const s = (status || "").toLowerCase();
  if (s.includes("conclu")) return { bg: "#dcfce7", text: "#166534" };
  if (s.includes("andamento")) return { bg: "#dbeafe", text: "#1e40af" };
  if (s.includes("atrasad")) return { bg: "#fee2e2", text: "#991b1b" };
  if (s.includes("paralisad")) return { bg: "#fef3c7", text: "#92400e" };
  if (s.includes("planejad")) return { bg: "#f3e8ff", text: "#6b21a8" };
  return { bg: "#f1f5f9", text: "#475569" };
}

/* ─── Popup helper ──────────────────────────────────────────────────── */

function buildPopupContent(w: WorkRead): string {
  const score = w.efficiency_score != null ? Math.round(w.efficiency_score) : "—";
  const riskDelay =
    w.risk_delay_probability != null ? `${Math.round(w.risk_delay_probability * 100)}%` : "—";
  const riskCost =
    w.risk_cost_probability != null ? `${Math.round(w.risk_cost_probability * 100)}%` : "—";
  const riskRework =
    w.risk_rework_probability != null ? `${Math.round(w.risk_rework_probability * 100)}%` : "—";
  const value = w.contract_value != null ? fmtBRL(w.contract_value) : "—";
  const statusStyle = getStatusColor(w.status);
  const alertCount = w.alerts?.length ?? 0;
  const overlap =
    w.territorial_overlap_ratio != null
      ? `${Math.round(w.territorial_overlap_ratio * 100)}%`
      : null;
  // Verifica se algum alerta possui agravante social (severity_multiplier > 1 = IDH < 0.600)
  const hasAgravanteSocial = (w.alerts ?? []).some((a) => a.severity_multiplier > 1);

  return `
    <div style="min-width:240px;max-width:300px;font-family:system-ui,sans-serif;">
      <h4 style="margin:0 0 6px;font-size:13px;font-weight:600;color:#1e3a8a;">
        ${(w.object_description || `Obra #${w.id}`).substring(0, 60)}
      </h4>
      <div style="font-size:11px;color:#64748b;margin-bottom:8px;">
        ${w.municipio || "—"} · ${w.contractor_name || "Contratado não informado"}
      </div>
      ${w.status ? `<div style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${statusStyle.bg};color:${statusStyle.text};margin-bottom:8px;">${w.status}</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:11px;">
        <div><strong>Score:</strong> <span style="color:${getScoreHex(w.efficiency_score)};font-weight:700;">${score}</span></div>
        <div><strong>Valor:</strong> ${value}</div>
        <div><strong>Risco Atraso:</strong> ${riskDelay}</div>
        <div><strong>Risco Custo:</strong> ${riskCost}</div>
        <div><strong>Risco Retrabalho:</strong> ${riskRework}</div>
        <div>
          <strong>Alertas:</strong>
          <span style="color:${alertCount > 0 ? "#dc2626" : "#16a34a"};font-weight:700;">
            ${alertCount}
          </span>
        </div>
        ${overlap ? `<div><strong>Sobreposição:</strong> <span style="color:${w.territorial_overlap_ratio! > 0.5 ? "#ea580c" : "#64748b"};font-weight:600;">${overlap}</span></div>` : ""}
      </div>
      ${hasAgravanteSocial ? `<div style="margin-top:6px;padding:3px 8px;border-radius:9999px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);font-size:10px;font-weight:600;color:#dc2626;display:inline-block;">⚠ Agravante Social (IDH < 0.600)</div>` : ""}
      <a href="/obras/${w.id}" style="display:block;margin-top:8px;font-size:11px;color:#2563eb;text-decoration:none;">
        Ver detalhes →
      </a>
    </div>
  `;
}

function getMarkerRadius(work: WorkRead): number {
  const value = work.contract_value ?? 0;
  if (value > 5_000_000) return 8;
  if (value > 1_000_000) return 6;
  return 4;
}

/* ─── Main map component ────────────────────────────────────────────── */

export function ArgusMap({
  works,
  layers = [],
  className,
  height = "500px",
  flyToTarget,
}: ArgusMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const layerGroupsRef = useRef<Record<string, L.GeoJSON>>({});
  const initRef = useRef(false);

  // Track which layers are visible (defaultActive layers only)
  const [activeKeys, setActiveKeys] = useState<Set<string>>(
    () => new Set(layers.filter((l) => l.defaultActive !== false).map((l) => l.key)),
  );

  // Initialize map + layers + markers once
  useEffect(() => {
    if (!mapRef.current || initRef.current) return;
    initRef.current = true;

    const map = L.map(mapRef.current, {
      center: [-22.37, -41.76],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Create a custom pane for markers with high z-index (above geo layers)
    map.createPane("markersPane");
    const markersPane = map.getPane("markersPane")!;
    markersPane.style.zIndex = "650";

    mapInstanceRef.current = map;

    // Add geo layers (only defaultActive ones are added to map)
    for (const layerData of layers) {
      const geoJsonLayer = L.geoJSON(layerData.geojson, {
        style: () => ({
          color: layerData.color,
          weight: layerData.weight ?? 2,
          opacity: 0.8,
          fillColor: layerData.color,
          fillOpacity: layerData.fillOpacity ?? 0.15,
        }),
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name;
          const code = feature.properties?.code;
          if (name || (code && name !== "nan")) {
            layer.bindTooltip(`${name || ""}${name && code ? " · " : ""}${code || ""}`, {
              sticky: true,
              className: "argus-layer-tooltip",
            });
          }
        },
      });
      // Only add to map if defaultActive
      if (layerData.defaultActive !== false) {
        geoJsonLayer.addTo(map);
      }
      layerGroupsRef.current[layerData.key] = geoJsonLayer;
    }

    // Add work markers and overlap buffers
    const geoWorks = works.filter(
      (w) => w.latitude != null && w.longitude != null && w.latitude !== 0 && w.longitude !== 0,
    );

    if (geoWorks.length > 0) {
      const markers: L.CircleMarker[] = [];
      const overlapCircles: L.Circle[] = [];
      for (const w of geoWorks) {
        const color = getScoreHex(w.efficiency_score);
        const radius = getMarkerRadius(w);

        // Draw overlap buffer circle (500m) for high-overlap works
        if (w.territorial_overlap_ratio != null && w.territorial_overlap_ratio > 0.5) {
          const buffer = L.circle([w.latitude!, w.longitude!], {
            radius: 500,
            color: "#f97316",
            weight: 1.5,
            fillColor: "#f97316",
            fillOpacity: 0.15,
            dashArray: "6 4",
            pane: "markersPane",
          })
            .bindTooltip(
              `Sobreposição territorial: ${Math.round(w.territorial_overlap_ratio * 100)}% — Buffer 500m`,
              { sticky: true, className: "argus-layer-tooltip" },
            )
            .addTo(map);
          overlapCircles.push(buffer);
        }

        const circle = L.circleMarker([w.latitude!, w.longitude!], {
          radius,
          fillColor: color,
          fillOpacity: 0.85,
          color: "#ffffff",
          weight: 1.5,
          pane: "markersPane",
        })
          .bindPopup(buildPopupContent(w), { maxWidth: 300 })
          .addTo(map);
        markers.push(circle);
      }
      markersRef.current = markers;
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.1));
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      initRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Executa flyTo quando flyToTarget muda (busca geocodificada)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !flyToTarget) return;
    map.flyTo([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom ?? 16, {
      duration: 1.5,
    });
  }, [flyToTarget]);

  // Toggle a geo layer on/off
  const toggleLayer = useCallback((key: string) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setActiveKeys((prev) => {
      const next = new Set(prev);
      const lg = layerGroupsRef.current[key];
      if (!lg) return prev;

      if (next.has(key)) {
        map.removeLayer(lg);
        next.delete(key);
      } else {
        lg.addTo(map);
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className={className}
        style={{ height, width: "100%", borderRadius: "12px", zIndex: 0 }}
      />

      {/* Layer toggle panel */}
      {layers.length > 0 && (
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5 rounded-lg border border-border bg-card/95 p-2.5 shadow-md backdrop-blur-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Camadas
          </span>
          {layers.map((l) => {
            const isActive = activeKeys.has(l.key);
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => toggleLayer(l.key)}
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{
                    backgroundColor: isActive ? l.color : "transparent",
                    borderColor: l.color,
                  }}
                />
                {l.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Legend component showing risk level colors on the map.
 */
export function MapLegend() {
  const levels = [
    { label: "Baixo risco (≥80)", color: "#22C55E" },
    { label: "Atenção (60–79)", color: "#F59E0B" },
    { label: "Alto risco (40–59)", color: "#F97316" },
    { label: "Crítico (<40)", color: "#DC2626" },
    { label: "Sem score", color: "#94A3B8" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {levels.map((l) => (
        <span key={l.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: l.color }}
          />
          {l.label}
        </span>
      ))}
    </div>
  );
}
