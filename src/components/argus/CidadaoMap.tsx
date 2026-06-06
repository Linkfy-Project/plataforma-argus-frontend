import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { WorkRead } from "@/types";

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

interface CidadaoMapProps {
  works: WorkRead[];
  className?: string;
  height?: string;
  /** Se informado, centraliza o mapa nas obras filtradas pela busca */
  filteredIds?: Set<number>;
  /** Callback disparado ao clicar em "Ver detalhes" */
  onViewDetails?: (workId: number) => void;
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
      <a href="/cidadao/obras/${w.id}" style="display:block;font-size:12px;color:#2563eb;text-decoration:none;font-weight:500;">
        Ver detalhes →
      </a>
    </div>
  `;
}

/* ─── Componente principal ─────────────────────────────────────────── */

export function CidadaoMap({
  works,
  className,
  height = "500px",
  filteredIds,
  onViewDetails,
}: CidadaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const initRef = useRef(false);

  // Obras com coordenadas válidas
  const geoWorks = useMemo(
    () =>
      works.filter(
        (w) =>
          w.latitude != null &&
          w.longitude != null &&
          w.latitude !== 0 &&
          w.longitude !== 0,
      ),
    [works],
  );

  // Inicializa o mapa uma única vez
  useEffect(() => {
    if (!mapRef.current || initRef.current) return;
    initRef.current = true;

    const map = L.map(mapRef.current, {
      center: [-22.37, -41.76],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: true,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      initRef.current = false;
    };
  }, []);

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
    const visible = filteredIds
      ? geoWorks.filter((w) => filteredIds.has(w.id))
      : geoWorks;

    for (const w of visible) {
      const semaforo = getSemaforo(w.efficiency_score);
      const colors = SEMAFORO_COLORS[semaforo];

      // Tamanho baseado no valor do contrato
      const value = w.contract_value ?? 0;
      const radius = value > 5_000_000 ? 8 : value > 1_000_000 ? 6 : 4;

      const circle = L.circleMarker([w.latitude!, w.longitude!], {
        radius,
        fillColor: colors.fill,
        fillOpacity: 0.85,
        color: "#ffffff",
        weight: 1.5,
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
    if (visible.length > 0) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.1));
    }
  }, [geoWorks, filteredIds, onViewDetails]);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className={className}
        style={{ height, width: "100%", borderRadius: "12px", zIndex: 0 }}
      />

      {/* Legenda do semáforo */}
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
