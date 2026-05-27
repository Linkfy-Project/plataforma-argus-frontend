import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock, Database, PlayCircle, RefreshCcw, Timer, Activity, Server, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { Button } from "@/components/ui/button";
import { etlService, worksService } from "@/lib/api";
import { formatDateBR } from "@/lib/format";
import { normalizeApiError } from "@/lib/score";
import type { SyncStatus } from "@/types";

export const Route = createFileRoute("/_app/etl")({
  head: () => ({ meta: [{ title: "ETL e Atualização de Dados — ARGUS" }] }),
  component: EtlPage,
});

function EtlPage() {
  const qc = useQueryClient();
  const status = useQuery<SyncStatus>({
    queryKey: ["etl", "sync-status"],
    queryFn: () => etlService.syncStatus(),
  });

  const invalidateAll = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["etl"] }),
      qc.invalidateQueries({ queryKey: ["works"] }),
      qc.invalidateQueries({ queryKey: ["analytics"] }),
      qc.invalidateQueries({ queryKey: ["rankings"] }),
      qc.invalidateQueries({ queryKey: ["map"] }),
      qc.invalidateQueries({ queryKey: ["alerts"] }),
      qc.invalidateQueries({ queryKey: ["scoring-rules"] }),
    ]);

  const wrap = <T,>(fn: () => Promise<T>, msgs: { loading: string; success: string }) =>
    useMutation({
      mutationFn: async () => {
        const tid = toast.loading(msgs.loading);
        try {
          const r = await fn();
          toast.success(msgs.success, { id: tid });
          await invalidateAll();
          return r;
        } catch (err) {
          toast.error(normalizeApiError(err), { id: tid });
          throw err;
        }
      },
    });

  const syncAll = wrap(
    () => etlService.syncPublicData({ municipio: "Macae" }),
    { loading: "Sincronização em andamento...", success: "Dados públicos sincronizados com sucesso." },
  );
  const tcerj = wrap(
    () => etlService.runTcerj({ municipio: "Macae" }),
    { loading: "Extraindo dados do TCE-RJ...", success: "Extração TCE-RJ concluída." },
  );
  const macae = wrap(
    () => etlService.runMacaePortal(),
    { loading: "Importando Portal da Transparência de Macaé...", success: "Importação do Portal de Macaé concluída." },
  );
  const recompute = wrap(
    () => worksService.recomputeAll(),
    { loading: "Recalculando todos os índices ARGUS...", success: "Recalculo do Índice ARGUS concluído." },
  );

  if (status.isLoading) return <LoadingState rows={5} />;
  if (status.isError) return <ErrorState onRetry={() => status.refetch()} />;

  const s = status.data ?? {};
  const anyRunning =
    syncAll.isPending || tcerj.isPending || macae.isPending || recompute.isPending;

  return (
    <div>
      <PageHeader
        title="Atualização de Dados e ETL"
        description="Pipeline de sincronização dos dados públicos do TCE-RJ e do Portal da Transparência de Macaé. O backend executa uma primeira sincronização ao iniciar e agenda novas atualizações a cada 15 dias."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => status.refetch()}
            disabled={status.isFetching}
          >
            <RefreshCcw className="mr-1 h-4 w-4" /> Atualizar status
          </Button>
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
          value={formatDateBR(s.next_run_time)}
          icon={CalendarClock}
          tone="accent"
          helper={s.time_left ?? "Sem previsão"}
        />
        <StatCard
          label="Última leitura"
          value={formatDateBR(s.now)}
          icon={Activity}
          tone="primary"
          helper="Hora do servidor"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Button
          className="h-auto justify-start gap-3 bg-primary py-3 hover:bg-primary/90"
          onClick={() => syncAll.mutate()}
          disabled={anyRunning}
        >
          <PlayCircle className="h-5 w-5" />
          <div className="text-left">
            <p className="text-sm font-semibold">Sincronização completa</p>
            <p className="text-xs opacity-80">POST /etl/sync-public-data</p>
          </div>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
          onClick={() => tcerj.mutate()}
          disabled={anyRunning}
        >
          <Server className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-semibold">Extrair TCE-RJ</p>
            <p className="text-xs text-muted-foreground">POST /etl/tcerj/run</p>
          </div>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
          onClick={() => macae.mutate()}
          disabled={anyRunning}
        >
          <Building2 className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-semibold">Portal de Macaé</p>
            <p className="text-xs text-muted-foreground">POST /etl/macae-portal/run</p>
          </div>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
          onClick={() => recompute.mutate()}
          disabled={anyRunning}
        >
          <Activity className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-semibold">Recalcular índices</p>
            <p className="text-xs text-muted-foreground">POST /works/recompute-all</p>
          </div>
        </Button>
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