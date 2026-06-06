import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HardHat, Gauge, TrendingUp, Wallet, ArrowRight, ShieldCheck } from "lucide-react";
import { analyticsService, dashboardService } from "@/lib/api";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { Button } from "@/components/ui/button";
import { fmtBRL, fmtNumber } from "@/lib/format";

export const Route = createFileRoute("/cidadao/")({
  head: () => ({ meta: [{ title: "Portal do Cidadão — ARGUS" }] }),
  component: CidadaoIndex,
});

function CidadaoIndex() {
  const summary = useQuery({
    queryKey: ["cidadao-summary"],
    queryFn: () => analyticsService.summary(),
    staleTime: 5 * 60_000,
  });

  const dashboard = useQuery({
    queryKey: ["cidadao-dashboard"],
    queryFn: () => dashboardService.getSummary(),
    staleTime: 5 * 60_000,
  });

  if (summary.isLoading || dashboard.isLoading) return <LoadingState rows={4} />;
  if (summary.isError) return <ErrorState onRetry={() => summary.refetch()} />;

  const s = summary.data;
  const d = dashboard.data;

  return (
    <div className="space-y-8">
      {/* Hero / Boas-vindas */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Portal de Transparência — Obras Públicas de Macaé
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Acompanhe como os recursos públicos estão sendo investidos em obras de
              infraestrutura no município de Macaé-RJ. O ARGUS monitora cada obra com
              indicadores de eficiência, prazo e custo para garantir transparência total.
            </p>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Indicadores gerais</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Obras monitoradas"
            value={fmtNumber(s?.total_works ?? d?.total_obras ?? 0)}
            helper="Total de obras cadastradas"
            icon={HardHat}
            tone="primary"
          />
          <StatCard
            label="Score médio ARGUS"
            value={Math.round(s?.average_efficiency_score ?? d?.eficiencia_media ?? 0)}
            helper="Índice de eficiência (0–100)"
            icon={Gauge}
            tone="success"
          />
          <StatCard
            label="Em andamento"
            value={fmtNumber(d?.obras_em_andamento ?? 0)}
            helper="Obras em execução ativa"
            icon={TrendingUp}
            tone="warning"
          />
          <StatCard
            label="Valor total investido"
            value={fmtBRL(d?.valor_total_contratado ?? 0)}
            helper="Soma de todos os contratos"
            icon={Wallet}
            tone="accent"
          />
        </div>
      </section>

      {/* Resumo rápido */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Obras concluídas</h3>
          <p className="mt-1 text-2xl font-bold text-[color:var(--success)]">
            {fmtNumber(d?.obras_concluidas ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Entregues com sucesso</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Alertas críticos</h3>
          <p className="mt-1 text-2xl font-bold text-destructive">
            {fmtNumber(s?.critical_alerts ?? d?.alertas_criticos ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Requerem atenção imediata</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Municípios monitorados</h3>
          <p className="mt-1 text-2xl font-bold text-primary">
            {fmtNumber(d?.municipios_monitorados ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Regiões com obras ativas</p>
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center md:p-8">
        <h2 className="text-lg font-semibold text-foreground">Explore as obras públicas</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Veja detalhes de cada obra, incluindo valores, prazos e o score de eficiência ARGUS.
        </p>
        <Button asChild size="lg" className="gap-2">
          <Link to="/cidadao/obras">
            Ver obras <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
