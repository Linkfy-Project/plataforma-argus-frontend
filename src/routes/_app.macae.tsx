import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Building2,
  HardHat,
  Wallet,
  Gauge,
  AlertTriangle,
  MapPin,
  MapPinOff,
  Database,
  ShieldAlert,
  BarChart3,
  FileSearch,
  Lightbulb,
  ExternalLink,
  Eye,
  TrendingDown,
  Users,
  Clock,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { LoadingState, ErrorState, EmptyState } from "@/components/argus/EmptyState";
import { territoryService, dashboardService, worksService } from "@/lib/api";
import { fmtBRL, fmtBRLCompact, fmtNumber, fmtScore } from "@/lib/format";
import { getRiskLevel, getScoreClasses, getScoreHex } from "@/lib/score";
import type {
  TerritoryOverview,
  NeighborhoodListItem,
  NeighborhoodRiskItem,
  DataQualityReport,
  WorkRead,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ========================================================================== */
/* Rota                                                                        */
/* ========================================================================== */

export const Route = createFileRoute("/_app/macae")({
  head: () => ({ meta: [{ title: "Análise Microterritorial — Macaé-RJ" }] }),
  component: MacaePage,
});

const MUNICIPIO = "Macae";

/* ========================================================================== */
/* Classificação visual do bairro                                              */
/* ========================================================================== */

function getClassificacaoBadgeClass(classificacao: string): string {
  const c = (classificacao ?? "").toLowerCase();
  if (c.includes("crítico") || c.includes("critico")) {
    return "bg-destructive/10 text-destructive border-destructive/30";
  }
  if (c.includes("alto")) {
    return "bg-orange-500/15 text-orange-600 border-orange-500/30";
  }
  if (c.includes("atenção") || c.includes("atencao")) {
    return "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30";
  }
  if (c.includes("eficiente") || c.includes("bom")) {
    return "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30";
  }
  return "bg-muted text-muted-foreground border-border";
}

function getClassificacaoColor(classificacao: string): string {
  const c = (classificacao ?? "").toLowerCase();
  if (c.includes("crítico") || c.includes("critico")) return "#DC2626";
  if (c.includes("alto")) return "#F97316";
  if (c.includes("atenção") || c.includes("atencao")) return "#F59E0B";
  if (c.includes("eficiente") || c.includes("bom")) return "#22C55E";
  return "#94A3B8";
}

/* ========================================================================== */
/* Geração de leitura executiva automática                                     */
/* ========================================================================== */

function generateExecutiveReading(
  overview: TerritoryOverview | undefined,
  neighborhoods: NeighborhoodListItem[],
  quality: DataQualityReport | undefined,
): string {
  if (!overview || neighborhoods.length === 0) {
    return "Dados insuficientes para gerar a leitura executiva do território.";
  }

  const parts: string[] = [];

  // Bairro mais crítico
  if (overview.bairro_mais_critico) {
    const criticoData = neighborhoods.find(
      (n) => n.bairro.toLowerCase() === overview.bairro_mais_critico.toLowerCase(),
    );
    if (criticoData) {
      parts.push(
        `O bairro ${overview.bairro_mais_critico} concentra o maior risco territorial com ${criticoData.obras_criticas} obras críticas, score médio de ${fmtScore(criticoData.score_medio)} e ${criticoData.alertas_totais} alertas ativos, demandando priorização imediata para vistoria técnica.`,
      );
    } else {
      parts.push(
        `O bairro ${overview.bairro_mais_critico} é o mais crítico do território e deve ser priorizado para vistoria técnica.`,
      );
    }
  }

  // Bairro com maior valor contratado
  if (overview.bairro_maior_valor) {
    const valorData = neighborhoods.find(
      (n) => n.bairro.toLowerCase() === overview.bairro_maior_valor.toLowerCase(),
    );
    if (valorData) {
      parts.push(
        `${overview.bairro_maior_valor} concentra o maior valor contratado (${fmtBRL(valorData.valor_total)}), com ${valorData.obras} obras monitoradas e ${valorData.obras_atrasadas} em atraso.`,
      );
    }
  }

  // Bairro com mais atrasos
  if (
    overview.bairro_mais_atrasos &&
    overview.bairro_mais_atrasos !== overview.bairro_mais_critico
  ) {
    parts.push(
      `Em termos de atrasos, ${overview.bairro_mais_atrasos} apresenta a maior concentração de obras fora do prazo, indicando possível deficiência na gestão de cronograma.`,
    );
  }

  // Qualidade dos dados
  if (quality) {
    const totalProblemas =
      quality.obras_sem_bairro +
      quality.obras_sem_geolocalizacao +
      quality.obras_sem_fornecedor +
      quality.obras_sem_prazo;
    if (totalProblemas > 0) {
      parts.push(
        `Há ${totalProblemas} obras com problemas cadastrais (${quality.obras_sem_bairro} sem bairro, ${quality.obras_sem_geolocalizacao} sem geolocalização, ${quality.obras_sem_fornecedor} sem fornecedor, ${quality.obras_sem_prazo} sem prazo), o que reduz a confiabilidade territorial da análise.`,
      );
    }
  }

  // Recomendação territorial
  if (overview.recomendacoes && overview.recomendacoes.length > 0) {
    parts.push(`Recomendação: ${overview.recomendacoes[0]}`);
  } else {
    parts.push(
      "Recomenda-se intensificar a fiscalização nos bairros com maior concentração de risco e sanear os dados cadastrais para melhorar a acurácia da análise territorial.",
    );
  }

  return parts.join(" ");
}

/* ========================================================================== */
/* Componente principal                                                        */
/* ========================================================================== */

function MacaePage() {
  /* --- Queries ----------------------------------------------------------- */
  const overview = useQuery({
    queryKey: ["territory", "macae-overview"],
    queryFn: () => territoryService.macaeOverview(),
    staleTime: 60_000,
  });

  const neighborhoods = useQuery({
    queryKey: ["territory", "macae-neighborhoods"],
    queryFn: () => territoryService.macaeNeighborhoods(),
    staleTime: 60_000,
  });

  const dataQuality = useQuery({
    queryKey: ["territory", "macae-data-quality"],
    queryFn: () => territoryService.macaeDataQuality(),
    staleTime: 60_000,
  });

  const topRisk = useQuery({
    queryKey: ["dashboard", "top-neighborhoods-risk", MUNICIPIO],
    queryFn: () => dashboardService.topNeighborhoodsRisk(MUNICIPIO, 20),
    staleTime: 60_000,
  });

  const works = useQuery({
    queryKey: ["works", MUNICIPIO],
    queryFn: () => worksService.listAll({ municipio: MUNICIPIO }),
    staleTime: 60_000,
  });

  /* --- Derivados --------------------------------------------------------- */
  const isLoading = overview.isLoading || neighborhoods.isLoading;
  const isError = overview.isError || neighborhoods.isError;

  const o = overview.data;
  const nbs = useMemo(() => (Array.isArray(neighborhoods.data) ? neighborhoods.data : []), [neighborhoods.data]);
  const quality = dataQuality.data;
  const riskRanking = useMemo(() => (Array.isArray(topRisk.data) ? topRisk.data as NeighborhoodRiskItem[] : []), [topRisk.data]);
  const allWorks = useMemo(() => (Array.isArray(works.data) ? works.data : []), [works.data]);

  // Merge neighborhood data with risk ranking for enriched table
  const enrichedNeighborhoods = useMemo(() => {
    return nbs.map((nb) => {
      const risk = riskRanking.find((r) => r.bairro?.toLowerCase() === nb.bairro.toLowerCase());
      return {
        ...nb,
        recomendacao_risk: risk?.recomendacao,
        classificacao_risk: risk?.classificacao,
      };
    });
  }, [nbs, riskRanking]);

  // Chart data: top 10 neighborhoods by value
  const chartValue = useMemo(() => {
    return [...nbs]
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10)
      .map((nb) => ({
        bairro: nb.bairro.length > 12 ? nb.bairro.slice(0, 12) + "…" : nb.bairro,
        valor: nb.valor_total,
        fullBairro: nb.bairro,
      }));
  }, [nbs]);

  // Chart data: top 10 neighborhoods by critical works
  const chartCritical = useMemo(() => {
    return [...nbs]
      .sort((a, b) => b.obras_criticas - a.obras_criticas)
      .slice(0, 10)
      .map((nb) => ({
        bairro: nb.bairro.length > 12 ? nb.bairro.slice(0, 12) + "…" : nb.bairro,
        criticas: nb.obras_criticas,
        atrasadas: nb.obras_atrasadas,
        fullBairro: nb.bairro,
      }));
  }, [nbs]);

  // Chart data: top 10 neighborhoods by score (ascending = worst first)
  const chartScore = useMemo(() => {
    return [...nbs]
      .sort((a, b) => a.score_medio - b.score_medio)
      .slice(0, 10)
      .map((nb) => ({
        bairro: nb.bairro.length > 12 ? nb.bairro.slice(0, 12) + "…" : nb.bairro,
        score: Math.round(nb.score_medio),
        fullBairro: nb.bairro,
      }));
  }, [nbs]);

  // Chart data: neighborhoods with works without geolocation
  const chartNoGeo = useMemo(() => {
    return [...nbs]
      .filter((nb) => nb.obras_sem_geolocalizacao > 0)
      .sort((a, b) => b.obras_sem_geolocalizacao - a.obras_sem_geolocalizacao)
      .slice(0, 10)
      .map((nb) => ({
        bairro: nb.bairro.length > 12 ? nb.bairro.slice(0, 12) + "…" : nb.bairro,
        sem_geo: nb.obras_sem_geolocalizacao,
        fullBairro: nb.bairro,
      }));
  }, [nbs]);

  // Executive reading text
  const executiveText = useMemo(() => generateExecutiveReading(o, nbs, quality), [o, nbs, quality]);

  /* --- Loading / Error --------------------------------------------------- */
  if (isLoading) return <LoadingState rows={8} />;
  if (isError) {
    return (
      <ErrorState
        onRetry={() => {
          overview.refetch();
          neighborhoods.refetch();
        }}
      />
    );
  }

  /* --- Render ------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Análise Microterritorial — Macaé-RJ"
        description="Leitura territorial de obras, contratos, riscos e alertas para apoiar decisões de fiscalização e planejamento."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/mapa">
              <Eye className="mr-2 h-4 w-4" />
              Ver no Mapa
            </Link>
          </Button>
        }
      />

      {/* ── Cards KPI ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bairros monitorados"
          value={fmtNumber(o?.bairros_monitorados ?? 0)}
          icon={MapPin}
          tone="primary"
        />
        <StatCard
          label="Obras monitoradas"
          value={fmtNumber(o?.obras_monitoradas ?? 0)}
          icon={HardHat}
          tone="primary"
        />
        <StatCard
          label="Valor contratado"
          value={fmtBRLCompact(o?.valor_total_contratado ?? 0)}
          icon={Wallet}
          tone="accent"
        />
        <StatCard
          label="Score médio"
          value={fmtScore(o?.score_medio ?? null)}
          icon={Gauge}
          tone={
            (o?.score_medio ?? 0) >= 60
              ? "success"
              : (o?.score_medio ?? 0) >= 40
                ? "warning"
                : "danger"
          }
        />
        <StatCard
          label="Bairros críticos"
          value={fmtNumber(o?.bairros_criticos ?? 0)}
          icon={ShieldAlert}
          tone="danger"
        />
        <StatCard
          label="Obras sem bairro"
          value={fmtNumber(o?.obras_sem_bairro ?? 0)}
          icon={MapPinOff}
          tone="warning"
        />
        <StatCard
          label="Obras sem geolocalização"
          value={fmtNumber(o?.obras_sem_geolocalizacao ?? 0)}
          icon={MapPinOff}
          tone="warning"
        />
        <StatCard
          label="Qualidade dos dados"
          value={quality ? `${Math.round(quality.data_quality_score)}%` : "—"}
          icon={Database}
          tone={
            quality && quality.data_quality_score >= 70
              ? "success"
              : quality && quality.data_quality_score >= 50
                ? "warning"
                : "danger"
          }
        />
      </div>

      {/* ── Ranking de Bairros por Risco ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Ranking de Bairros por Risco
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrichedNeighborhoods.length === 0 ? (
            <EmptyState message="Nenhum bairro com dados disponíveis." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Bairro</TableHead>
                    <TableHead className="text-right">Obras</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Score Médio</TableHead>
                    <TableHead className="text-right">Obras Críticas</TableHead>
                    <TableHead className="text-right">Obras Atrasadas</TableHead>
                    <TableHead className="text-right">Alertas</TableHead>
                    <TableHead className="text-right">Fornecedores</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead className="min-w-[180px]">Recomendação</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedNeighborhoods.map((nb) => (
                    <TableRow key={nb.bairro} className="hover:bg-primary/5">
                      <TableCell className="font-medium text-foreground">{nb.bairro}</TableCell>
                      <TableCell className="text-right tabular-nums">{nb.obras}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {fmtBRLCompact(nb.valor_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ScoreBadge score={nb.score_medio} showLabel={false} />
                      </TableCell>
                      <TableCell className="text-right">
                        {nb.obras_criticas > 0 ? (
                          <span className="font-semibold text-destructive">
                            {nb.obras_criticas}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {nb.obras_atrasadas > 0 ? (
                          <span className="font-semibold text-orange-600">
                            {nb.obras_atrasadas}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {nb.alertas_totais > 0 ? (
                          <span className="font-semibold text-destructive">
                            {nb.alertas_totais}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {nb.fornecedores_distintos}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getClassificacaoBadgeClass(nb.classificacao)}
                        >
                          {nb.classificacao || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                        {nb.recomendacao || nb.recomendacao_risk || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/obras" search={{ bairro: nb.bairro }}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Gráficos ────────────────────────────────────────────────────── */}
      <Tabs defaultValue="valor" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="valor">Valor Contratado</TabsTrigger>
          <TabsTrigger value="criticas">Obras Críticas</TabsTrigger>
          <TabsTrigger value="score">Score Médio</TabsTrigger>
          <TabsTrigger value="geo">Sem Geolocalização</TabsTrigger>
        </TabsList>

        {/* Valor contratado por bairro */}
        <TabsContent value="valor">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4 text-accent" />
                Valor Contratado por Bairro (Top 10)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartValue.length === 0 ? (
                <EmptyState message="Sem dados de valor por bairro." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartValue} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tickFormatter={(v) => fmtBRLCompact(v)} fontSize={11} />
                    <YAxis type="category" dataKey="bairro" width={100} fontSize={11} />
                    <Tooltip
                      formatter={(value: number) => [fmtBRL(value), "Valor"]}
                      labelFormatter={(label) => {
                        const item = chartValue.find((c) => c.bairro === label);
                        return item?.fullBairro ?? label;
                      }}
                    />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                      {chartValue.map((entry, i) => (
                        <Cell key={i} fill="#6366f1" fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Obras críticas por bairro */}
        <TabsContent value="criticas">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Obras Críticas e Atrasadas por Bairro (Top 10)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartCritical.length === 0 ? (
                <EmptyState message="Sem dados de obras críticas por bairro." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartCritical} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="bairro" width={100} fontSize={11} />
                    <Tooltip
                      labelFormatter={(label) => {
                        const item = chartCritical.find((c) => c.bairro === label);
                        return item?.fullBairro ?? label;
                      }}
                    />
                    <Bar dataKey="criticas" name="Críticas" fill="#DC2626" radius={[0, 4, 4, 0]} />
                    <Bar
                      dataKey="atrasadas"
                      name="Atrasadas"
                      fill="#F97316"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Score médio por bairro */}
        <TabsContent value="score">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-primary" />
                Score Médio por Bairro (10 piores)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartScore.length === 0 ? (
                <EmptyState message="Sem dados de score por bairro." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartScore} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} fontSize={11} />
                    <YAxis type="category" dataKey="bairro" width={100} fontSize={11} />
                    <Tooltip
                      formatter={(value: number) => [`${value}/100`, "Score"]}
                      labelFormatter={(label) => {
                        const item = chartScore.find((c) => c.bairro === label);
                        return item?.fullBairro ?? label;
                      }}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {chartScore.map((entry, i) => (
                        <Cell key={i} fill={getScoreHex(entry.score)} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Obras sem geolocalização por bairro */}
        <TabsContent value="geo">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPinOff className="h-4 w-4 text-orange-500" />
                Obras Sem Geolocalização por Bairro
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartNoGeo.length === 0 ? (
                <EmptyState message="Todas as obras possuem geolocalização." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartNoGeo} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="bairro" width={100} fontSize={11} />
                    <Tooltip
                      formatter={(value: number) => [value, "Obras sem geo"]}
                      labelFormatter={(label) => {
                        const item = chartNoGeo.find((c) => c.bairro === label);
                        return item?.fullBairro ?? label;
                      }}
                    />
                    <Bar dataKey="sem_geo" fill="#F97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Leitura Executiva do Território ─────────────────────────────── */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-primary" />
            Leitura Executiva do Território
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/80">{executiveText}</p>
        </CardContent>
      </Card>

      {/* ── Saneamento de Dados ─────────────────────────────────────────── */}
      {quality && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-5 w-5 text-orange-500" />
              Saneamento de Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {fmtNumber(quality.obras_sem_bairro)}
                </p>
                <p className="text-xs text-muted-foreground">Sem bairro</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {fmtNumber(quality.obras_sem_geolocalizacao)}
                </p>
                <p className="text-xs text-muted-foreground">Sem coordenadas</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {fmtNumber(quality.obras_sem_fornecedor)}
                </p>
                <p className="text-xs text-muted-foreground">Sem fornecedor</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {fmtNumber(quality.obras_sem_prazo)}
                </p>
                <p className="text-xs text-muted-foreground">Sem prazo</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {fmtNumber(quality.obras_sem_valor)}
                </p>
                <p className="text-xs text-muted-foreground">Sem valor</p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-orange-500/30 bg-orange-500/5 p-4">
              <div className="flex items-start gap-3">
                <FileSearch className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Recomendação de melhoria cadastral
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {quality.obras_sem_bairro > 0 &&
                      `${quality.obras_sem_bairro} obra(s) não possuem bairro informado. `}
                    {quality.obras_sem_geolocalizacao > 0 &&
                      `${quality.obras_sem_geolocalizacao} obra(s) não aparecem no mapa por falta de geolocalização. `}
                    {quality.obras_sem_fornecedor > 0 &&
                      `${quality.obras_sem_fornecedor} obra(s) não possuem fornecedor cadastrado. `}
                    {quality.obras_sem_prazo > 0 &&
                      `${quality.obras_sem_prazo} obra(s) não possuem prazo definido. `}
                    Sincronize os dados ou realize o saneamento cadastral para melhorar a
                    confiabilidade da análise territorial.
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de obras para saneamento */}
            {quality.obras_para_saneamento.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  Obras que precisam de saneamento ({quality.obras_para_saneamento.length})
                </h4>
                <div className="max-h-[240px] overflow-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Bairro</TableHead>
                        <TableHead>Problemas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quality.obras_para_saneamento.slice(0, 20).map((obra) => (
                        <TableRow key={obra.id}>
                          <TableCell className="font-mono text-xs">#{obra.id}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs">
                            {obra.descricao}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {obra.bairro || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {obra.problemas.map((p) => (
                                <Badge key={p} variant="outline" className="text-[10px]">
                                  {p}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
