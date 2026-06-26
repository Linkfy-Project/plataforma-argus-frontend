import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  HardHat,
  Wallet,
  TrendingDown,
  AlertTriangle,
  Gauge,
  MapPin,
  ArrowRight,
  Clock,
  Siren,
  Building2,
  Map as MapIcon,
  ShieldAlert,
  MapPinOff,
  Users,
  BarChart3,
  Lightbulb,
  RefreshCw,
  FileText,
  Eye,
  ExternalLink,
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
import { EmptyState, LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { ObraDetailModal } from "@/components/argus/ObraDetailModal";
import { dashboardService, etlService, worksService } from "@/lib/api";
import { fmtBRL, fmtNumber, fmtScore, formatDateBR } from "@/lib/format";
import { getRiskLevel, getScoreClasses } from "@/lib/score";
import type {
  DashboardExecutiveSummary,
  PriorityQueueItem,
  RiskDistributionItem,
  NeighborhoodRiskItem,
  SupplierRankingItem,
  SyncStatus,
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

/* ========================================================================== */
/* Rota                                                                        */
/* ========================================================================== */

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Painel Executivo — ARGUS Macaé-RJ" }] }),
  component: DashboardPage,
});

/* ========================================================================== */
/* Constantes de cores para o gráfico de risco                                  */
/* ========================================================================== */

const RISK_CHART_COLORS: Record<string, string> = {
  Eficiente: "#22C55E",
  Atenção: "#F59E0B",
  "Alto risco": "#F97316",
  Crítico: "#DC2626",
  "Sem dados": "#94A3B8",
};

/* ========================================================================== */
/* Funções de fallback isoladas — derivam dados de worksService.listAll         */
/* ========================================================================== */

/** Computa o resumo executivo a partir da lista bruta de obras. */
function computeSummaryFromWorks(works: WorkRead[]): DashboardExecutiveSummary {
  const today = new Date();
  const scores = works.map((w) => w.efficiency_score).filter((s): s is number => s != null);
  const avgScore = scores.length
    ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
    : 0;

  const delayed = works.filter((w) => {
    if (!w.due_at || w.finished_at) return false;
    return new Date(w.due_at) < today;
  }).length;

  const criticas = works.filter((w) => (w.efficiency_score ?? 100) < 40).length;
  const altoRisco = works.filter(
    (w) => (w.efficiency_score ?? 100) >= 40 && (w.efficiency_score ?? 100) < 60,
  ).length;
  const emAtencao = works.filter(
    (w) => (w.efficiency_score ?? 100) >= 60 && (w.efficiency_score ?? 100) < 80,
  ).length;
  const eficientes = works.filter((w) => (w.efficiency_score ?? 0) >= 80).length;

  const semGeo = works.filter((w) => w.latitude == null || w.longitude == null).length;

  const alertasCriticos = works.reduce(
    (acc, w) =>
      acc +
      (w.alerts ?? []).filter(
        (a) => a.severity === "critical" || a.severity === "danger" || a.severity === "crítico",
      ).length,
    0,
  );
  const alertasTotais = works.reduce((acc, w) => acc + (w.alerts ?? []).length, 0);

  const fornecedores = new Set(works.map((w) => w.contractor_name?.trim()).filter(Boolean)).size;
  const bairros = new Set(works.map((w) => w.neighborhood?.trim()).filter(Boolean)).size;

  const comAditivosAltos = works.filter((w) => {
    const val = w.contract_value ?? 0;
    const add = w.additive_value ?? 0;
    return val > 0 && add / val > 0.25;
  }).length;

  const valorTotal = works.reduce((acc, w) => acc + (w.contract_value ?? 0), 0);
  const valorPago = works.reduce((acc, w) => acc + (w.paid_value ?? w.settled_value ?? 0), 0);
  const valorRisco = works
    .filter((w) => (w.efficiency_score ?? 100) < 60)
    .reduce((acc, w) => acc + (w.contract_value ?? 0), 0);

  const semBairro = works.filter((w) => !w.neighborhood?.trim()).length;
  const semFornecedor = works.filter((w) => !w.contractor_name?.trim()).length;
  const semPrazo = works.filter((w) => !w.due_at).length;
  const semValor = works.filter((w) => w.contract_value == null || w.contract_value === 0).length;
  const totalChecks = works.length * 4;
  const issues = semBairro + semGeo + semFornecedor + semPrazo + semValor;
  const dqScore =
    works.length > 0 ? Math.round(Math.max(0, ((totalChecks - issues) / totalChecks) * 100)) : 0;

  return {
    municipio: "Macaé-RJ",
    ultima_atualizacao: new Date().toISOString(),
    obras_monitoradas: works.length,
    valor_total_contratado: valorTotal,
    valor_total_pago: valorPago,
    valor_potencial_em_risco: valorRisco,
    obras_criticas: criticas,
    obras_alto_risco: altoRisco,
    obras_em_atencao: emAtencao,
    obras_eficientes: eficientes,
    obras_atrasadas: delayed,
    obras_sem_geolocalizacao: semGeo,
    contratos_com_aditivos_altos: comAditivosAltos,
    alertas_criticos: alertasCriticos,
    alertas_totais: alertasTotais,
    fornecedores_monitorados: fornecedores,
    bairros_monitorados: bairros,
    score_medio: avgScore,
    data_quality_score: dqScore,
  };
}

/** Computa a fila de prioridade a partir da lista bruta de obras. */
function computePriorityFromWorks(works: WorkRead[]): PriorityQueueItem[] {
  const today = new Date();

  const scored = works
    .map((w) => {
      const score = w.efficiency_score ?? 50;
      const isOverdue = !!w.due_at && !w.finished_at && new Date(w.due_at) < today;
      const daysOverdue = isOverdue
        ? Math.floor((today.getTime() - new Date(w.due_at!).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const criticalAlerts = (w.alerts ?? []).filter(
        (a) => a.severity === "critical" || a.severity === "danger" || a.severity === "crítico",
      ).length;

      const valor = w.contract_value ?? 0;
      const valorRisco = valor * (1 - score / 100);

      let motivo = "Monitoramento de rotina";
      if (score < 40) motivo = "Score ARGUS em nível crítico";
      else if (isOverdue) motivo = `Obra atrasada em ${daysOverdue} dias`;
      else if (criticalAlerts > 0) motivo = `${criticalAlerts} alerta(s) crítico(s) ativo(s)`;
      else if (score < 60) motivo = "Eficiência abaixo do limiar mínimo";

      let acao = "Acompanhar evolução";
      if (score < 40) acao = "Vistoria técnica imediata";
      else if (isOverdue) acao = "Solicitar replanejamento";
      else if (criticalAlerts > 0) acao = "Analisar alertas e encaminhar";
      else if (score < 60) acao = "Reforçar fiscalização";

      return {
        work: w,
        score,
        isOverdue,
        daysOverdue,
        criticalAlerts,
        valor,
        valorRisco,
        motivo,
        acao,
      };
    })
    .filter((item) => item.score < 60 || item.isOverdue || item.criticalAlerts > 0)
    .sort((a, b) => {
      if (a.score < 40 && b.score >= 40) return -1;
      if (b.score < 40 && a.score >= 40) return 1;
      if (a.criticalAlerts > 0 && b.criticalAlerts === 0) return -1;
      if (b.criticalAlerts > 0 && a.criticalAlerts === 0) return 1;
      if (a.isOverdue && !b.isOverdue) return -1;
      if (b.isOverdue && !a.isOverdue) return 1;
      return a.score - b.score;
    })
    .slice(0, 10);

  return scored.map((item, i) => ({
    prioridade: i + 1,
    obra_id: item.work.id,
    obra: item.work.object_description?.trim() || `Obra #${item.work.id}`,
    bairro: item.work.neighborhood ?? null,
    secretaria: item.work.managing_unit ?? item.work.requesting_agency ?? null,
    fornecedor: item.work.contractor_name ?? null,
    score_argus: item.work.efficiency_score ?? null,
    classificacao_risco: getRiskLevel(item.work.efficiency_score),
    valor_contratado: item.valor,
    valor_em_risco_estimado: item.valorRisco,
    dias_atraso: item.daysOverdue,
    alertas_ativos: (item.work.alerts ?? []).length,
    motivo_principal: item.motivo,
    acao_sugerida: item.acao,
    // Indica se algum alerta possui agravante social (severity_multiplier > 1 = IDH < 0.600)
    has_agravante_social: (item.work.alerts ?? []).some((a) => a.severity_multiplier > 1),
  }));
}

/** Computa a distribuição de risco a partir da lista bruta de obras. */
function computeRiskDistributionFromWorks(works: WorkRead[]): RiskDistributionItem[] {
  const buckets: Record<string, { min: number | null; max: number | null; count: number }> = {
    Eficiente: { min: 80, max: 100, count: 0 },
    Atenção: { min: 60, max: 79, count: 0 },
    "Alto risco": { min: 40, max: 59, count: 0 },
    Crítico: { min: 0, max: 39, count: 0 },
    "Sem dados": { min: null, max: null, count: 0 },
  };

  for (const w of works) {
    const level = getRiskLevel(w.efficiency_score);
    buckets[level].count += 1;
  }

  return Object.entries(buckets).map(([label, { min, max, count }]) => ({
    label,
    min,
    max,
    total: count,
  }));
}

/** Computa o ranking de bairros com maior risco a partir da lista bruta de obras. */
function computeNeighborhoodsFromWorks(works: WorkRead[]): NeighborhoodRiskItem[] {
  const grouped = new Map<string, WorkRead[]>();
  for (const w of works) {
    const bairro = w.neighborhood?.trim() || "Sem bairro definido";
    if (!grouped.has(bairro)) grouped.set(bairro, []);
    grouped.get(bairro)!.push(w);
  }

  return Array.from(grouped.entries())
    .map(([bairro, ws]) => {
      const scores = ws.map((w) => w.efficiency_score).filter((s): s is number => s != null);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const today = new Date();

      return {
        bairro,
        obras: ws.length,
        score_medio: avg,
        obras_criticas: ws.filter((w) => (w.efficiency_score ?? 100) < 40).length,
        obras_atrasadas: ws.filter(
          (w) => !!w.due_at && !w.finished_at && new Date(w.due_at) < today,
        ).length,
        valor_total: ws.reduce((s, w) => s + (w.contract_value ?? 0), 0),
        alertas: ws.reduce((s, w) => s + (w.alerts ?? []).length, 0),
        classificacao: getRiskLevel(avg),
        recomendacao:
          avg < 40
            ? "Vistoria técnica urgente necessária"
            : avg < 60
              ? "Monitoramento intensificado recomendado"
              : avg < 80
                ? "Acompanhamento regular com atenção"
                : "Bairro com bom desempenho",
      };
    })
    .sort((a, b) => a.score_medio - b.score_medio)
    .slice(0, 10);
}

/** Computa o ranking de fornecedores com maior risco a partir da lista bruta de obras. */
function computeSuppliersFromWorks(works: WorkRead[]): SupplierRankingItem[] {
  const grouped = new Map<string, WorkRead[]>();
  for (const w of works) {
    const name = w.contractor_name?.trim();
    if (!name) continue;
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(w);
  }

  return Array.from(grouped.entries())
    .map(([fornecedor, ws]) => {
      const scores = ws.map((w) => w.efficiency_score).filter((s): s is number => s != null);
      const avg = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

      return {
        fornecedor,
        cnpj: ws[0]?.contractor_document ?? null,
        contratos: ws.length,
        obras: ws.length,
        valor_total: ws.reduce((s, w) => s + (w.contract_value ?? 0), 0),
        valor_pago: ws.reduce((s, w) => s + (w.paid_value ?? w.settled_value ?? 0), 0),
        score_medio: avg,
        obras_criticas: ws.filter((w) => (w.efficiency_score ?? 100) < 40).length,
        obras_atrasadas: ws.filter(
          (w) => !!w.due_at && !w.finished_at && new Date(w.due_at) < new Date(),
        ).length,
        alertas_totais: ws.reduce((s, w) => s + (w.alerts ?? []).length, 0),
        alertas_criticos: ws.reduce(
          (s, w) =>
            s +
            (w.alerts ?? []).filter((a) => a.severity === "critical" || a.severity === "danger")
              .length,
          0,
        ),
        aditivo_medio_percentual: 0,
        bairros_atuacao: [...new Set(ws.map((w) => w.neighborhood).filter(Boolean) as string[])],
        classificacao: getRiskLevel(avg),
        recomendacao:
          avg != null && avg < 40
            ? "Auditoria completa dos contratos"
            : avg != null && avg < 60
              ? "Revisão de desempenho recomendada"
              : "Fornecedor dentro dos parâmetros",
      };
    })
    .sort((a, b) => (a.score_medio ?? 100) - (b.score_medio ?? 100))
    .slice(0, 10);
}

/* ========================================================================== */
/* Gerador de recomendações executivas                                         */
/* ========================================================================== */

interface Recommendation {
  text: string;
  severity: "critical" | "warning" | "info";
}

function generateRecommendations(s: DashboardExecutiveSummary): Recommendation[] {
  const recs: Recommendation[] = [];

  if (s.obras_criticas > 0) {
    recs.push({
      text: `Priorizar vistoria técnica nas ${s.obras_criticas} obra(s) com score crítico (< 40).`,
      severity: "critical",
    });
  }
  if (s.obras_atrasadas > 0) {
    recs.push({
      text: `${s.obras_atrasadas} obra(s) atrasada(s) — solicitar replanejamento e revisão de cronograma.`,
      severity: "critical",
    });
  }
  if (s.alertas_criticos > 0) {
    recs.push({
      text: `${s.alertas_criticos} alerta(s) crítico(s) pendente(s) — encaminhar para equipe de controle interno.`,
      severity: "critical",
    });
  }
  if (s.obras_sem_geolocalizacao > 0) {
    recs.push({
      text: `Sanear cadastro territorial: ${s.obras_sem_geolocalizacao} obra(s) sem coordenadas geográficas.`,
      severity: "warning",
    });
  }
  if (s.contratos_com_aditivos_altos > 0) {
    recs.push({
      text: `Revisar justificativas de ${s.contratos_com_aditivos_altos} aditivo(s) contratuais acima de 25%.`,
      severity: "warning",
    });
  }
  if (s.data_quality_score < 70) {
    recs.push({
      text: `Qualidade dos dados em ${s.data_quality_score}/100 — melhorar completude antes de decisões automatizadas.`,
      severity: "warning",
    });
  }
  if (s.obras_alto_risco > 0) {
    recs.push({
      text: `${s.obras_alto_risco} obra(s) em alto risco — reforçar fiscalização e monitoramento.`,
      severity: "warning",
    });
  }
  if (recs.length === 0) {
    recs.push({
      text: "Nenhuma prioridade crítica no momento. Manter monitoramento regular do painel.",
      severity: "info",
    });
  }

  return recs;
}

/* ========================================================================== */
/* Componente auxiliar: badge de classificação de risco                        */
/* ========================================================================== */

function RiskClassificationBadge({
  label,
  score,
}: {
  label: string;
  score: number | null | undefined;
}) {
  const cls = getScoreClasses(score);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

/* ========================================================================== */
/* Componente auxiliar: ícone de severidade para recomendações                 */
/* ========================================================================== */

function SeverityDot({ severity }: { severity: Recommendation["severity"] }) {
  const colorMap = {
    critical: "bg-destructive",
    warning: "bg-orange-500",
    info: "bg-primary",
  };
  return (
    <span className={`mt-1.5 block h-2.5 w-2.5 shrink-0 rounded-full ${colorMap[severity]}`} />
  );
}

/* ========================================================================== */
/* Componente principal: DashboardPage                                         */
/* ========================================================================== */

function DashboardPage() {
  const [modalObraId, setModalObraId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /* ── Helper: fallback compartilhado para listAll ────────────────────────── */
  // Se múltiplas queries precisam do fallback simultaneamente, ensureQueryData
  // deduplica em uma única request (evita 5 downloads do mesmo dataset).
  const FALLBACK_STALE = 5 * 60 * 1000;
  const getWorksForFallback = () =>
    queryClient.ensureQueryData({
      queryKey: ["works", "all-macae"],
      queryFn: () => worksService.listAll({ municipio: "macae" }),
      staleTime: FALLBACK_STALE,
    });

  /* ── Queries com fallback isolado ─────────────────────────────────────── */

  const summary = useQuery({
    queryKey: ["dashboard", "executive-summary"],
    queryFn: async (): Promise<DashboardExecutiveSummary> => {
      try {
        return await dashboardService.executiveSummary("Macae");
      } catch {
        const works = await getWorksForFallback();
        return computeSummaryFromWorks(works);
      }
    },
    staleTime: FALLBACK_STALE,
  });

  const priority = useQuery({
    queryKey: ["dashboard", "priority-queue"],
    queryFn: async (): Promise<PriorityQueueItem[]> => {
      try {
        const data = await dashboardService.priorityQueue("Macae", 10);
        if (Array.isArray(data) && data.length > 0) return data;
        const works = await getWorksForFallback();
        return computePriorityFromWorks(works);
      } catch {
        const works = await getWorksForFallback();
        return computePriorityFromWorks(works);
      }
    },
    staleTime: FALLBACK_STALE,
  });

  const riskDist = useQuery({
    queryKey: ["dashboard", "risk-distribution"],
    queryFn: async (): Promise<RiskDistributionItem[]> => {
      try {
        const data = await dashboardService.riskDistribution("Macae");
        if (Array.isArray(data) && data.length > 0) return data;
        const works = await getWorksForFallback();
        return computeRiskDistributionFromWorks(works);
      } catch {
        const works = await getWorksForFallback();
        return computeRiskDistributionFromWorks(works);
      }
    },
    staleTime: FALLBACK_STALE,
  });

  const neighborhoods = useQuery({
    queryKey: ["dashboard", "top-neighborhoods-risk"],
    queryFn: async (): Promise<NeighborhoodRiskItem[]> => {
      try {
        const data = (await dashboardService.topNeighborhoodsRisk(
          "Macae",
          10,
        )) as unknown as NeighborhoodRiskItem[];
        if (Array.isArray(data) && data.length > 0) return data;
        const works = await getWorksForFallback();
        return computeNeighborhoodsFromWorks(works);
      } catch {
        const works = await getWorksForFallback();
        return computeNeighborhoodsFromWorks(works);
      }
    },
    staleTime: FALLBACK_STALE,
  });

  const suppliers = useQuery({
    queryKey: ["dashboard", "top-suppliers-risk"],
    queryFn: async (): Promise<SupplierRankingItem[]> => {
      try {
        const data = (await dashboardService.topSuppliersRisk(
          "Macae",
          10,
        )) as unknown as SupplierRankingItem[];
        if (Array.isArray(data) && data.length > 0) return data;
        const works = await getWorksForFallback();
        return computeSuppliersFromWorks(works);
      } catch {
        const works = await getWorksForFallback();
        return computeSuppliersFromWorks(works);
      }
    },
    staleTime: FALLBACK_STALE,
  });

  const etl = useQuery<SyncStatus>({
    queryKey: ["etl", "sync-status"],
    queryFn: () => etlService.syncStatus(),
    staleTime: 60 * 1000,
  });

  /* ── Dados derivados ──────────────────────────────────────────────────── */

  const s = summary.data;
  const recommendations = useMemo(() => (s ? generateRecommendations(s) : []), [s]);

  /* ── Handlers ─────────────────────────────────────────────────────────── */

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["etl"] });
    queryClient.invalidateQueries({ queryKey: ["works", "all-macae"] });
  };

  /* ── Estado de carregamento inicial ───────────────────────────────────── */

  if (summary.isLoading) {
    return <LoadingState message="Carregando painel executivo..." rows={8} />;
  }

  if (summary.isError && !summary.data) {
    return (
      <ErrorState
        title="Erro ao carregar o painel executivo"
        message="Não foi possível obter os dados do dashboard. Verifique se a API está disponível."
        onRetry={() => summary.refetch()}
      />
    );
  }

  /* Garantir que temos dados mínimos */
  if (!s) return null;

  /* ── Última atualização ───────────────────────────────────────────────── */
  const lastUpdate = s.ultima_atualizacao ?? etl.data?.now ?? null;

  return (
    <div className="space-y-6 pb-8">
      {/* ═══════════════════════════════════════════════════════════════════
          1. HEADER
         ═══════════════════════════════════════════════════════════════════ */}
      <PageHeader
        title="Painel Executivo — Obras Públicas de Macaé-RJ"
        description="Monitoramento de risco, contratos, fornecedores, alertas e prioridades territoriais para apoiar decisões da gestão pública."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
              <MapPin className="h-3 w-3" />
              Macaé-RJ
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Última atualização:{" "}
              <strong className="text-foreground">{formatDateBR(lastUpdate)}</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={summary.isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${summary.isFetching ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
            <Button asChild variant="default" size="sm">
              <Link to="/relatorios">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Gerar relatório
              </Link>
            </Button>
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════════════════════════
          2. CARDS PRINCIPAIS (12 KPIs)
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Obras monitoradas"
          value={fmtNumber(s.obras_monitoradas)}
          icon={HardHat}
          tone="primary"
          helper="Contratos sob análise ativa"
        />
        <StatCard
          label="Valor total contratado"
          value={fmtBRL(s.valor_total_contratado)}
          icon={Wallet}
          tone="accent"
          helper="Somatório de todos os contratos"
        />
        <StatCard
          label="Valor potencial em risco"
          value={fmtBRL(s.valor_potencial_em_risco)}
          icon={TrendingDown}
          tone="danger"
          helper="Obras com score abaixo de 60"
        />
        <StatCard
          label="Score ARGUS médio"
          value={fmtScore(s.score_medio)}
          icon={Gauge}
          tone={s.score_medio >= 60 ? "success" : "warning"}
          helper="Eficiência composta (0–100)"
        />

        <StatCard
          label="Obras críticas"
          value={fmtNumber(s.obras_criticas)}
          icon={AlertTriangle}
          tone="danger"
          helper="Score ARGUS abaixo de 40"
        />
        <StatCard
          label="Obras em alto risco"
          value={fmtNumber(s.obras_alto_risco)}
          icon={ShieldAlert}
          tone="warning"
          helper="Score ARGUS entre 40 e 59"
        />
        <StatCard
          label="Obras atrasadas"
          value={fmtNumber(s.obras_atrasadas)}
          icon={Clock}
          tone="warning"
          helper="Prazo contratual expirado"
        />
        <StatCard
          label="Alertas críticos"
          value={fmtNumber(s.alertas_criticos)}
          icon={Siren}
          tone="danger"
          helper="Alertas de severidade crítica"
        />

        <StatCard
          label="Obras sem geolocalização"
          value={fmtNumber(s.obras_sem_geolocalizacao)}
          icon={MapPinOff}
          tone="warning"
          helper="Sem coordenadas cadastradas"
        />
        <StatCard
          label="Fornecedores monitorados"
          value={fmtNumber(s.fornecedores_monitorados)}
          icon={Users}
          tone="primary"
          helper="Contratados únicos ativos"
        />
        <StatCard
          label="Bairros monitorados"
          value={fmtNumber(s.bairros_monitorados)}
          icon={MapIcon}
          tone="primary"
          helper="Territórios com obras ativas"
        />
        <StatCard
          label="Qualidade dos dados"
          value={fmtScore(s.data_quality_score)}
          icon={BarChart3}
          tone={s.data_quality_score >= 70 ? "success" : "warning"}
          helper="Completude e consistência"
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          3. O QUE O GESTOR DEVE OLHAR HOJE — FILA DE PRIORIDADE
         ═══════════════════════════════════════════════════════════════════ */}
      <Card className="border-2 border-orange-500/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚨</span>
            <CardTitle className="text-base">O que o gestor deve olhar hoje</CardTitle>
          </div>
          {priority.data && priority.data.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {priority.data.length} prioridade(s)
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {priority.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted/60" />
              ))}
            </div>
          ) : priority.isError ? (
            <ErrorState
              title="Erro ao carregar prioridades"
              message="Não foi possível obter a fila de prioridade."
              onRetry={() => priority.refetch()}
              showApiHint={false}
            />
          ) : !priority.data || priority.data.length === 0 ? (
            <EmptyState
              message="Nenhuma prioridade crítica encontrada para os filtros atuais."
              hint="Todas as obras estão dentro dos parâmetros esperados."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="min-w-[200px]">Obra</TableHead>
                    <TableHead className="min-w-[120px]">Bairro</TableHead>
                    <TableHead className="min-w-[140px]">Fornecedor</TableHead>
                    <TableHead className="w-20 text-center">Score</TableHead>
                    <TableHead className="w-24 text-center">Risco</TableHead>
                    <TableHead className="min-w-[120px] text-right">Valor em risco</TableHead>
                    <TableHead className="min-w-[180px]">Motivo principal</TableHead>
                    <TableHead className="min-w-[160px]">Ação sugerida</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priority.data.map((item) => (
                    <TableRow
                      key={item.obra_id}
                      className={
                        item.score_argus != null && item.score_argus < 40 ? "bg-destructive/5" : ""
                      }
                    >
                      <TableCell>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                          {item.prioridade}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setModalObraId(String(item.obra_id))}
                          className="max-w-[200px] truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {item.obra}
                        </button>
                        {item.has_agravante_social && (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            ⚠ Agravante Social
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.bairro ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="max-w-[140px] truncate text-sm text-muted-foreground">
                          {item.fornecedor ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <ScoreBadge score={item.score_argus} showLabel={false} />
                      </TableCell>
                      <TableCell className="text-center">
                        <RiskClassificationBadge
                          label={item.classificacao_risco}
                          score={item.score_argus}
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {fmtBRL(item.valor_em_risco_estimado)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {item.motivo_principal}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-foreground">
                          {item.acao_sugerida}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/obras/$id" params={{ id: String(item.obra_id) }}>
                            <Eye className="h-3.5 w-3.5" />
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

      {/* ═══════════════════════════════════════════════════════════════════
          4. RISCO POR CLASSIFICAÇÃO — GRÁFICO
         ═══════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Risco por classificação</CardTitle>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/obras">
              Ver todas as obras <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {riskDist.isLoading ? (
            <div className="h-72 animate-pulse rounded-md bg-muted/60" />
          ) : riskDist.isError ? (
            <ErrorState
              title="Erro ao carregar distribuição de risco"
              message="Não foi possível obter os dados de distribuição."
              onRetry={() => riskDist.refetch()}
              showApiHint={false}
            />
          ) : !riskDist.data || riskDist.data.every((d) => d.total === 0) ? (
            <EmptyState message="Sem dados de distribuição de risco disponíveis." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskDist.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [`${value} obra(s)`, "Quantidade"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} name="Obras">
                    {riskDist.data.map((d) => (
                      <Cell
                        key={d.label}
                        fill={RISK_CHART_COLORS[d.label] ?? RISK_CHART_COLORS["Sem dados"]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          5. BAIRROS QUE EXIGEM ATENÇÃO
         ═══════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Bairros que exigem atenção</CardTitle>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/macae">
              Análise Macaé-RJ <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {neighborhoods.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
              ))}
            </div>
          ) : neighborhoods.isError ? (
            <ErrorState
              title="Erro ao carregar dados de bairros"
              message="Não foi possível obter o ranking de bairros."
              onRetry={() => neighborhoods.refetch()}
              showApiHint={false}
            />
          ) : !neighborhoods.data || neighborhoods.data.length === 0 ? (
            <EmptyState message="Sem dados de bairros disponíveis." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Bairro</TableHead>
                    <TableHead className="w-16 text-center">Obras</TableHead>
                    <TableHead className="w-20 text-center">Score médio</TableHead>
                    <TableHead className="w-20 text-center">Críticas</TableHead>
                    <TableHead className="w-20 text-center">Atrasadas</TableHead>
                    <TableHead className="min-w-[120px] text-right">Valor total</TableHead>
                    <TableHead className="min-w-[200px]">Recomendação</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {neighborhoods.data.map((n) => (
                    <TableRow
                      key={n.bairro}
                      className={n.obras_criticas > 0 ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="font-medium">{n.bairro}</TableCell>
                      <TableCell className="text-center tabular-nums">{n.obras}</TableCell>
                      <TableCell className="text-center">
                        <ScoreBadge score={n.score_medio} showLabel={false} />
                      </TableCell>
                      <TableCell className="text-center">
                        {n.obras_criticas > 0 ? (
                          <span className="font-semibold text-destructive">{n.obras_criticas}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {n.obras_atrasadas > 0 ? (
                          <span className="font-semibold text-orange-600">{n.obras_atrasadas}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {fmtBRL(n.valor_total)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{n.recomendacao}</span>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/macae">
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

      {/* ═══════════════════════════════════════════════════════════════════
          6. FORNECEDORES QUE MERECEM REVISÃO
         ═══════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Fornecedores que merecem revisão</CardTitle>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/fornecedores">
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {suppliers.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
              ))}
            </div>
          ) : suppliers.isError ? (
            <ErrorState
              title="Erro ao carregar dados de fornecedores"
              message="Não foi possível obter o ranking de fornecedores."
              onRetry={() => suppliers.refetch()}
              showApiHint={false}
            />
          ) : !suppliers.data || suppliers.data.length === 0 ? (
            <EmptyState message="Sem dados de fornecedores disponíveis." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Fornecedor</TableHead>
                    <TableHead className="w-20 text-center">Contratos</TableHead>
                    <TableHead className="min-w-[120px] text-right">Valor total</TableHead>
                    <TableHead className="w-20 text-center">Score médio</TableHead>
                    <TableHead className="w-20 text-center">Críticas</TableHead>
                    <TableHead className="w-16 text-center">Alertas</TableHead>
                    <TableHead className="min-w-[200px]">Recomendação</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.data.map((f) => (
                    <TableRow
                      key={f.fornecedor}
                      className={f.obras_criticas > 0 ? "bg-destructive/5" : ""}
                    >
                      <TableCell>
                        <span className="max-w-[200px] truncate font-medium">{f.fornecedor}</span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{f.contratos}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {fmtBRL(f.valor_total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <ScoreBadge score={f.score_medio} showLabel={false} />
                      </TableCell>
                      <TableCell className="text-center">
                        {f.obras_criticas > 0 ? (
                          <span className="font-semibold text-destructive">{f.obras_criticas}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {f.alertas_totais > 0 ? (
                          <span className="font-semibold text-orange-600">{f.alertas_totais}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{f.recomendacao}</span>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/fornecedores">
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

      {/* ═══════════════════════════════════════════════════════════════════
          7. RECOMENDAÇÕES EXECUTIVAS
         ═══════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <CardTitle className="text-base">Recomendações executivas</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3 transition hover:bg-muted/30"
              >
                <SeverityDot severity={rec.severity} />
                <span className="text-sm text-foreground">{rec.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── Modal de detalhes da obra ── */}
      <ObraDetailModal
        obraId={modalObraId}
        open={!!modalObraId}
        onOpenChange={(open) => {
          if (!open) setModalObraId(null);
        }}
      />
    </div>
  );
}
