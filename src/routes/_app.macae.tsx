import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  HardHat,
  Wallet,
  Gauge,
  AlertTriangle,
  Trophy,
  TrendingDown,
} from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/argus/EmptyState";
import { analyticsService, worksService } from "@/lib/api";
import { fmtBRL, fmtNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/macae")({
  head: () => ({ meta: [{ title: "Análise Territorial — Macaé" }] }),
  component: MacaePage,
});

const MUNICIPIO = "Macae";
const MUNICIPIO_LABEL = "Macaé-RJ";

/**
 * Normaliza o nome do município removendo acentos, convertendo para
 * minúsculas e removendo sufixos como "-RJ". Isso permite comparar
 * nomes que vêm do backend com variações (ex: "Macaé", "Macaé-RJ", "Macae").
 */
function normalizeMunicipio(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*-\s*rj$/, "")
    .trim();
}

function MacaePage() {
  const summary = useQuery({
    queryKey: ["analytics", "summary", MUNICIPIO],
    queryFn: () => analyticsService.summary({ municipio: MUNICIPIO }),
  });
  const works = useQuery({
    queryKey: ["works", MUNICIPIO],
    queryFn: () => worksService.listAll({ municipio: MUNICIPIO }),
  });
  const rankings = useQuery({
    queryKey: ["rankings", MUNICIPIO],
    queryFn: () => analyticsService.rankings(10),
  });

  if (summary.isLoading || works.isLoading) return <LoadingState rows={6} />;
  if (summary.isError) return <ErrorState onRetry={() => summary.refetch()} />;

  const s = summary.data!;
  const ws = works.data ?? [];
  const totalValor = ws.reduce((acc, w) => acc + (w.contract_value ?? 0), 0);
  const totalAlertas = ws.reduce((acc, w) => acc + (w.alerts?.length ?? 0), 0);

  // Filtra rankings usando normalização para aceitar variações de acento/sufixo
  const bestMacae = (rankings.data?.best ?? []).filter((w) => normalizeMunicipio(w.municipio) === normalizeMunicipio(MUNICIPIO));
  const worstMacae = (rankings.data?.worst ?? []).filter((w) => normalizeMunicipio(w.municipio) === normalizeMunicipio(MUNICIPIO));

  return (
    <div>
      <PageHeader
        title={`Análise Microterritorial — ${MUNICIPIO_LABEL}`}
        description="Recorte aprofundado da execução de obras públicas no município de Macaé-RJ, polo offshore e maior volume de contratos públicos da região norte fluminense."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Obras monitoradas"
          value={fmtNumber(s.total_works)}
          icon={HardHat}
          tone="primary"
        />
        <StatCard
          label="Eficiência média"
          value={`${Math.round(s.average_efficiency_score)}%`}
          icon={Gauge}
          tone="success"
        />
        <StatCard
          label="Obras atrasadas"
          value={fmtNumber(s.delayed_works)}
          icon={Building2}
          tone="warning"
        />
        <StatCard
          label="Alertas críticos"
          value={fmtNumber(s.critical_alerts)}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard label="Valor contratado" value={fmtBRL(totalValor)} icon={Wallet} tone="accent" />
        <StatCard label="Alertas totais" value={fmtNumber(totalAlertas)} icon={AlertTriangle} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-[color:var(--success)]" />
            Obras com melhor desempenho
          </div>
          {bestMacae.length === 0 ? (
            <EmptyState message="Sem ranking disponível para Macaé." />
          ) : (
            <ul className="divide-y divide-border">
              {bestMacae.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate pr-3 font-medium text-foreground">
                    {w.object_description}
                  </span>
                  <span className="text-xs font-semibold text-[color:var(--success)]">
                    {Math.round(w.efficiency_score ?? 0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Obras de maior risco
          </div>
          {worstMacae.length === 0 ? (
            <EmptyState message="Sem ranking disponível para Macaé." />
          ) : (
            <ul className="divide-y divide-border">
              {worstMacae.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate pr-3 font-medium text-foreground">
                    {w.object_description}
                  </span>
                  <span className="text-xs font-semibold text-destructive">
                    {Math.round(w.efficiency_score ?? 0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
