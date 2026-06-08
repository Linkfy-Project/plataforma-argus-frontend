import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { WorkRead } from "@/types";
import type { GeoLayerData } from "@/components/argus/ArgusMap";

// Fix default marker icons in Leaflet + webpack/vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ─── Semáforo: cores amigáveis ────────────────────────────────────── */

type Semaforo = "green" | "yellow" | "red" | "gray";

function getSemaforo(score: number | null | undefined): Semaforo {
  if (score == null) return "gray";
  if (score >= 60) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

const SEMAFORO_COLORS: Record<Semaforo, { fill: string; border: string }> = {
  green: { fill: "#22C55E", border: "#16A34A" },
  yellow: { fill: "#F59E0B", border: "#D97706" },
  red: { fill: "#DC2626", border: "#B91C1C" },
  gray: { fill: "#94A3B8", border: "#64748B" },
};

const SEMAFORO_LABELS: Record<Semaforo, { label: string; desc: string }> = {
  green: { label: "Em dia", desc: "Obra ocorrendo sem alertas críticos" },
  yellow: { label: "Atenção", desc: "Pequenos atrasos ou aditivos" },
  red: { label: "Problema / Paralisada", desc: "Risco alto, embargos ou estouro de prazo" },
  gray: { label: "Sem avaliação", desc: "Ainda não foi possível avaliar" },
};

/* ─── Interface ────────────────────────────────────────────────────── */

/** Alvo de flyTo para busca geocodificada */
export interface FlyToTarget {
  lat: number;
  lng: number;
  zoom?: number;
}

interface CidadaoMapProps {
  works: WorkRead[];
  layers?: GeoLayerData[];
  className?: string;
  height?: string;
  /** Se informado, centraliza o mapa nas obras filtradas pela busca */
  filteredIds?: Set<number>;
  /** Callback disparado ao clicar em "Ver detalhes" */
  onViewDetails?: (workId: number) => void;
  /** Se informado, executa flyTo para as coordenadas especificadas */
  flyToTarget?: FlyToTarget;
}

/* ─── Popup helper (versão cidadã) ─────────────────────────────────── */

function buildPopupContent(w: WorkRead): string {
  const value =
    w.contract_value != null
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        }).format(w.contract_value)
      : "—";
  const semaforo = getSemaforo(w.efficiency_score);
  const { label, desc } = SEMAFORO_LABELS[semaforo];
  const color = SEMAFORO_COLORS[semaforo];
  const overlap =
    w.territorial_overlap_ratio != null
      ? `${Math.round(w.territorial_overlap_ratio * 100)}%`
      : null;

  return `
    <div style="min-width:220px;max-width:280px;font-family:system-ui,sans-serif;">
      <h4 style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">
        ${(w.object_description || `Obra #${w.id}`).substring(0, 60)}
      </h4>
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;">
        ${w.neighborhood || w.municipio || "—"}
      </p>
      <div style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:${color.fill}20;color:${color.border};margin-bottom:8px;">
        ● ${label}
      </div>
      <p style="margin:0 0 2px;font-size:11px;color:#475569;">
        <strong>Investimento:</strong> ${value}
      </p>
      <p style="margin:0 0 8px;font-size:10px;color:#94a3b8;">
        ${desc}
      </p>
      ${
        overlap
          ? `<p style="margin:0 0 4px;font-size:11px;color:#475569;">
              <strong>Sobreposição territorial:</strong>
              <span style="color:${w.territorial_overlap_ratio! > 0.5 ? "#ea580c" : "#64748b"};font-weight:600;">${overlap}</span>
            </p>`
          : ""
      }
      <a href="/cidadao/obras/${w.id}" style="display:block;font-size:12px;color:#2563eb;text-decoration:none;font-weight:500;">
        Ver detalhes →
      </a>
    </div>
  `;
}

/* ─── Componente principal ─────────────────────────────────────────── */

export function CidadaoMap({
  works,
  layers = [],
  className,
  height = "500px",
  filteredIds,
  onViewDetails,
  flyToTarget,
}: CidadaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const layerGroupsRef = useRef<Record<string, L.GeoJSON>>({});
  const initRef = useRef(false);

  // Track which geo layers are visible
  const [activeKeys, setActiveKeys] = useState<Set<string>>(
    () => new Set(layers.filter((l) => l.defaultActive !== false).map((l) => l.key)),
  );

  // Obras com coordenadas válidas
  const geoWorks = useMemo(
    () =>
      works.filter(
        (w) => w.latitude != null && w.longitude != null && w.latitude !== 0 && w.longitude !== 0,
      ),
    [works],
  );

  // Inicializa o mapa + camadas geo uma única vez
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

    // Cria um pane customizado para marcadores com z-index alto (acima das camadas geo)
    map.createPane("markersPane");
    const markersPane = map.getPane("markersPane")!;
    markersPane.style.zIndex = "650";

    mapInstanceRef.current = map;

    // Adiciona camadas geo (apenas as defaultActive são adicionadas ao mapa)
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
          if ((name || code) && name !== "nan") {
            layer.bindTooltip(`${name || ""}${name && code ? " · " : ""}${code || ""}`, {
              sticky: true,
              className: "argus-layer-tooltip",
            });
          }
        },
      });
      // Só adiciona ao mapa se defaultActive
      if (layerData.defaultActive !== false) {
        geoJsonLayer.addTo(map);
      }
      layerGroupsRef.current[layerData.key] = geoJsonLayer;
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupsRef.current = {};
      initRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza camadas geo quando layers mudam
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !initRef.current) return;

    // Remove camadas geo antigas
    for (const lg of Object.values(layerGroupsRef.current)) {
      map.removeLayer(lg);
    }
    layerGroupsRef.current = {};

    // Adiciona novas camadas geo
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
          if ((name || code) && name !== "nan") {
            layer.bindTooltip(`${name || ""}${name && code ? " · " : ""}${code || ""}`, {
              sticky: true,
              className: "argus-layer-tooltip",
            });
          }
        },
      });
      if (layerData.defaultActive !== false) {
        geoJsonLayer.addTo(map);
      }
      layerGroupsRef.current[layerData.key] = geoJsonLayer;
    }

    setActiveKeys(new Set(layers.filter((l) => l.defaultActive !== false).map((l) => l.key)));
  }, [layers]);

  // Atualiza marcadores quando works/filteredIds mudam
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove marcadores antigos
    for (const m of markersRef.current) {
      map.removeLayer(m);
    }
    markersRef.current = [];

    if (geoWorks.length === 0) return;

    const markers: L.CircleMarker[] = [];
    const visible = filteredIds ? geoWorks.filter((w) => filteredIds.has(w.id)) : geoWorks;

    for (const w of visible) {
      const semaforo = getSemaforo(w.efficiency_score);
      const colors = SEMAFORO_COLORS[semaforo];

      // Tamanho baseado no valor do contrato
      const value = w.contract_value ?? 0;
      const radius = value > 5_000_000 ? 8 : value > 1_000_000 ? 6 : 4;

      // Buffer de sobreposição territorial (500m) para obras com alta sobreposição
      if (w.territorial_overlap_ratio != null && w.territorial_overlap_ratio > 0.5) {
        L.circle([w.latitude!, w.longitude!], {
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
      }

      const circle = L.circleMarker([w.latitude!, w.longitude!], {
        radius,
        fillColor: colors.fill,
        fillOpacity: 0.85,
        color: "#ffffff",
        weight: 1.5,
        pane: "markersPane",
      }).addTo(map);

      circle.bindPopup(buildPopupContent(w), { maxWidth: 300 });

      if (onViewDetails) {
        circle.on("popupopen", () => {
          // O popup já tem link para /cidadao/obras/{id}
        });
      }

      markers.push(circle);
    }

    markersRef.current = markers;

    // Ajusta zoom para mostrar todos os marcadores visíveis
    // MAS pula o fitBounds se o usuário fez uma busca geocodificada (flyToTarget),
    // senão o fitBounds sobrescreve a posição pesquisada pelo usuário.
    if (visible.length > 0 && !flyToTarget) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.1));
    }
  }, [geoWorks, filteredIds, onViewDetails, flyToTarget]);

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

      {/* Painel de camadas (igual ao gestor) */}
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

      {/* Legenda do semáforo (versão cidadã) */}
      <div className="absolute left-3 bottom-3 z-[1000] flex flex-wrap gap-2 rounded-lg border border-border bg-card/95 p-2.5 shadow-md backdrop-blur-sm">
        {(Object.entries(SEMAFORO_LABELS) as [Semaforo, typeof SEMAFORO_LABELS.green][]).map(
          ([key, val]) => {
            const color = SEMAFORO_COLORS[key];
            return (
              <span
                key={key}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: color.fill }}
                />
                {val.label}
              </span>
            );
          },
        )}
      </div>
    </div>
  );
}
