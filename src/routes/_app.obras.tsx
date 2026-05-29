import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Search, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { EmptyState, LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { ObraDetailModal } from "@/components/argus/ObraDetailModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { obrasService, analyticsService } from "@/lib/api";
import { PredictiveRiskIndicator } from "@/components/argus/PredictiveRiskBadge";
import { fmtBRL, fmtDate, fmtPct } from "@/lib/format";
import type { ObraStatus } from "@/types";

export const Route = createFileRoute("/_app/obras")({
  head: () => ({ meta: [{ title: "Obras — Plataforma Argus" }] }),
  component: ObrasPage,
});

const STATUSES: ObraStatus[] = ["Planejada", "Em andamento", "Concluída", "Atrasada", "Paralisada"];
const PAGE_SIZES = [10, 25, 50, 100];

/** Converte bucket de score em parâmetros min_score/max_score/has_score. */
function scoreBucketParams(bucket: string) {
  switch (bucket) {
    case "baixo":
      return { min_score: 80 };
    case "atencao":
      return { min_score: 60, max_score: 79 };
    case "alto":
      return { min_score: 40, max_score: 59 };
    case "critico":
      return { max_score: 39 };
    case "sem":
      return { has_score: false as const };
    default:
      return {};
  }
}

function ObrasPage() {
  const [q, setQ] = useState("");
  const [modalObraId, setModalObraId] = useState<string | null>(null);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [mun, setMun] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [faixa, setFaixa] = useState<string>("todas");
  const [scoreBucket, setScoreBucket] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Busca lista única de municípios para o filtro (via analytics/map ou um fetch separado)
  const { data: municipiosData } = useQuery({
    queryKey: ["municipios-list"],
    queryFn: () => analyticsService.mapGeoJson(),
    staleTime: 5 * 60_000,
  });
  const municipios = useMemo(
    () =>
      Array.from(
        new Set(
          (municipiosData?.features ?? []).map((f) => f.properties.municipio).filter(Boolean),
        ),
      ).sort(),
    [municipiosData],
  );

  // Debounce para a busca textual (cancela timer anterior)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = (value: string) => {
    setQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(value);
      setPage(1);
    }, 400);
  };

  // Monta params de valor contratado
  const valueParams = useMemo(() => {
    if (faixa === "ate1") return { max_value: 1_000_000 };
    if (faixa === "1a5") return { min_value: 1_000_001, max_value: 5_000_000 };
    if (faixa === "mais5") return { min_value: 5_000_001 };
    return {};
  }, [faixa]);

  // Monta params de score bucket
  const scoreParams = useMemo(() => scoreBucketParams(scoreBucket), [scoreBucket]);

  // QueryKey inclui TODOS os filtros para invalidação automática
  const queryKey = useMemo(
    () => ["obras-paginated", { page, pageSize, q: debouncedQ, mun, status, faixa, scoreBucket }],
    [page, pageSize, debouncedQ, mun, status, faixa, scoreBucket],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      obrasService.list({
        municipio: mun !== "todos" ? mun : undefined,
        status: status !== "todos" ? status : undefined,
        q: debouncedQ || undefined,
        page,
        per_page: pageSize,
        ...valueParams,
        ...scoreParams,
      }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const safePage = data?.page ?? 1;

  return (
    <div>
      <ObraDetailModal
        obraId={modalObraId}
        open={!!modalObraId}
        onOpenChange={(open) => { if (!open) setModalObraId(null); }}
      />
      <PageHeader title="Obras Públicas" description="Listagem completa das obras monitoradas." />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por obra, município ou contratado..."
            className="pl-9 bg-card"
          />
        </div>
        <Select
          value={mun}
          onValueChange={(v) => {
            setMun(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="Município" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os municípios</SelectItem>
            {municipios.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={faixa}
          onValueChange={(v) => {
            setFaixa(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="Faixa de valor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as faixas</SelectItem>
            <SelectItem value="ate1">Até R$ 1 mi</SelectItem>
            <SelectItem value="1a5">R$ 1 mi – R$ 5 mi</SelectItem>
            <SelectItem value="mais5">Acima de R$ 5 mi</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={scoreBucket}
          onValueChange={(v) => {
            setScoreBucket(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="Score ARGUS" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os scores</SelectItem>
            <SelectItem value="baixo">Baixo risco (≥ 80)</SelectItem>
            <SelectItem value="atencao">Atenção (60–79)</SelectItem>
            <SelectItem value="alto">Alto risco (40–59)</SelectItem>
            <SelectItem value="critico">{"Crítico (< 40)"}</SelectItem>
            <SelectItem value="sem">Sem score</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message="Nenhuma obra encontrada."
              hint="Ajuste os filtros ou limpe a busca para ver mais resultados."
            />
          </div>
        ) : (
          <div className="max-h-[calc(100vh-22rem)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome da obra</th>
                  <th className="px-4 py-3 font-medium">Município</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Valor contratado</th>
                  <th className="px-4 py-3 font-medium text-right">Valor executado</th>
                  <th className="px-4 py-3 font-medium w-40">Execução</th>
                  <th className="px-4 py-3 font-medium">Risco IA</th>
                  <th className="px-4 py-3 font-medium">Início</th>
                  <th className="px-4 py-3 font-medium">Previsão</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setModalObraId(o.id)}
                    className="cursor-pointer transition-colors hover:bg-primary/5"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{o.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.municipio}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {fmtBRL(o.valor_contratado)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {fmtBRL(o.valor_executado)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={o.percentual_execucao} className="h-2" />
                        <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">
                          {fmtPct(o.percentual_execucao)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PredictiveRiskIndicator
                        delayProbability={o.risco_atraso}
                        costProbability={o.risco_custo}
                        reworkProbability={o.risco_retrabalho}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.data_inicio)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(o.data_fim_prevista)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => setModalObraId(o.id)}>
                        <Eye className="mr-1 h-4 w-4" /> Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-col items-start gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Exibindo {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)} de{" "}
                {total}
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[110px] bg-card text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                Página {safePage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
