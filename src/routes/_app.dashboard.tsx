import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  BookOpen,
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
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
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
  const summary = useQuery({
    queryKey: ["analytics", "summary", { municipio: "macae" }],
    queryFn: () => analyticsService.summary({ municipio: "macae" }),
  });
  const works = useQuery({
    queryKey: ["works", { municipio: "macae", limit: 1000 }],
    queryFn: () => worksService.list({ municipio: "macae", limit: 1000 }),
  });
  const rankings = useQuery({
    queryKey: ["analytics", "rankings", 5],
    queryFn: () => analyticsService.rankings(5),
  });
  const etl = useQuery<SyncStatus>({
    queryKey: ["etl", "sync-status"],
    queryFn: () => etlService.syncStatus(),
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

  const riscoBuckets = ["Baixo", "Atenção", "Alto", "Crítico"].map((label) => ({
    label,
    total: ws.filter((w) => getRiskLevel(w.efficiency_score) === label).length,
  }));

  const scoreDist = [
    { faixa: "0–39", total: ws.filter((w) => (w.efficiency_score ?? 0) < 40).length },
    {
      faixa: "40–59",
      total: ws.filter((w) => (w.efficiency_score ?? 0) >= 40 && (w.efficiency_score ?? 0) < 60).length,
    },
    {
      faixa: "60–79",
      total: ws.filter((w) => (w.efficiency_score ?? 0) >= 60 && (w.efficiency_score ?? 0) < 80).length,
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
          label="Alertas críticos"
          value={fmtNumber(s.critical_alerts)}
          icon={AlertTriangle}
          tone="danger"
          helper="Risco alto detectado"
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
        <StatCard
          label="Valor liquidado/pago"
          value={fmtBRL(valorPago)}
          icon={Wallet}
          tone="primary"
          helper="Execução financeira"
        />
        <StatCard
          label="Próxima atualização"
          value={formatDateBR(etlData.next_run_time)}
          icon={Activity}
          helper={etlData.time_left ?? "ETL a cada 15 dias"}
        />
        <StatCard
          label="Pipeline ETL"
          value={etlData.scheduled ? "Ativo" : "—"}
          icon={Activity}
          tone={etlData.scheduled ? "success" : "warning"}
          helper="Sincronização automática"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Distribuição por nível de risco ARGUS</h3>
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" /> Obras mais críticas
          </div>
          {!rankings.data?.worst?.length ? (
            <p className="text-sm text-muted-foreground">Sem ranking disponível.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rankings.data.worst.slice(0, 5).map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link
                    to="/obras/$id"
                    params={{ id: String(w.id) }}
                    className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-primary"
                  >
                    {w.object_description}
                  </Link>
                  <ScoreBadge score={w.efficiency_score ?? 0} showLabel={false} />
                </li>
              ))}
            </ul>
          )}
        </div>

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
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">{c.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.total} contratos</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
