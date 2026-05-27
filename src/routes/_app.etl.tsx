import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Database, PlayCircle, RefreshCcw, Timer, Activity } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { Button } from "@/components/ui/button";
import { etlService, worksService } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { normalizeApiError } from "@/lib/score";

export const Route = createFileRoute("/_app/etl")({
  head: () => ({ meta: [{ title: "ETL e Atualização de Dados — ARGUS" }] }),
  component: EtlPage,
});

interface SyncStatus {
  scheduled?: boolean;
  job_id?: string;
  timezone?: string;
  now?: string;
  next_run_time?: string;
  seconds_left?: number;
  time_left?: string;
}

function EtlPage() {
  const qc = useQueryClient();
  const status = useQuery<SyncStatus>({ queryKey: ["etl", "status"], queryFn: () => etlService.syncStatus() });

  const runMutation = useMutation({
    mutationFn: () => etlService.runSync({ municipio: "Macae" }),
    onSuccess: async () => {
      toast.success("ETL executado com sucesso. Atualizando dados...");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["etl"] }),
        qc.invalidateQueries({ queryKey: ["works"] }),
        qc.invalidateQueries({ queryKey: ["obras"] }),
        qc.invalidateQueries({ queryKey: ["summary"] }),
        qc.invalidateQueries({ queryKey: ["municipios"] }),
      ]);
    },
    onError: (err) => toast.error(normalizeApiError(err)),
  });

  const recomputeMutation = useMutation({
    mutationFn: () => worksService.recomputeAll(),
    onSuccess: async () => {
      toast.success("Recalculo do Índice ARGUS concluído.");
      await qc.invalidateQueries();
    },
    onError: (err) => toast.error(normalizeApiError(err)),
  });

  if (status.isLoading) return <LoadingState rows={5} />;
  if (status.isError) return <ErrorState onRetry={() => status.refetch()} />;

  const s = status.data ?? {};

  return (
    <div>
      <PageHeader
        title="ETL — Atualização de Dados"
        description="Pipeline de sincronização dos dados públicos (TCE-RJ e Portal da Transparência de Macaé)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => status.refetch()}
              disabled={status.isFetching}
            >
              <RefreshCcw className="mr-1 h-4 w-4" /> Atualizar status
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => recomputeMutation.mutate()}
              disabled={recomputeMutation.isPending}
            >
              <Activity className="mr-1 h-4 w-4" />
              {recomputeMutation.isPending ? "Recalculando..." : "Recalcular índices"}
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
            >
              <PlayCircle className="mr-1 h-4 w-4" />
              {runMutation.isPending ? "Executando ETL..." : "Executar ETL agora"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Agendador"
          value={s.scheduled ? "Ativo" : "Inativo"}
          icon={Database}
          tone={s.scheduled ? "success" : "danger"}
          helper="Execução automática"
        />
        <StatCard
          label="Frequência"
          value="a cada 15 dias"
          icon={Timer}
          tone="primary"
          helper="Política de atualização ARGUS"
        />
        <StatCard
          label="Próxima execução"
          value={s.next_run_time ? fmtDate(s.next_run_time) : "—"}
          icon={CalendarClock}
          tone="accent"
          helper={s.time_left ?? "Sem previsão"}
        />
        <StatCard
          label="Última leitura"
          value={s.now ? fmtDate(s.now) : "—"}
          icon={Activity}
          tone="primary"
          helper="Hora do servidor"
        />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Pipeline de sincronização ARGUS</h3>
        <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
          <li>1. Extração dos dados do <strong className="text-foreground">TCE-RJ</strong> para o município de Macaé.</li>
          <li>2. Extração dos dados do <strong className="text-foreground">Portal da Transparência de Macaé</strong>.</li>
          <li>3. Importação consolidada dos CSVs para o banco analítico.</li>
          <li>4. Recálculo do Índice Composto de Eficiência ARGUS e detecção de alertas.</li>
        </ol>
        <p className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Job: <code className="font-mono">{s.job_id ?? "public_data_sync"}</code> · Fuso horário: {s.timezone ?? "America/Sao_Paulo"}
        </p>
      </div>
    </div>
  );
}