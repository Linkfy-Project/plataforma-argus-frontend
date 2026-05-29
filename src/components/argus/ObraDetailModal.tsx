import { useQuery } from "@tanstack/react-query";
import {
  Building,
  Calendar,
  FileText,
  MapPin,
  Wallet,
  ShieldAlert,
  HardHat,
} from "lucide-react";
import { obrasService } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { PredictiveRiskBadge } from "@/components/argus/PredictiveRiskBadge";
import type { RiskCategory } from "@/components/argus/PredictiveRiskBadge";
import { fmtBRL, fmtDate } from "@/lib/format";

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
      <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Header fixo */}
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {obra ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-base font-semibold break-words">
                      {obra.nome}
                    </DialogTitle>
                    <StatusBadge status={obra.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
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
            <div className="flex items-center gap-2 shrink-0">
              {obra?.eficiencia != null && <ScoreBadge score={obra.eficiencia} showLabel={false} />}
            </div>
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
              <HardHat className="h-8 w-8 mb-2" />
              <p>Obra não encontrada.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Descrição */}
              <p className="text-sm leading-relaxed text-muted-foreground break-words">
                {obra.descricao || "Descrição não disponível para esta obra."}
              </p>

              {/* Informações gerais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoCard icon={MapPin} label="Município" value={obra.municipio} />
                <InfoCard icon={Building} label="Órgão responsável" value={obra.orgao_responsavel || "—"} />
                <InfoCard icon={FileText} label="Contratada" value={obra.empresa_contratada || "—"} />
                <InfoCard icon={Calendar} label="Início" value={fmtDate(obra.data_inicio)} />
                <InfoCard icon={Calendar} label="Previsão" value={fmtDate(obra.data_fim_prevista)} />
              </div>

              {/* Financeiro */}
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="h-4 w-4 text-primary shrink-0" />
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Financeiro
                  </h4>
                </div>
                <div className="space-y-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Contratado</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums break-all">{fmtBRL(obra.valor_contratado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Executado</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums break-all">{fmtBRL(obra.valor_executado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums break-all">{fmtBRL(obra.valor_contratado - obra.valor_executado)}</p>
                  </div>
                </div>
              </div>

              {/* Execução física */}
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <HardHat className="h-4 w-4 text-primary shrink-0" />
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Execução física
                  </h4>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-semibold text-foreground">{Math.round(obra.percentual_execucao)}%</span>
                </div>
                <Progress value={obra.percentual_execucao} className="h-2" />
              </div>

              {/* Riscos preditivos */}
              {(obra.risco_atraso != null || obra.risco_custo != null || obra.risco_retrabalho != null) && (
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      Riscos Preditivos (IA)
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {obra.risco_atraso != null && (
                      <RiskBar label="Atraso" probability={obra.risco_atraso} category="delay" />
                    )}
                    {obra.risco_custo != null && (
                      <RiskBar label="Custo" probability={obra.risco_custo} category="cost" />
                    )}
                    {obra.risco_retrabalho != null && (
                      <RiskBar label="Retrabalho" probability={obra.risco_retrabalho} category="rework" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-3 min-w-0">
      <Icon className="mt-0.5 h-4 w-4 text-primary shrink-0" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground truncate" title={value}>{value}</p>
      </div>
    </div>
  );
}

function RiskBar({ label, probability, category }: { label: string; probability: number; category: RiskCategory }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1 gap-2">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <PredictiveRiskBadge category={category} probability={probability} compact />
      </div>
      <Progress value={probability * 100} className="h-1.5" />
    </div>
  );
}
