import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { Progress } from "@/components/ui/progress";
import { analyticsService, type InterMunicipalData } from "@/lib/api";
import { fmtBRL, fmtNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/municipios")({
  head: () => ({ meta: [{ title: "Municípios — Plataforma Argus" }] }),
  component: MunicipiosPage,
});

/** Retorna a cor CSS para o risco de atraso baseado no valor (0-1) */
function delayRiskColor(risk: number): string {
  if (risk < 0.2) return "text-green-600";
  if (risk < 0.4) return "text-yellow-600";
  return "text-red-600";
}

/** Retorna a cor de fundo da barra de risco */
function delayRiskBarColor(risk: number): string {
  if (risk < 0.2) return "bg-green-500";
  if (risk < 0.4) return "bg-yellow-500";
  return "bg-red-500";
}

function MunicipiosPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", "inter-municipal"],
    queryFn: () => analyticsService.interMunicipal(),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  const list: InterMunicipalData[] = data ?? [];
  if (list.length === 0) return <EmptyState message="Nenhum município encontrado." />;

  return (
    <div>
      <PageHeader
        title="Municípios"
        description="Cobertura, volume de obras, eficiência e risco de atraso por município monitorado."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => {
          const eff = Math.round(m.avg_score);
          const riskPercent = Math.round(m.avg_delay_risk * 100);

          return (
            <button
              key={m.municipio}
              onClick={() => navigate({ to: "/obras" })}
              className="text-left rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              {/* Cabeçalho: nome + total de obras */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{m.municipio}</h3>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {fmtNumber(m.total_works)} obras
                </span>
              </div>

              {/* Grid de métricas */}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Eficiência</dt>
                  <dd className="font-medium text-foreground">{eff}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valor total</dt>
                  <dd className="font-medium text-foreground">{fmtBRL(m.total_value)}</dd>
                </div>
              </dl>

              {/* Barra de eficiência */}
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Eficiência</span>
                  <span className="font-medium text-foreground">{eff}%</span>
                </div>
                <Progress value={eff} className="h-2" />
              </div>

              {/* Risco de atraso */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Risco de atraso</span>
                  <span className={`font-medium ${delayRiskColor(m.avg_delay_risk)}`}>
                    {riskPercent}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${delayRiskBarColor(m.avg_delay_risk)}`}
                    style={{ width: `${riskPercent}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
