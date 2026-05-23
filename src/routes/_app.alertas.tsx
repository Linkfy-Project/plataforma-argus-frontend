import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { AlertBadge } from "@/components/argus/AlertBadge";
import { LoadingState, EmptyState } from "@/components/argus/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { alertasService } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { AlertaNivel } from "@/types";

export const Route = createFileRoute("/_app/alertas")({
  head: () => ({ meta: [{ title: "Alertas — Plataforma Argus" }] }),
  component: AlertasPage,
});

const NIVEIS: AlertaNivel[] = ["Baixo", "Médio", "Alto", "Crítico"];

function AlertasPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alertas"],
    queryFn: () => alertasService.list(),
  });
  const [nivel, setNivel] = useState<string>("todos");

  const list = (data ?? []).filter((a) => nivel === "todos" || a.nivel === nivel);

  return (
    <div>
      <PageHeader
        title="Alertas e Riscos"
        description="Eventos detectados automaticamente que requerem atenção dos gestores."
        actions={
          <Select value={nivel} onValueChange={setNivel}>
            <SelectTrigger className="w-44 bg-card"><SelectValue placeholder="Nível" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os níveis</SelectItem>
              {NIVEIS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      {isLoading ? <LoadingState /> : list.length === 0 ? (
        <EmptyState message="Nenhum alerta registrado." />
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <AlertBadge nivel={a.nivel} />
                      <span className="text-xs text-muted-foreground">{fmtDate(a.data_deteccao)}</span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{a.titulo}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{a.obra_nome}</span> · {a.municipio}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{a.descricao}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-border bg-background/60 p-3 md:max-w-xs">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ação sugerida</p>
                  <p className="mt-1 text-sm text-foreground">{a.acao_sugerida}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}