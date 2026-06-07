import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { Map as MapIcon, MapPin, Layers, Eye } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
const ArgusMap = lazy(() => import("@/components/argus/ArgusMap").then(m => ({ default: m.ArgusMap })));
const MapLegend = lazy(() => import("@/components/argus/ArgusMap").then(m => ({ default: m.MapLegend })));
import type { GeoLayerData } from "@/components/argus/ArgusMap";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { analyticsService, worksService, geoService } from "@/lib/api";
import { getRiskLevel } from "@/lib/score";

export const Route = createFileRoute("/_app/mapa")({
  head: () => ({ meta: [{ title: "Mapa Territorial — Plataforma Argus" }] }),
  component: MapaPage,
});

/* ─── Layer definitions ──────────────────────────────────────────────── */

const LAYER_DEFS: { key: string; label: string; layerType: "municipality" | "census_tract" | "road"; color: string; fillOpacity: number; weight: number; defaultActive?: boolean }[] = [
  { key: "municipality", label: "Município", layerType: "municipality", color: "#1e3a8a", fillOpacity: 0.08, weight: 3 },
  { key: "census_tract", label: "Setores censitários", layerType: "census_tract", color: "#6366f1", fillOpacity: 0.1, weight: 1.5 },
  { key: "road", label: "Malha viária", layerType: "road", color: "#f97316", fillOpacity: 0, weight: 2, defaultActive: false },
];

function MapaPage() {
  const works = useQuery({
    queryKey: ["mapa", "works"],
    queryFn: () => worksService.listAll({}),
  });

  // Fetch all geo layers in parallel
  const municipalityLayer = useQuery({
    queryKey: ["geo-layers", "municipality"],
    queryFn: () => geoService.layer("municipality"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const censusTractLayer = useQuery({
    queryKey: ["geo-layers", "census_tract"],
    queryFn: () => geoService.layer("census_tract"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const roadLayer = useQuery({
    queryKey: ["geo-layers", "road"],
    queryFn: () => geoService.layer("road"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const layerQueries = useMemo(() => ({
    municipality: municipalityLayer.data,
    census_tract: censusTractLayer.data,
    road: roadLayer.data,
  }), [municipalityLayer.data, censusTractLayer.data, roadLayer.data]);

  const geoLayers = useMemo<GeoLayerData[]>(() => {
    return LAYER_DEFS
      .filter((def) => {
        const data = layerQueries[def.layerType];
        return data && data.features && data.features.length > 0;
      })
      .map((def) => ({
        key: def.key,
        label: def.label,
        geojson: layerQueries[def.layerType]! as unknown as GeoJSON.FeatureCollection,
        color: def.color,
        fillOpacity: def.fillOpacity,
        weight: def.weight,
        defaultActive: def.defaultActive,
      }));
  }, [layerQueries]);

  if (works.isLoading) return <LoadingState rows={6} />;
  if (works.isError) return <ErrorState onRetry={() => works.refetch()} />;

  const allWorks = works.data ?? [];
  const georeferenciadas = allWorks.filter(
    (w) => w.latitude != null && w.longitude != null && w.latitude !== 0 && w.longitude !== 0,
  );

  const riskSummary = {
    Eficiente: georeferenciadas.filter((w) => getRiskLevel(w.efficiency_score) === "Eficiente").length,
    Atenção: georeferenciadas.filter((w) => getRiskLevel(w.efficiency_score) === "Atenção").length,
    "Alto risco": georeferenciadas.filter((w) => getRiskLevel(w.efficiency_score) === "Alto risco").length,
    Crítico: georeferenciadas.filter((w) => getRiskLevel(w.efficiency_score) === "Crítico").length,
  };

  return (
    <div>
      <PageHeader
        title="Mapa Interativo"
        description="Distribuição geoespacial das obras públicas monitoradas com indicadores de risco em tempo real."
        actions={
          <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <Layers className="h-3.5 w-3.5 text-primary" />
            {georeferenciadas.length} obras georreferenciadas de {allWorks.length} totais
            {geoLayers.length > 0 && ` · ${geoLayers.length} camada(s) disponível(is)`}
          </div>
        }
      />

      {/* Mapa interativo */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapIcon className="h-4 w-4 text-primary" />
            Mapa de Obras — Macaé, RJ
          </div>
          <Suspense fallback={null}><MapLegend /></Suspense>
        </div>

        {georeferenciadas.length === 0 ? (
          <EmptyState
            message="Nenhuma obra com coordenadas disponíveis."
            hint="As coordenadas são extraídas durante o processo ETL. Execute uma sincronização para popular os dados geoespaciais."
          />
        ) : (
          <Suspense fallback={<div className="flex h-[520px] items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">Carregando mapa...</div>}>
            <ArgusMap works={georeferenciadas} layers={geoLayers} height="520px" />
          </Suspense>
        )}
      </div>

      {/* Resumo por risco + lista lateral */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Resumo por risco no mapa</h3>
          <div className="space-y-3">
            {(["Eficiente", "Atenção", "Alto risco", "Crítico"] as const).map((level) => {
              const count = riskSummary[level];
              const pct = georeferenciadas.length > 0 ? Math.round((count / georeferenciadas.length) * 100) : 0;
              const colors: Record<string, string> = {
                Eficiente: "bg-[color:var(--success)]",
                Atenção: "bg-[color:var(--warning)]",
                "Alto risco": "bg-orange-500",
                Crítico: "bg-destructive",
              };
              return (
                <div key={level} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${colors[level]}`} />
                    <span className="text-sm text-foreground">{level}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${colors[level]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs text-muted-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Geo layer status */}
          {geoLayers.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Camadas geoespaciais</h4>
              <div className="space-y-1.5">
                {LAYER_DEFS.map((def) => {
                  const data = layerQueries[def.layerType];
                  const count = data?.features?.length ?? 0;
                  const loaded = !!data && count > 0;
                  return (
                    <div key={def.key} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: loaded ? def.color : "#cbd5e1" }}
                      />
                      <span className={loaded ? "text-foreground" : "text-muted-foreground"}>
                        {def.label}
                      </span>
                      <span className="ml-auto text-muted-foreground">
                        {loaded ? `${count} feições` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Eye className="h-4 w-4 text-primary" />
            Obras no mapa (ordenadas por risco)
          </div>
          {georeferenciadas.length === 0 ? (
            <EmptyState message="Nenhuma obra georreferenciada." />
          ) : (
            <div className="max-h-[300px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-medium">Obra</th>
                    <th className="px-3 py-2 font-medium">Município</th>
                    <th className="px-3 py-2 font-medium">Coordenadas</th>
                    <th className="px-3 py-2 font-medium text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {georeferenciadas
                    .sort((a, b) => (a.efficiency_score ?? 100) - (b.efficiency_score ?? 100))
                    .slice(0, 30)
                    .map((w) => (
                      <tr key={w.id} className="hover:bg-primary/5">
                        <td className="max-w-[200px] truncate px-3 py-2 font-medium text-foreground">
                          {w.object_description}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{w.municipio}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {w.latitude?.toFixed(4)}, {w.longitude?.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ScoreBadge score={w.efficiency_score} showLabel={false} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
