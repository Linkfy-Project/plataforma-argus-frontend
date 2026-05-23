import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon, MapPin } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { analyticsService, worksService } from "@/lib/api";

export const Route = createFileRoute("/_app/mapa")({
  head: () => ({ meta: [{ title: "Mapa Territorial — Plataforma Argus" }] }),
  component: MapaPage,
});

function MapaPage() {
  const geo = useQuery({
    queryKey: ["mapa", "geojson"],
    queryFn: analyticsService.mapGeoJson,
  });
  const works = useQuery({
    queryKey: ["mapa", "works"],
    queryFn: () => worksService.list({ limit: 1000 }),
  });

  if (geo.isLoading || works.isLoading) return <LoadingState rows={6} />;
  if (geo.isError) return <ErrorState onRetry={() => geo.refetch()} />;

  const features = geo.data?.features ?? [];
  const georeferenciadas = (works.data ?? []).filter(
    (w) => w.latitude != null && w.longitude != null,
  );

  return (
    <div>
      <PageHeader
        title="Mapa Territorial"
        description="Distribuição geoespacial das obras públicas monitoradas no estado do Rio de Janeiro."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapIcon className="h-4 w-4 text-primary" />
            Visualização territorial
          </div>
          {features.length === 0 ? (
            <EmptyState
              message="Nenhuma feature geoespacial disponível."
              hint="O backend retornou um GeoJSON vazio. Sincronize a base territorial para visualizar o mapa."
            />
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
              {features.length} feature(s) recebida(s) do endpoint
              <code className="ml-2 rounded bg-background px-2 py-0.5 font-mono text-xs">
                /api/v1/analytics/map/geojson
              </code>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Obras georreferenciadas</h3>
          {georeferenciadas.length === 0 ? (
            <EmptyState message="Nenhuma obra com coordenadas." />
          ) : (
            <ul className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {georeferenciadas.slice(0, 30).map((w) => (
                <li
                  key={w.id}
                  className="flex items-start gap-2 rounded-md border border-border p-2 text-sm"
                >
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{w.object_description}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.municipio} · {w.latitude?.toFixed(4)}, {w.longitude?.toFixed(4)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}