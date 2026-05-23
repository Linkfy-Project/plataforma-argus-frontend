import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { LoadingState, EmptyState } from "@/components/argus/EmptyState";
import { Progress } from "@/components/ui/progress";
import { municipiosService } from "@/lib/api";
import { fmtBRL, fmtNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/municipios")({
  head: () => ({ meta: [{ title: "Municípios — Plataforma Argus" }] }),
  component: MunicipiosPage,
});

function MunicipiosPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["municipios"], queryFn: () => import("@/lib/api").then((m) => m.municipiosService.list()) });

  if (isLoading) return <LoadingState />;
  const list = data ?? [];
  if (list.length === 0) return <EmptyState message="Nenhum município encontrado." />;

  return (
    <div>
      <PageHeader
        title="Municípios"
        description="Cobertura, volume de obras e eficiência por município monitorado."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => (
          <button
            key={m.id}
            onClick={() => navigate({ to: "/obras", search: { mun: m.nome } as never })}
            className="text-left rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{m.nome}</h3>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{m.total_obras} obras</span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Em andamento</dt>
                <dd className="font-medium text-foreground">{fmtNumber(m.obras_em_andamento)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Concluídas</dt>
                <dd className="font-medium text-foreground">{fmtNumber(m.obras_concluidas)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Com alerta</dt>
                <dd className="font-medium text-destructive">{fmtNumber(m.obras_com_alerta)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Valor total</dt>
                <dd className="font-medium text-foreground">{fmtBRL(m.valor_total)}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Eficiência</span>
                <span className="font-medium text-foreground">{m.eficiencia}%</span>
              </div>
              <Progress value={m.eficiencia} className="h-2" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}