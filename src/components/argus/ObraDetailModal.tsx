import { useQuery } from "@tanstack/react-query";
import { Building, Calendar, MapPin, Wallet, HardHat } from "lucide-react";
import { obrasService } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { fmtBRL, fmtDate } from "@/lib/format";
import { getSemaforo } from "@/lib/semaforo";
import { cn } from "@/lib/utils";

interface ObraDetailModalProps {
  obraId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ObraDetailModal({ obraId, open, onOpenChange }: ObraDetailModalProps) {
  const { data: obra, isLoading } = useQuery({
    queryKey: ["cidadao-modal-obra", obraId],
    queryFn: () => obrasService.get(obraId!),
    enabled: !!obraId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        {/* Header fixo */}
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {obra ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="break-words text-base font-semibold">
                      {obra.nome}
                    </DialogTitle>
                    <StatusBadge status={obra.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Código: {obra.id}
                    {obra.numero_contrato && <> · Contrato: {obra.numero_contrato}</>}
                  </p>
                </>
              ) : (
                <DialogTitle className="text-base font-semibold">
                  {isLoading ? "Carregando..." : "Detalhes da obra"}
                </DialogTitle>
              )}
            </div>
            {/* Badge de semáforo no cabeçalho */}
            {obra?.eficiencia != null &&
              (() => {
                const s = getSemaforo(obra.eficiencia);
                return (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold shrink-0",
                      s.bg,
                      s.color,
                    )}
                  >
                    <span>{s.emoji}</span>
                    {s.label}
                  </span>
                );
              })()}
          </div>
        </DialogHeader>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !obra ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <HardHat className="mb-2 h-8 w-8" />
              <p>Obra não encontrada.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Descrição */}
              <p className="break-words text-sm leading-relaxed text-muted-foreground">
                {obra.descricao || "Descrição não disponível para esta obra."}
              </p>

              {/* Informações gerais */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard icon={MapPin} label="Município" value={obra.municipio} />
                <InfoCard
                  icon={Building}
                  label="Órgão responsável"
                  value={obra.orgao_responsavel || "—"}
                />
                <InfoCard
                  icon={Building}
                  label="Construtora"
                  value={obra.empresa_contratada || "—"}
                />
                <InfoCard icon={Calendar} label="Início" value={fmtDate(obra.data_inicio)} />
                <InfoCard
                  icon={Calendar}
                  label="Previsão de Entrega"
                  value={fmtDate(obra.data_fim_prevista)}
                />
              </div>

              {/* Financeiro */}
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Financeiro
                  </h4>
                </div>
                <div className="space-y-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Custo Total Previsto
                    </p>
                    <p className="break-all text-sm font-semibold tabular-nums text-foreground">
                      {fmtBRL(obra.valor_contratado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Quanto já foi pago
                    </p>
                    <p className="break-all text-sm font-semibold tabular-nums text-foreground">
                      {fmtBRL(obra.valor_executado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Saldo restante
                    </p>
                    <p className="break-all text-sm font-semibold tabular-nums text-foreground">
                      {fmtBRL(obra.valor_contratado - obra.valor_executado)}
                    </p>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-semibold text-foreground">
                      {obra.valor_contratado > 0
                        ? Math.round((obra.valor_executado / obra.valor_contratado) * 100)
                        : (obra.percentual_execucao ?? 0)}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      obra.valor_contratado > 0
                        ? (obra.valor_executado / obra.valor_contratado) * 100
                        : (obra.percentual_execucao ?? 0)
                    }
                    className="h-2.5"
                  />
                </div>
              </div>

              {/* Execução física (mantida) */}
              {obra.percentual_execucao != null && (
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <HardHat className="h-4 w-4 shrink-0 text-primary" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      Execução física
                    </h4>
                  </div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-semibold text-foreground">
                      {Math.round(obra.percentual_execucao)}%
                    </span>
                  </div>
                  <Progress value={obra.percentual_execucao} className="h-2" />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border border-border bg-background/60 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}
