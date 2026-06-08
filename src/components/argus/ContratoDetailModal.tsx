import { FileText, Building, MapPin, Calendar, Wallet, CheckCircle2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ContratoStatusBadge } from "@/components/argus/StatusBadge";
import { fmtBRL, fmtDate } from "@/lib/format";
import type { Contrato } from "@/types";

interface ContratoDetailModalProps {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContratoDetailModal({ contrato, open, onOpenChange }: ContratoDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Header fixo */}
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {contrato ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="break-words text-lg font-bold">
                      {contrato.numero}
                    </DialogTitle>
                    <ContratoStatusBadge status={contrato.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">Obra: {contrato.obra_nome}</p>
                </>
              ) : (
                <DialogTitle className="text-base font-semibold">Detalhes do contrato</DialogTitle>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {!contrato ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <FileText className="mb-2 h-8 w-8" />
              <p>Contrato não encontrado.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Seção A: Informações do Contrato */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Informações do Contrato
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoCard icon={FileText} label="Número do Contrato" value={contrato.numero} />
                  <InfoCard icon={Building} label="Obra Vinculada" value={contrato.obra_nome} />
                  <InfoCard icon={MapPin} label="Município" value={contrato.municipio} />
                  <InfoCard icon={Building} label="Empresa Contratada" value={contrato.empresa} />
                  <InfoCard
                    icon={Calendar}
                    label="Data de Assinatura"
                    value={fmtDate(contrato.data_assinatura)}
                  />
                </div>
              </div>

              {/* Seção B: Valores Financeiros */}
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Valores Financeiros
                  </h4>
                </div>
                <div className="space-y-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Valor Contratado
                    </p>
                    <p className="break-all text-lg font-bold tabular-nums text-foreground">
                      {fmtBRL(contrato.valor_contratado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Valor Executado
                    </p>
                    <p className="break-all text-sm font-semibold tabular-nums text-foreground">
                      {fmtBRL(contrato.valor_executado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Saldo Restante
                    </p>
                    <p className="break-all text-sm font-semibold tabular-nums text-foreground">
                      {fmtBRL(contrato.valor_contratado - contrato.valor_executado)}
                    </p>
                  </div>
                </div>

                {/* Barra de progresso financeiro */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Execução Financeira</span>
                    <span className="font-semibold text-foreground">
                      {contrato.valor_contratado > 0
                        ? Math.round((contrato.valor_executado / contrato.valor_contratado) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      contrato.valor_contratado > 0
                        ? (contrato.valor_executado / contrato.valor_contratado) * 100
                        : 0
                    }
                    className="h-2.5"
                  />
                </div>
              </div>

              {/* Seção C: Status e Prazos */}
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  {contrato.status === "Vigente" ? (
                    <Clock className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--success)]" />
                  )}
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Status e Prazos
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Status Atual
                      </p>
                      <div className="mt-1">
                        <ContratoStatusBadge status={contrato.status} />
                      </div>
                    </div>
                  </div>
                  <InfoCard
                    icon={Calendar}
                    label="Data de Assinatura"
                    value={fmtDate(contrato.data_assinatura)}
                  />
                </div>
                <div className="mt-3">
                  {contrato.status === "Vigente" ? (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <Clock className="h-4 w-4 shrink-0 text-primary" />
                      <p className="text-sm text-primary">
                        Este contrato está <strong>em execução</strong>.
                      </p>
                    </div>
                  ) : contrato.status === "Encerrado" ? (
                    <div className="flex items-center gap-2 rounded-lg border border-[color:var(--success)]/20 bg-[color:var(--success)]/5 p-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--success)]" />
                      <p className="text-sm text-[color:var(--success)]">
                        Este contrato foi <strong>finalizado</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-3">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Status: {contrato.status}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-componente auxiliar                                                     */
/* -------------------------------------------------------------------------- */

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
