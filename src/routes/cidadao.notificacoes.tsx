import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Bell, AlertTriangle, Clock, MapPin, ExternalLink } from "lucide-react";
import { alertasService } from "@/lib/api";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cidadao/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Portal do Cidadão" }] }),
  component: CidadaoNotificacoes,
});

const nivelConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  Crítico: {
    label: "Crítico",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
  },
  Alto: {
    label: "Alto",
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
  },
};

function CidadaoNotificacoes() {
  const {
    data: alertas,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["cidadao-notificacoes"],
    queryFn: () => alertasService.list(),
    staleTime: 2 * 60_000,
  });

  // Filtrar apenas Alto e Crítico
  const filteredAlertas = useMemo(() => {
    if (!alertas) return [];
    return alertas.filter((a) => a.nivel === "Alto" || a.nivel === "Crítico");
  }, [alertas]);

  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
          <Bell className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            Alertas recentes que requerem atenção — obras com risco alto ou crítico.
          </p>
        </div>
      </div>

      {/* Contador */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {filteredAlertas.length > 0 ? (
            <>
              <span className="font-semibold text-foreground">{filteredAlertas.length}</span> alerta
              {filteredAlertas.length > 1 ? "s" : ""} de nível{" "}
              <span className="font-medium text-destructive">Alto</span> ou{" "}
              <span className="font-medium text-destructive">Crítico</span> encontrado
              {filteredAlertas.length > 1 ? "s" : ""}
            </>
          ) : (
            "Nenhum alerta de nível Alto ou Crítico no momento."
          )}
        </p>
      </div>

      {/* Lista de alertas */}
      {filteredAlertas.length === 0 ? (
        <EmptyState
          message="Nenhuma notificação urgente"
          hint="Todas as obras estão dentro dos parâmetros aceitáveis no momento."
        />
      ) : (
        <div className="space-y-4">
          {filteredAlertas.map((alerta) => {
            const cfg = nivelConfig[alerta.nivel] ?? nivelConfig["Alto"];
            return (
              <article
                key={alerta.id}
                className={cn(
                  "rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md",
                  cfg.border,
                )}
              >
                {/* Linha superior: nivel + data */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      cfg.bg,
                      cfg.color,
                    )}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {cfg.label}
                  </span>
                  {alerta.data_deteccao && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {fmtDate(alerta.data_deteccao)}
                    </span>
                  )}
                </div>

                {/* Titulo */}
                <h3 className="mt-3 text-base font-semibold text-foreground">{alerta.titulo}</h3>

                {/* Descricao */}
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {alerta.descricao}
                </p>

                {/* Obra + Municipio */}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {alerta.obra_nome && (
                    <span className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {alerta.obra_nome}
                    </span>
                  )}
                  {alerta.municipio && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {alerta.municipio}
                    </span>
                  )}
                </div>

                {/* Acao sugerida */}
                {alerta.acao_sugerida && (
                  <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-foreground">Ação sugerida:</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {alerta.acao_sugerida}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
