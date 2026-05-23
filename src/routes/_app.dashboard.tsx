import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  HardHat, Activity, CheckCircle2, OctagonAlert, Wallet, Building2, AlertTriangle, Gauge,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { dashboardService, obrasService, municipiosService } from "@/lib/api";
import { fmtBRL, fmtNumber, fmtPct } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Plataforma Argus" }] }),
  component: DashboardPage,
});

const STATUS_COLORS: Record<string, string> = {
  "Em andamento": "#287BBE",
  "Concluída": "#22C55E",
  "Planejada": "#94A3B8",
  "Atrasada": "#F59E0B",
  "Paralisada": "#DC2626",
};

function DashboardPage() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: dashboardService.getSummary });
  const obras = useQuery({ queryKey: ["obras"], queryFn: () => obrasService.list() });
  const municipios = useQuery({ queryKey: ["municipios"], queryFn: municipiosService.list });

  if (summary.isLoading || obras.isLoading) {
    return <LoadingState rows={8} />;
  }
  if (summary.isError) {
    return <ErrorState onRetry={() => summary.refetch()} />;
  }
  const s = summary.data!;
  const obrasData = obras.data ?? [];
  const munisData = (municipios.data ?? []).slice().sort((a, b) => b.total_obras - a.total_obras);

  const statusData = ["Planejada", "Em andamento", "Concluída", "Atrasada", "Paralisada"].map((st) => ({
    status: st,
    total: obrasData.filter((o) => o.status === st).length,
  }));

  const munisChart = munisData.slice(0, 6).map((m) => ({ name: m.nome, value: m.total_obras }));
  const palette = ["#287BBE", "#38A5DB", "#06162F", "#22C55E", "#F59E0B", "#64748B"];

  const evolucao = Array.from({ length: 6 }).map((_, i) => ({
    mes: ["Jul", "Ago", "Set", "Out", "Nov", "Dez"][i],
    contratado: Math.round((s.valor_total_contratado / 6) * (0.8 + i * 0.05)),
    executado: Math.round((s.valor_total_contratado / 6) * (0.4 + i * 0.07)),
  }));

  return (
    <div>
      <PageHeader title="Painel Geral" description="Visão consolidada das obras públicas monitoradas no estado do Rio de Janeiro." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de obras" value={fmtNumber(s.total_obras)} icon={HardHat} helper="Cadastradas na plataforma" />
        <StatCard label="Obras em andamento" value={fmtNumber(s.obras_em_andamento)} icon={Activity} tone="primary" helper="Execução ativa" />
        <StatCard label="Obras concluídas" value={fmtNumber(s.obras_concluidas)} icon={CheckCircle2} tone="success" helper="Entregues à população" />
        <StatCard label="Obras paralisadas" value={fmtNumber(s.obras_paralisadas)} icon={OctagonAlert} tone="danger" helper="Requerem ação" />
        <StatCard label="Valor total contratado" value={fmtBRL(s.valor_total_contratado)} icon={Wallet} tone="accent" helper="Soma dos contratos vigentes" />
        <StatCard label="Municípios monitorados" value={fmtNumber(s.municipios_monitorados)} icon={Building2} tone="primary" helper="Cobertura no estado" />
        <StatCard label="Alertas críticos" value={fmtNumber(s.alertas_criticos)} icon={AlertTriangle} tone="warning" helper="Risco alto ou crítico" />
        <StatCard label="Execução média" value={fmtPct(s.percentual_medio_execucao)} icon={Gauge} tone="success" helper="Média ponderada" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Obras por status</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {statusData.map((d) => (
                    <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Distribuição por município</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={munisChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {munisChart.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Evolução dos valores (últimos meses)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="contratado" stroke="#06162F" strokeWidth={2} name="Contratado" />
                <Line type="monotone" dataKey="executado" stroke="#287BBE" strokeWidth={2} name="Executado" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Municípios com mais obras</h3>
          <ul className="divide-y divide-border">
            {munisData.slice(0, 7).map((m, i) => (
              <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="font-medium text-foreground">{m.nome}</span>
                </div>
                <span className="text-muted-foreground">{m.total_obras} obras</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}