import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  HardHat,
  Gauge,
  Wallet,
  AlertTriangle,
  MapPin,
  TrendingUp,
  TrendingDown,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { worksService, analyticsService, alertasService } from "@/lib/api";
import { ObraDetailModal } from "@/components/argus/ObraDetailModal";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { PredictiveRiskIndicator } from "@/components/argus/PredictiveRiskBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fmtBRL, fmtNumber } from "@/lib/format";
import { getRiskLevel, getScoreHex, ARGUS_PILLARS } from "@/lib/score";

export const Route = createFileRoute("/cidadao/painel")({
  head: () => ({ meta: [{ title: "Painel — Portal do Cidadão" }] }),
  component: CidadaoPainel,
});

const RISK_COLORS: Record<string, string> = {
  Baixo: "#22C55E",
  Atenção: "#F59E0B",
  Alto: "#F97316",
  Crítico: "#DC2626",
  Indefinido: "#94A3B8",
};

function CidadaoPainel() {
  const queryClient = useQueryClient();
  const [modalObraId, setModalObraId] = React.useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["painel-summary"],
    queryFn: () => analyticsService.summary(),
    staleTime: 2 * 60_000,
  });

  const works = useQuery({
    queryKey: ["painel-works"],
    queryFn: () => worksService.listAll({}),
    staleTime: 2 * 60_000,
  });

  const rankings = useQuery({
    queryKey: ["painel-rankings", 5],
    queryFn: () => analyticsService.rankings(5),
    staleTime: 2 * 60_000,
  });

  const alertas = useQuery({
    queryKey: ["painel-alertas"],
    queryFn: () => alertasService.list(),
    staleTime: 2 * 60_000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["painel"] });
    summary.refetch();
    works.refetch();
    rankings.refetch();
    alertas.refetch();
  };

  if (summary.isLoading || works.isLoading) {
    return <LoadingState rows={8} />;
  }
  if (summary.isError) {
    return <ErrorState onRetry={() => summary.refetch()} />;
  }

  const s = summary.data!;
  const ws = works.data ?? [];
  const alerts = alertas.data ?? [];
  const valorTotal = ws.reduce((acc, w) => acc + (w.contract_value ?? 0), 0);
  const valorPago = ws.reduce((acc, w) => acc + (w.paid_value ?? w.settled_value ?? 0), 0);
  const criticos = alerts.filter((a) => a.nivel === "Crítico" || a.nivel === "Alto").length;

  // Status counts
  const emAndamento = ws.filter((w) => !w.finished_at && (w.status ?? "") !== "Planejada").length;
  const concluidas = ws.filter((w) => !!w.finished_at).length;
  const atrasadas = ws.filter((w) => {
    if (w.finished_at) return false;
    return w.due_at ? new Date(w.due_at) < new Date() : false;
  }).length;
  const paralisadas = ws.filter((w) => (w.status ?? "").toLowerCase().includes("paralis")).length;
  const planejadas = ws.filter((w) => w.status === "Planejada").length;

  const statusData = [
    { name: "Em andamento", value: emAndamento, color: "#3B82F6" },
    { name: "Concluídas", value: concluidas, color: "#22C55E" },
    { name: "Planejadas", value: planejadas, color: "#94A3B8" },
    { name: "Atrasadas", value: atrasadas, color: "#F59E0B" },
    { name: "Paralisadas", value: paralisadas, color: "#DC2626" },
  ].filter((d) => d.value > 0);

  const riscoBuckets = ["Baixo", "Atenção", "Alto", "Crítico"].map((label) => ({
    label,
    total: ws.filter((w) => getRiskLevel(w.efficiency_score) === label).length,
  }));

  const scoreDist = [
    { faixa: "Crítico (0–39)", total: ws.filter((w) => (w.efficiency_score ?? 0) < 40).length, color: "#DC2626" },
    { faixa: "Alto (40–59)", total: ws.filter((w) => (w.efficiency_score ?? 0) >= 40 && (w.efficiency_score ?? 0) < 60).length, color: "#F97316" },
    { faixa: "Atenção (60–79)", total: ws.filter((w) => (w.efficiency_score ?? 0) >= 60 && (w.efficiency_score ?? 0) < 80).length, color: "#F59E0B" },
    { faixa: "Bom (80–100)", total: ws.filter((w) => (w.efficiency_score ?? 0) >= 80).length, color: "#22C55E" },
  ];

  // Predictive risks
  const withRisk = ws.filter((w) => w.risk_delay_probability != null);
  const avgDelayRisk = withRisk.length > 0 ? withRisk.reduce((s, w) => s + (w.risk_delay_probability ?? 0), 0) / withRisk.length : 0;
  const avgCostRisk = withRisk.length > 0 ? withRisk.reduce((s, w) => s + (w.risk_cost_probability ?? 0), 0) / withRisk.length : 0;
  const avgReworkRisk = withRisk.length > 0 ? withRisk.reduce((s, w) => s + (w.risk_rework_probability ?? 0), 0) / withRisk.length : 0;
  const highRiskCount = ws.filter((w) => (w.risk_delay_probability ?? 0) >= 0.7 || (w.risk_cost_probability ?? 0) >= 0.7 || (w.risk_rework_probability ?? 0) >= 0.7).length;

  // Execution overview
  const avgExecution = ws.length > 0 ? ws.reduce((s, w) => {
    const cv = w.contract_value ?? 0;
    if (!cv) return s;
    const pv = w.paid_value ?? w.settled_value ?? w.committed_value ?? 0;
    return s + Math.min(100, (pv / cv) * 100);
  }, 0) / ws.length : 0;

  // Best ranked
  const bestRanked = rankings.data?.best ?? [];
  // Worst ranked
  const worstRanked = rankings.data?.worst ?? [];

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

  const municipioData = useMemo(() => {
    const map = new Map<string, { works: number; valor: number; scoreSum: number; scoreCount: number }>();
    for (const w of ws) {
      const m = w.municipio || "—";
      const existing = map.get(m) || { works: 0, valor: 0, scoreSum: 0, scoreCount: 0 };
      existing.works += 1;
      existing.valor += w.contract_value ?? 0;
      if (w.efficiency_score != null) {
        existing.scoreSum += w.efficiency_score;
        existing.scoreCount += 1;
      }
      map.set(m, existing);
    }
    return Array.from(map.entries())
      .map(([nome, d]) => ({
        nome,
        works: d.works,
        valor: d.valor,
        scoreMedio: d.scoreCount > 0 ? Math.round(d.scoreSum / d.scoreCount) : 0,
      }))
      .sort((a, b) => b.works - a.works)
      .slice(0, 8);
  }, [ws]);

  return (
    <div className="space-y-6">
      <ObraDetailModal
        obraId={modalObraId}
        open={!!modalObraId}
        onOpenChange={(open) => { if (!open) setModalObraId(null); }}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Obras Públicas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do monitoramento de obras públicas — dados atualizados automaticamente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="shrink-0">
          <RefreshCw className={`mr-2 h-4 w-4 ${works.isFetching ? "animate-spin" : ""}`} />
          Atualizar dados
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={HardHat} label="Total de obras" value={fmtNumber(s.total_works)} detail={`${emAndamento} em andamento, ${concluidas} concluídas`} color="text-primary" />
        <KpiCard icon={Gauge} label="Eficiência média" value={`${Math.round(s.average_efficiency_score)} / 100`} detail={s.average_efficiency_score >= 70 ? "Situação boa" : s.average_efficiency_score >= 50 ? "Atenção necessária" : "Situação crítica"} color={s.average_efficiency_score >= 70 ? "text-[color:var(--success)]" : s.average_efficiency_score >= 50 ? "text-[color:var(--warning)]" : "text-destructive"} />
        <KpiCard icon={Wallet} label="Investimento total" value={fmtBRL(valorTotal)} detail={`Execução média: ${Math.round(avgExecution)}%`} color="text-foreground" />
        <KpiCard icon={AlertTriangle} label="Alertas críticos" value={fmtNumber(criticos)} detail={`${highRiskCount} obras com alto risco IA`} color={criticos > 0 ? "text-destructive" : "text-[color:var(--success)]"} />
      </div>

      {/* Status + Execution Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Status Pie */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Situação das obras</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [`${v} obra(s)`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Execution Summary */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Execução financeira</h3>
          <div className="space-y-4 mt-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Valor executado</span>
                <span className="font-semibold tabular-nums">{fmtBRL(valorPago)}</span>
              </div>
              <Progress value={valorTotal > 0 ? (valorPago / valorTotal) * 100 : 0} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">
                {valorTotal > 0 ? Math.round((valorPago / valorTotal) * 100) : 0}% de {fmtBRL(valorTotal)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg bg-background/50 p-3 text-center">
                <p className="text-lg font-bold text-[color:var(--success)] tabular-nums">{concluidas}</p>
                <p className="text-[10px] text-muted-foreground">Concluídas</p>
              </div>
              <div className="rounded-lg bg-background/50 p-3 text-center">
                <p className="text-lg font-bold text-[color:var(--warning)] tabular-nums">{atrasadas}</p>
                <p className="text-[10px] text-muted-foreground">Atrasadas</p>
              </div>
              <div className="rounded-lg bg-background/50 p-3 text-center">
                <p className="text-lg font-bold text-destructive tabular-nums">{paralisadas}</p>
                <p className="text-[10px] text-muted-foreground">Paralisadas</p>
              </div>
              <div className="rounded-lg bg-background/50 p-3 text-center">
                <p className="text-lg font-bold text-primary tabular-nums">{planejadas}</p>
                <p className="text-[10px] text-muted-foreground">Planejadas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Predictive Risks Summary */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Riscos preditivos (IA)</h3>
          <p className="text-xs text-muted-foreground mb-4">Média das probabilidades de risco calculadas pela IA.</p>
          <div className="space-y-4">
            <RiskSummary label="Atraso" value={avgDelayRisk} count={ws.filter((w) => (w.risk_delay_probability ?? 0) >= 0.7).length} />
            <RiskSummary label="Estouro de custo" value={avgCostRisk} count={ws.filter((w) => (w.risk_cost_probability ?? 0) >= 0.7).length} />
            <RiskSummary label="Retrabalho" value={avgReworkRisk} count={ws.filter((w) => (w.risk_rework_probability ?? 0) >= 0.7).length} />
          </div>
          <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">{highRiskCount}</strong> obra(s) com risco ≥ 70% em pelo menos um indicador.
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Risk Distribution */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Distribuição por nível de risco</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Quantas obras estão em cada faixa de risco segundo o índice ARGUS.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riscoBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} obra(s)`, "Quantidade"]} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {riscoBuckets.map((d) => (
                    <Cell key={d.label} fill={RISK_COLORS[d.label]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Distribution Pie */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Qualidade das obras (Score)</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Distribuição do score de eficiência — quanto mais verde, melhor.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreDist.filter((d) => d.total > 0)}
                  dataKey="total"
                  nameKey="faixa"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  label={({ faixa, total }) => `${faixa}: ${total}`}
                >
                  {scoreDist.map((d) => (
                    <Cell key={d.faixa} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [`${v} obra(s)`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Index Composition */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Como funciona o Índice ARGUS</h3>
        <p className="text-xs text-muted-foreground mb-4">
          O score de cada obra é calculado com base em 5 pilares. Quanto maior o peso, mais impacta na nota final.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {ARGUS_PILLARS.map((p) => (
            <div key={p.key} className="rounded-lg border border-border bg-background/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{Math.round(p.weight * 100)}%</p>
              <Progress value={p.weight * 100} className="mt-2 h-1.5" />
            </div>
          ))}
        </div>
      </div>

      {/* Best + Worst ranked */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Obras com melhor score */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-[color:var(--success)]" /> Obras com melhor score
          </div>
          {!bestRanked.length ? (
            <p className="text-sm text-muted-foreground">Sem ranking disponível.</p>
          ) : (
            <ul className="divide-y divide-border">
              {bestRanked.slice(0, 5).map((w) => {
                const fullWork = ws.find((fw) => fw.id === w.id);
                return (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <button type="button" onClick={() => setModalObraId(String(w.id))}
                      className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-primary text-left cursor-pointer">
                      {w.object_description}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={fullWork?.status ?? ""} />
                      <ScoreBadge score={w.efficiency_score ?? 0} showLabel={false} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Obras mais críticas */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" /> Obras mais críticas
          </div>
          {!worstRanked.length ? (
            <p className="text-sm text-muted-foreground">Sem ranking disponível.</p>
          ) : (
            <ul className="divide-y divide-border">
              {worstRanked.slice(0, 5).map((w) => {
                const fullWork = ws.find((fw) => fw.id === w.id);
                return (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <button type="button" onClick={() => setModalObraId(String(w.id))}
                      className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-primary text-left cursor-pointer">
                      {w.object_description}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
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
      </div>

      {/* Rankings + Constructores */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                    <button
                      type="button"
                      onClick={() => setModalObraId(String(w.id))}
                      className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-primary text-left cursor-pointer"
                    >
                      {w.object_description}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
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

        {/* Construtoras recorrentes */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-[color:var(--success)]" /> Construtoras mais recorrentes
          </div>
          {contratadoTop.length === 0 ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {contratadoTop.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                    <span className="truncate font-medium text-foreground">{c.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{c.total} contratos</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Municípios */}
      {municipioData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" /> Obras por município
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Município</th>
                  <th className="pb-2 pr-4 font-medium text-center">Obras</th>
                  <th className="pb-2 pr-4 font-medium text-right">Investimento</th>
                  <th className="pb-2 font-medium text-center">Score médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {municipioData.map((m) => (
                  <tr key={m.nome} className="hover:bg-muted/30">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{m.nome}</td>
                    <td className="py-2.5 pr-4 text-center tabular-nums">{m.works}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{fmtBRL(m.valor)}</td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <Progress value={m.scoreMedio} className="h-2 w-20" />
                        <span className="tabular-nums text-xs w-8 text-right">{m.scoreMedio}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent alerts */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" /> Alertas recentes
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/cidadao/notificacoes">
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta registrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.obra_nome} — {a.municipio}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{a.data_deteccao ? new Date(a.data_deteccao).toLocaleDateString("pt-BR") : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-wrap gap-3 justify-center pt-2">
        <Button asChild>
          <Link to="/cidadao/obras">Ver todas as obras</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/cidadao/transparencia">Portal da Transparência</Link>
        </Button>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, detail, color }: { icon: typeof HardHat; label: string; value: string; detail: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}

function RiskSummary({ label, value, count }: { label: string; value: number; count: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      {count > 0 && (
        <p className="text-[10px] text-destructive mt-0.5">{count} obra(s) com risco alto</p>
      )}
    </div>
  );
}

import React from "react";
