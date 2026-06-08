import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Database,
  PlayCircle,
  RefreshCcw,
  Timer,
  Activity,
  Server,
  Building2,
  Brain,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { etlService, worksService, mlService } from "@/lib/api";
import { formatDateBR, fmtBRL } from "@/lib/format";
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

  const useEtlMutation = <T,>(fn: () => Promise<T>, msgs: { loading: string; success: string }) =>
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

  const syncAll = useEtlMutation(() => etlService.syncPublicData({ municipio: "Macae" }), {
    loading: "Sincronização em andamento...",
    success: "Dados públicos sincronizados com sucesso.",
  });
  const tcerj = useEtlMutation(() => etlService.runTcerj({ municipio: "Macae" }), {
    loading: "Extraindo dados do TCE-RJ...",
    success: "Extração TCE-RJ concluída.",
  });
  const macae = useEtlMutation(() => etlService.runMacaePortal(), {
    loading: "Importando Portal da Transparência de Macaé...",
    success: "Importação do Portal de Macaé concluída.",
  });
  const recompute = useEtlMutation(() => worksService.recomputeAll(), {
    loading: "Recalculando todos os índices ARGUS...",
    success: "Recalculo do Índice ARGUS concluído.",
  });
  const mlRetrain = useEtlMutation(() => mlService.retrainReal(), {
    loading: "Retreinando modelo ML com dados reais...",
    success: "Modelo ML retreinado com sucesso.",
  });

  /* ── Tabela de referência SINAPI ── */
  const sinapi = useQuery({
    queryKey: ["etl", "sinapi-benchmarks"],
    queryFn: () => etlService.sinapiBenchmarks(),
    staleTime: 30 * 60_000, // cache por 30 minutos (dados trimestrais)
  });

  /* ── Índice IPCA (correção inflacionária) ── */
  const ipca = useQuery({
    queryKey: ["etl", "ipca-index"],
    queryFn: () => etlService.ipcaIndex(),
    staleTime: 60 * 60_000, // cache por 1 hora
  });

  if (status.isLoading) return <LoadingState rows={5} />;
  if (status.isError) return <ErrorState onRetry={() => status.refetch()} />;

  const s = status.data ?? {};
  const anyRunning =
    syncAll.isPending ||
    tcerj.isPending ||
    macae.isPending ||
    recompute.isPending ||
    mlRetrain.isPending;

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

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
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
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
          onClick={() => mlRetrain.mutate()}
          disabled={anyRunning}
        >
          <Brain className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-semibold">Retreinar Modelo ML</p>
            <p className="text-xs text-muted-foreground">POST /ml/retrain-real</p>
          </div>
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Pipeline de sincronização ARGUS</h3>
        <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
          <li>
            1. Extração dos dados do <strong className="text-foreground">TCE-RJ</strong> para o
            município de Macaé.
          </li>
          <li>
            2. Extração dos dados do{" "}
            <strong className="text-foreground">Portal da Transparência de Macaé</strong>.
          </li>
          <li>3. Importação consolidada dos CSVs para o banco analítico.</li>
          <li>4. Recálculo do Índice Composto de Eficiência ARGUS e detecção de alertas.</li>
        </ol>
        <p className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Job: <code className="font-mono">{s.job_id ?? "public_data_sync"}</code> · Fuso horário:{" "}
          {s.timezone ?? "America/Sao_Paulo"}
        </p>
      </div>

      {/* ── Tabela de Referência SINAPI ── */}
      {sinapi.data && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Tabela de Referência SINAPI</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Fonte: {sinapi.data.source} · Região: {sinapi.data.region} · Referência:{" "}
            {sinapi.data.reference_date}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Obra</TableHead>
                <TableHead className="text-right">Custo R$/m²</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(sinapi.data.benchmarks).map(([tipo, custo]) => (
                <TableRow key={tipo}>
                  <TableCell className="font-medium capitalize">
                    {tipo.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtBRL(custo as number)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Correção Inflacionária (IPCA) ── */}
      {ipca.data && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Correção Inflacionária (IPCA)</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Fonte: {ipca.data.source} · Série: {ipca.data.series}
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            O sistema aplica correção inflacionária pelo IPCA para comparar justamente obras de
            diferentes anos. Valores são corrigidos para a data atual antes de comparar com o
            benchmark SINAPI.
          </p>
          {/* Mostrar últimos 5 índices se disponíveis */}
          {ipca.data.index && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(ipca.data.index)
                .slice(-5)
                .map(([date, value]) => (
                  <span
                    key={date}
                    className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                  >
                    {date}: <strong>{Number(value).toFixed(2)}</strong>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
