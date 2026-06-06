import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  HardHat,
  Activity,
  Wallet,
  AlertTriangle,
  Gauge,
  MapPin,
  ArrowRight,
  Trophy,
  TrendingDown,
  TrendingUp,
  BookOpen,
  Clock,
  Siren,
  Building2,
  ExternalLink,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/argus/PageHeader";
import { PredictiveRiskIndicator } from "@/components/argus/PredictiveRiskBadge";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { ObraDetailModal } from "@/components/argus/ObraDetailModal";
import { analyticsService, worksService, etlService } from "@/lib/api";
import { fmtBRL, fmtNumber, formatDateBR } from "@/lib/format";
import { ARGUS_PILLARS, getRiskLevel, getScoreHex } from "@/lib/score";
import type { SyncStatus } from "@/types";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Painel — ARGUS Macaé-RJ" }] }),
  component: DashboardPage,
});

const RISK_COLORS: Record<string, string> = {
  Baixo: "#22C55E",
  Atenção: "#F59E0B",
  Alto: "#F97316",
  Crítico: "#DC2626",
  Indefinido: "#94A3B8",
};

function DashboardPage() {
  const [modalObraId, setModalObraId] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["analytics", "summary", { municipio: "macae" }],
    queryFn: () => analyticsService.summary({ municipio: "macae" }),
  });
  const works = useQuery({
    queryKey: ["works", { municipio: "macae" }],
    queryFn: () => worksService.listAll({ municipio: "macae" }),
  });
  const rankings = useQuery({
    queryKey: ["analytics", "rankings", 5],
    queryFn: () => analyticsService.rankings(5),
  });
  const etl = useQuery<SyncStatus>({
    queryKey: ["etl", "sync-status"],
    queryFn: () => etlService.syncStatus(),
  });
  const trends = useQuery({
    queryKey: ["analytics", "trends", { municipio: "macae" }],
    queryFn: () => analyticsService.trends({ municipio: "macae" }),
  });

  if (summary.isLoading || works.isLoading) {
    return <LoadingState rows={8} />;
  }
  if (summary.isError) {
    return <ErrorState onRetry={() => summary.refetch()} />;
  }
  const s = summary.data!;
  const ws = works.data ?? [];
  const valorTotal = ws.reduce((acc, w) => acc + (w.contract_value ?? 0), 0);
  const valorPago = ws.reduce((acc, w) => acc + (w.paid_value ?? w.settled_value ?? 0), 0);
  const valorSaldo = valorTotal - valorPago;
  const pctExecutado = valorTotal > 0 ? Math.round((valorPago / valorTotal) * 100) : 0;

  /* ── Dados derivados existentes ── */
  const riscoBuckets = ["Baixo", "Atenção", "Alto", "Crítico"].map((label) => ({
    label,
    total: ws.filter((w) => getRiskLevel(w.efficiency_score) === label).length,
  }));

  const scoreDist = [
    { faixa: "0–39", total: ws.filter((w) => (w.efficiency_score ?? 0) < 40).length },
    {
      faixa: "40–59",
      total: ws.filter((w) => (w.efficiency_score ?? 0) >= 40 && (w.efficiency_score ?? 0) < 60)
        .length,
    },
    {
      faixa: "60–79",
      total: ws.filter((w) => (w.efficiency_score ?? 0) >= 60 && (w.efficiency_score ?? 0) < 80)
        .length,
    },
    { faixa: "80–100", total: ws.filter((w) => (w.efficiency_score ?? 0) >= 80).length },
  ];

  const contratadoTop = Object.entries(
    ws.reduce<Record<string, number>>((acc, w) => {
      const name = w.contractor_name?.trim();
      if (!name) return acc;
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  /* ── Construtoras com score médio ── */
  const contratadaComScore = Object.entries(
    ws.reduce<Record<string, { total: number; scoreSum: number }>>((acc, w) => {
      const name = w.contractor_name?.trim();
      if (!name) return acc;
      if (!acc[name]) acc[name] = { total: 0, scoreSum: 0 };
      acc[name].total += 1;
      acc[name].scoreSum += w.efficiency_score ?? 0;
      return acc;
    }, {}),
  )
    .map(([name, data]) => ({ name, total: data.total, avgScore: Math.round(data.scoreSum / data.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  /* ── Dados novos: Fila de Prioridade ── */
  const obrasCriticas = ws
    .filter((w) => (w.efficiency_score ?? 100) < 40)
    .sort((a, b) => (a.efficiency_score ?? 0) - (b.efficiency_score ?? 0))
    .slice(0, 5);

  const hoje = new Date();
  const obrasAtrasadas = ws
    .filter((w) => {
      if (!w.due_at || w.finished_at) return false;
      return new Date(w.due_at) < hoje;
    })
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    .slice(0, 5);

  const totalAlertasCriticos = ws.reduce((acc, w) => {
    return acc + (w.alerts?.filter((a) => a.severity === "critical" || a.severity === "alert").length ?? 0);
  }, 0);

  /* ── Municípios com mais investimento ── */
  const municipiosInvestimento = Object.entries(
    ws.reduce<Record<string, number>>((acc, w) => {
      const mun = w.municipio?.trim();
      if (!mun) return acc;
      acc[mun] = (acc[mun] ?? 0) + (w.contract_value ?? 0);
      return acc;
    }, {}),
  )
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const etlData = etl.data ?? {};

  return (
    <div>
      <PageHeader
        title="Painel ARGUS — Eficiência de Obras Públicas em Macaé-RJ"
        description="Monitoramento de contratos, prazos, custos, alertas e risco de obras públicas com base no Índice ARGUS."
        actions={
          <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Foco: <strong className="text-foreground">Macaé-RJ</strong> · Hackathon Duopen
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO 1: Visão Geral — 4 StatCards principais
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Obras monitoradas"
          value={fmtNumber(s.total_works)}
          icon={HardHat}
          tone="primary"
          helper="Contratos sob análise"
        />
        <StatCard
          label="Score ARGUS médio"
          value={`${Math.round(s.average_efficiency_score)} / 100`}
          icon={Gauge}
          tone="success"
          helper="Eficiência composta"
        />
        <StatCard
          label="Obras atrasadas"
          value={fmtNumber(s.delayed_works)}
          icon={Activity}
          tone="warning"
          helper="Acima da tolerância de 90 dias"
        />
        <StatCard
          label="Valor contratado total"
          value={fmtBRL(valorTotal)}
          icon={Wallet}
          tone="accent"
          helper="Somatório dos contratos"
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO 8 (compacta): Barra de KPIs Secundários
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card/60 px-5 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Última atualização: <strong className="text-foreground">{formatDateBR(etlData.now)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Próxima: <strong className="text-foreground">{formatDateBR(etlData.next_run_time)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          Pipeline:{" "}
          <strong className={etlData.scheduled ? "text-[color:var(--success)]" : "text-[color:var(--warning)]"}>
            {etlData.scheduled ? "Ativo" : "Inativo"}
          </strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Siren className="h-3.5 w-3.5 text-destructive" />
          Alertas críticos: <strong className="text-destructive">{fmtNumber(totalAlertasCriticos)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          Valor pago: <strong className="text-foreground">{fmtBRL(valorPago)}</strong>
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO 2: Fila de Prioridade
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 rounded-xl border-2 border-orange-500/40 bg-orange-500/5 p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">🚨</span>
          <h2 className="text-base font-bold text-foreground">Ações Requeridas — Fila de Prioridade</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Obras Críticas */}
          <div className="rounded-lg border border-destructive/30 bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">{"Obras Críticas (Score < 40)"}</h3>
            </div>
            {obrasCriticas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma obra com score crítico.</p>
            ) : (
              <ul className="space-y-2">
                {obrasCriticas.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setModalObraId(String(w.id))}
                        className="block w-full truncate text-left font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {w.object_description}
                      </button>
                      <p className="mt-0.5 text-xs text-muted-foreground">{w.municipio}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ScoreBadge score={w.efficiency_score ?? 0} showLabel={false} />
                      <Link
                        to="/obras/$id"
                        params={{ id: String(w.id) }}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Obras Atrasadas */}
          <div className="rounded-lg border border-orange-500/30 bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-orange-600">Obras Atrasadas</h3>
            </div>
            {obrasAtrasadas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma obra atrasada detectada.</p>
            ) : (
              <ul className="space-y-2">
                {obrasAtrasadas.map((w) => {
                  const diasAtraso = Math.floor(
                    (hoje.getTime() - new Date(w.due_at!).getTime()) / (1000 * 60 * 60 * 24),
                  );
                  return (
                    <li key={w.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setModalObraId(String(w.id))}
                          className="block w-full truncate text-left font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {w.object_description}
                        </button>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {w.municipio} · <span className="text-orange-500 font-medium">{diasAtraso} dias de atraso</span>
                        </p>
                      </div>
                      <Link
                        to="/obras/$id"
                        params={{ id: String(w.id) }}
                        className="shrink-0 text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Alertas Críticos */}
          <div className="rounded-lg border border-yellow-500/30 bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <Siren className="h-4 w-4 text-yellow-600" />
              <h3 className="text-sm font-semibold text-yellow-700">Alertas Críticos</h3>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <p className="text-4xl font-bold text-destructive tabular-nums">{fmtNumber(totalAlertasCriticos)}</p>
              <p className="text-xs text-muted-foreground">alertas de severidade crítica ou alto</p>
              <Button asChild variant="outline" size="sm">
                <Link to="/alertas">
                  Ver todos os alertas <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO 3: Execução Orçamentária
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Execução Orçamentária</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Valor Total Contratado</p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{fmtBRL(valorTotal)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Valor Pago / Executado</p>
            <p className="mt-1 text-2xl font-bold text-[color:var(--success)] tabular-nums">{fmtBRL(valorPago)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Saldo Restante</p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{fmtBRL(valorSaldo)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">% Executado</p>
            <p className="mt-1 text-2xl font-bold text-primary tabular-nums">{pctExecutado}%</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className="font-medium text-foreground">{pctExecutado}% do orçamento contratado já foi executado</span>
            <span>100%</span>
          </div>
          <Progress value={pctExecutado} className="h-4 rounded-full" />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO 4: Gráficos — Distribuição por Risco + Faixa de Score
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Distribuição por nível de risco ARGUS
            </h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/obras">
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riscoBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {riscoBuckets.map((d) => (
                    <Cell key={d.label} fill={RISK_COLORS[d.label]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Faixa de score ARGUS</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreDist}
                  dataKey="total"
                  nameKey="faixa"
                  innerRadius={45}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {scoreDist.map((d) => (
                    <Cell key={d.faixa} fill={getScoreHex(parseInt(d.faixa))} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO 5: Análise de Performance — 3 cards
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Obras mais críticas */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" /> Obras mais críticas
          </div>
          {!rankings.data?.worst?.length ? (
            <p className="text-sm text-muted-foreground">Sem ranking disponível.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rankings.data.worst.slice(0, 5).map((w) => {
                const fullWork = ws.find((fw) => fw.id === w.id);
                return (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link
                      to="/obras/$id"
                      params={{ id: String(w.id) }}
                      className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-primary"
                    >
                      {w.object_description}
                    </Link>
                    <div className="flex items-center gap-2">
                      <PredictiveRiskIndicator
                        delayProbability={fullWork?.risk_delay_probability}
                        costProbability={fullWork?.risk_cost_probability}
                        reworkProbability={fullWork?.risk_rework_probability}
                      />
                      <ScoreBadge score={w.efficiency_score ?? 0} showLabel={false} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Construtoras mais recorrentes + score médio */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-[color:var(--success)]" /> Construtoras mais recorrentes
          </div>
          {contratadaComScore.length === 0 ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {contratadaComScore.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">{c.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ScoreBadge score={c.avgScore} showLabel={false} />
                    <span className="text-xs text-muted-foreground">{c.total} contratos</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Municípios com mais investimento */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-accent" /> Municípios com mais investimento
          </div>
          {municipiosInvestimento.length === 0 ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {municipiosInvestimento.map((m, i) => (
                <li key={m.nome} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-xs font-semibold text-accent">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">{m.nome}</span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{fmtBRL(m.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO 6: Composição do Índice ARGUS
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Composição do Índice ARGUS</h3>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/metodologia">
              Ver metodologia completa <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {ARGUS_PILLARS.map((p) => (
            <div key={p.key} className="rounded-lg border border-border bg-background/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                {Math.round(p.weight * 100)}%
              </p>
              <Progress value={p.weight * 100} className="mt-2 h-1.5" />
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO 7: Tendência Temporal
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          Evolução do Score ARGUS ao longo do tempo
        </div>
        {!trends.data?.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem dados de tendência disponíveis.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const [y, m] = v.split("-");
                    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
                    return `${meses[Number(m) - 1]}/${y.slice(2)}`;
                  }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(v: string) => {
                    const [y, m] = v.split("-");
                    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
                    return `${meses[Number(m) - 1]} de ${y}`;
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      avg_score: "Score médio",
                      count: "Obras",
                      total_value: "Valor total",
                    };
                    if (name === "total_value") return [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, labels[name] ?? name];
                    return [value, labels[name] ?? name];
                  }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_score"
                  stroke="#287BBE"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#287BBE" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Modal de detalhes da obra ── */}
      <ObraDetailModal
        obraId={modalObraId}
        open={!!modalObraId}
        onOpenChange={(open) => { if (!open) setModalObraId(null); }}
      />
    </div>
  );
}
