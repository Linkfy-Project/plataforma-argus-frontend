import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import {
  Map as MapIcon,
  MapPin,
  MapPinOff,
  Layers,
  Eye,
  Filter,
  ExternalLink,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { worksService, geoService } from "@/lib/api";
import { getRiskLevel, getScoreHex } from "@/lib/score";
import { fmtBRL, fmtBRLCompact } from "@/lib/format";
import type { WorkRead } from "@/types";
import type { GeoLayerData } from "@/components/argus/ArgusMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ArgusMap = lazy(() =>
  import("@/components/argus/ArgusMap").then((m) => ({ default: m.ArgusMap })),
);
const MapLegend = lazy(() =>
  import("@/components/argus/ArgusMap").then((m) => ({ default: m.MapLegend })),
);

/* ========================================================================== */
/* Rota                                                                        */
/* ========================================================================== */

export const Route = createFileRoute("/_app/mapa")({
  head: () => ({ meta: [{ title: "Mapa Territorial — Macaé-RJ" }] }),
  validateSearch: (search: Record<string, unknown>): { obra?: string } => ({
    obra: typeof search.obra === "string" ? search.obra : undefined,
  }),
  component: MapaPage,
});

/* ========================================================================== */
/* Layer definitions                                                          */
/* ========================================================================== */

const LAYER_DEFS: {
  key: string;
  label: string;
  layerType: "municipality" | "census_tract" | "road";
  color: string;
  fillOpacity: number;
  weight: number;
  defaultActive?: boolean;
}[] = [
  {
    key: "municipality",
    label: "Município",
    layerType: "municipality",
    color: "#1e3a8a",
    fillOpacity: 0.08,
    weight: 3,
  },
  {
    key: "census_tract",
    label: "Setores censitários",
    layerType: "census_tract",
    color: "#6366f1",
    fillOpacity: 0.1,
    weight: 1.5,
  },
  {
    key: "road",
    label: "Malha viária",
    layerType: "road",
    color: "#f97316",
    fillOpacity: 0,
    weight: 2,
    defaultActive: false,
  },
];

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

const RISK_LEVELS = ["Eficiente", "Atenção", "Alto risco", "Crítico", "Sem dados"] as const;

function riskColor(level: string): string {
  switch (level) {
    case "Eficiente":
      return "bg-[color:var(--success)]";
    case "Atenção":
      return "bg-[color:var(--warning)]";
    case "Alto risco":
      return "bg-orange-500";
    case "Crítico":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

function hasGeo(w: WorkRead): boolean {
  return w.latitude != null && w.longitude != null && w.latitude !== 0 && w.longitude !== 0;
}

/* ========================================================================== */
/* Componente principal                                                        */
/* ========================================================================== */

function MapaPage() {
  const searchParams = Route.useSearch();
  const highlightedObraId = searchParams.obra;

  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [bairroFilter, setBairroFilter] = useState<string>("all");
  const [fornecedorFilter, setFornecedorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  /* --- Queries ----------------------------------------------------------- */
  const works = useQuery({
    queryKey: ["mapa", "works"],
    queryFn: () => worksService.listAll({ municipio: "Macae" }),
    staleTime: 60_000,
  });

  const municipalityLayer = useQuery({
    queryKey: ["geo-layers", "municipality"],
    queryFn: () => geoService.layer("municipality"),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const censusTractLayer = useQuery({
    queryKey: ["geo-layers", "census_tract"],
    queryFn: () => geoService.layer("census_tract"),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const roadLayer = useQuery({
    queryKey: ["geo-layers", "road"],
    queryFn: () => geoService.layer("road"),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const layerQueries = useMemo(
    () => ({
      municipality: municipalityLayer.data,
      census_tract: censusTractLayer.data,
      road: roadLayer.data,
    }),
    [municipalityLayer.data, censusTractLayer.data, roadLayer.data],
  );

  const geoLayers = useMemo<GeoLayerData[]>(() => {
    return LAYER_DEFS.filter((def) => {
      const data = layerQueries[def.layerType];
      return data && data.features && data.features.length > 0;
    }).map((def) => ({
      key: def.key,
      label: def.label,
      geojson: layerQueries[def.layerType] as unknown as GeoJSON.FeatureCollection,
      color: def.color,
      fillOpacity: def.fillOpacity,
      weight: def.weight,
      defaultActive: def.defaultActive,
    }));
  }, [layerQueries]);

  /* --- Derivados --------------------------------------------------------- */
  const allWorks = useMemo(() => works.data ?? [], [works.data]);
  const georeferenciadas = useMemo(() => allWorks.filter(hasGeo), [allWorks]);
  const semGeo = useMemo(() => allWorks.filter((w) => !hasGeo(w)), [allWorks]);

  // Extract unique filter options
  const bairros = useMemo(
    () =>
      [...new Set(georeferenciadas.map((w) => w.neighborhood).filter(Boolean))].sort() as string[],
    [georeferenciadas],
  );

  const fornecedores = useMemo(
    () =>
      [
        ...new Set(georeferenciadas.map((w) => w.contractor_name).filter(Boolean)),
      ].sort() as string[],
    [georeferenciadas],
  );

  const statuses = useMemo(
    () => [...new Set(georeferenciadas.map((w) => w.status).filter(Boolean))].sort() as string[],
    [georeferenciadas],
  );

  // Apply filters
  const filteredWorks = useMemo(() => {
    return georeferenciadas.filter((w) => {
      if (riskFilter !== "all") {
        const level = getRiskLevel(w.efficiency_score);
        if (level !== riskFilter) return false;
      }
      if (bairroFilter !== "all" && w.neighborhood !== bairroFilter) return false;
      if (fornecedorFilter !== "all" && w.contractor_name !== fornecedorFilter) return false;
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = [w.object_description, w.contractor_name, w.neighborhood, w.municipio]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [georeferenciadas, riskFilter, bairroFilter, fornecedorFilter, statusFilter, searchQuery]);

  // Risk summary
  const riskSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    for (const level of RISK_LEVELS) {
      summary[level] = filteredWorks.filter(
        (w) => getRiskLevel(w.efficiency_score) === level,
      ).length;
    }
    return summary;
  }, [filteredWorks]);

  const hasActiveFilters =
    riskFilter !== "all" ||
    bairroFilter !== "all" ||
    fornecedorFilter !== "all" ||
    statusFilter !== "all" ||
    searchQuery !== "";

  function clearFilters() {
    setRiskFilter("all");
    setBairroFilter("all");
    setFornecedorFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
  }

  /* --- Loading / Error --------------------------------------------------- */
  if (works.isLoading) return <LoadingState rows={6} />;
  if (works.isError) {
    return <ErrorState onRetry={() => works.refetch()} />;
  }

  /* --- Render ------------------------------------------------------------ */
  return (
    <div className="space-y-4">
      <PageHeader
        title="Mapa Territorial — Macaé-RJ"
        description="Visualização geoespacial de obras públicas com indicadores de risco para apoio à fiscalização e planejamento territorial."
        actions={
          <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <Layers className="h-3.5 w-3.5 text-primary" />
            {filteredWorks.length} obras no mapa de {allWorks.length} totais
            {geoLayers.length > 0 && ` · ${geoLayers.length} camada(s)`}
          </div>
        }
      />

      {/* Alerta de obras sem geolocalização */}
      {semGeo.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-500" />
          <span className="text-foreground">
            <strong>{semGeo.length} obra(s)</strong> não aparecem no mapa por falta de
            geolocalização.
          </span>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link to="/macae">Ver saneamento de dados</Link>
          </Button>
        </div>
      )}

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="h-4 w-4 text-primary" />
              Filtros
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar obra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 pl-8 text-xs"
              />
            </div>

            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os riscos</SelectItem>
                {RISK_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={bairroFilter} onValueChange={setBairroFilter}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Bairro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bairros</SelectItem>
                {bairros.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fornecedores</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                <X className="mr-1 h-3 w-3" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Mapa + Sidebar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        {/* Mapa */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapIcon className="h-4 w-4 text-primary" />
              Mapa de Obras — Macaé-RJ
            </div>
            <Suspense fallback={null}>
              <MapLegend />
            </Suspense>
          </div>

          {filteredWorks.length === 0 && georeferenciadas.length === 0 ? (
            <EmptyState
              message="Nenhuma obra com coordenadas disponíveis."
              hint="Sincronize ou saneie a geolocalização das obras."
            />
          ) : filteredWorks.length === 0 ? (
            <EmptyState
              message="Nenhuma obra corresponde aos filtros selecionados."
              hint="Ajuste os filtros ou limpe-os para ver todas as obras."
            />
          ) : (
            <Suspense
              fallback={
                <div className="flex h-[520px] items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
                  Carregando mapa...
                </div>
              }
            >
              <ArgusMap works={filteredWorks} layers={geoLayers} height="520px" />
            </Suspense>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Resumo por risco */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumo por Risco</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {RISK_LEVELS.map((level) => {
                  const count = riskSummary[level] ?? 0;
                  const pct =
                    filteredWorks.length > 0 ? Math.round((count / filteredWorks.length) * 100) : 0;
                  return (
                    <div key={level} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${riskColor(level)}`} />
                        <span className="text-xs text-foreground">{level}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${riskColor(level)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-14 text-right text-xs text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Obras no mapa / Sem geolocalização */}
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="mapa" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-none rounded-t-xl">
                  <TabsTrigger value="mapa" className="text-xs">
                    <MapPin className="mr-1 h-3 w-3" />
                    No Mapa ({filteredWorks.length})
                  </TabsTrigger>
                  <TabsTrigger value="sem-geo" className="text-xs">
                    <MapPinOff className="mr-1 h-3 w-3" />
                    Sem Geo ({semGeo.length})
                  </TabsTrigger>
                </TabsList>

                {/* Obras georreferenciadas */}
                <TabsContent value="mapa" className="m-0">
                  <div className="max-h-[420px] overflow-auto">
                    {filteredWorks.length === 0 ? (
                      <div className="p-4">
                        <EmptyState message="Nenhuma obra georreferenciada com os filtros atuais." />
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {filteredWorks
                          .sort((a, b) => {
                            // Highlighted obra first
                            if (highlightedObraId) {
                              if (String(a.id) === highlightedObraId) return -1;
                              if (String(b.id) === highlightedObraId) return 1;
                            }
                            return (a.efficiency_score ?? 100) - (b.efficiency_score ?? 100);
                          })
                          .map((w) => (
                            <WorkMapCard
                              key={w.id}
                              work={w}
                              highlighted={String(w.id) === highlightedObraId}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Obras sem geolocalização */}
                <TabsContent value="sem-geo" className="m-0">
                  <div className="max-h-[420px] overflow-auto">
                    {semGeo.length === 0 ? (
                      <div className="p-4">
                        <EmptyState message="Todas as obras possuem geolocalização." />
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {semGeo.map((w) => (
                          <div key={w.id} className="flex items-start gap-3 px-4 py-3">
                            <MapPinOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-foreground">
                                {w.object_description}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {w.neighborhood || "Sem bairro"} ·{" "}
                                {w.contractor_name || "Sem fornecedor"}
                              </p>
                            </div>
                            <Button asChild variant="ghost" size="sm" className="h-6 px-2">
                              <Link to="/obras/$id" params={{ id: String(w.id) }}>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Card individual de obra no mapa                                             */
/* ========================================================================== */

function WorkMapCard({ work: w, highlighted }: { work: WorkRead; highlighted?: boolean }) {
  const riskLevel = getRiskLevel(w.efficiency_score);
  const scoreColor = getScoreHex(w.efficiency_score);
  const alertCount = w.alerts?.length ?? 0;

  return (
    <div
      id={`work-map-${w.id}`}
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-primary/5 ${
        highlighted ? "ring-2 ring-primary bg-primary/10" : ""
      }`}
    >
      <div
        className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
        style={{ backgroundColor: scoreColor }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{w.object_description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {w.neighborhood && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {w.neighborhood}
            </span>
          )}
          {w.contract_value != null && w.contract_value > 0 && (
            <span>{fmtBRLCompact(w.contract_value)}</span>
          )}
          {w.contractor_name && <span className="max-w-[100px] truncate">{w.contractor_name}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <ScoreBadge score={w.efficiency_score} showLabel={false} className="text-[10px]" />
          <Badge
            variant="outline"
            className="text-[9px]"
            style={{
              borderColor: scoreColor,
              color: scoreColor,
            }}
          >
            {riskLevel}
          </Badge>
          {alertCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" />
              {alertCount}
            </span>
          )}
          {w.status && <span className="text-[10px] text-muted-foreground">{w.status}</span>}
        </div>
      </div>
      <Button asChild variant="ghost" size="sm" className="h-6 flex-shrink-0 px-2">
        <Link to="/obras/$id" params={{ id: String(w.id) }}>
          <Eye className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}
