import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Inbox,
  Eye,
  CheckCircle2,
  Clock,
  Search,
  LayoutGrid,
  List,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { AlertBadge } from "@/components/argus/AlertBadge";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { alertasService } from "@/lib/api";
import { fmtDate, fmtBRLCompact } from "@/lib/format";
import type { AlertWorkflowItem, AlertStatusValue, AlertaNivel } from "@/types";

export const Route = createFileRoute("/_app/alertas")({
  head: () => ({ meta: [{ title: "Central de Alertas — Plataforma Argus" }] }),
  component: AlertasPage,
});

/* -------------------------------------------------------------------------- */
/* Constantes                                                                  */
/* -------------------------------------------------------------------------- */

const STATUS_LIST: AlertStatusValue[] = [
  "Novo",
  "Em análise",
  "Encaminhado",
  "Resolvido",
  "Descartado",
];

const SEVERITY_LIST: AlertaNivel[] = ["Crítico", "Alto", "Médio", "Baixo"];

const SEVERITY_BORDER: Record<string, string> = {
  "Crítico": "border-l-destructive",
  Alto: "border-l-orange-500",
  "Médio": "border-l-yellow-500",
  Baixo: "border-l-primary",
};

const KANBAN_HEADER_BG: Record<string, string> = {
  Novo: "bg-primary/10 text-primary",
  "Em análise": "bg-yellow-500/15 text-yellow-600",
  Encaminhado: "bg-orange-500/15 text-orange-600",
  Resolvido: "bg-green-500/15 text-green-600",
  Descartado: "bg-muted text-muted-foreground",
};

/* -------------------------------------------------------------------------- */
/* Componente principal                                                        */
/* -------------------------------------------------------------------------- */

function AlertasPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alertas-workflow"],
    queryFn: () => alertasService.listWorkflow(),
  });

  const [view, setView] = useState<"kanban" | "tabela">("kanban");
  const [search, setSearch] = useState("");
  const [fSeverity, setFSeverity] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [fBairro, setFBairro] = useState("todos");
  const [fFornecedor, setFFornecedor] = useState("todos");
  const [statusError, setStatusError] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AlertStatusValue }) =>
      alertasService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-workflow"] });
      setStatusError(null);
    },
    onError: () => {
      setStatusError(
        "Não foi possível persistir a alteração de status. O endpoint pode não estar disponível no backend atual.",
      );
    },
  });

  const alertas = useMemo(() => data ?? [], [data]);

  const tipos = useMemo(
    () => [...new Set(alertas.map((a) => a.tipo).filter(Boolean))].sort(),
    [alertas],
  );
  const bairros = useMemo(
    () => [...new Set(alertas.map((a) => a.bairro).filter(Boolean))].sort() as string[],
    [alertas],
  );
  const fornecedores = useMemo(
    () => [...new Set(alertas.map((a) => a.fornecedor).filter(Boolean))].sort() as string[],
    [alertas],
  );

  const filtered = useMemo(() => {
    return alertas.filter((a) => {
      if (fSeverity !== "todos" && a.nivel !== fSeverity) return false;
      if (fStatus !== "todos" && a.status !== fStatus) return false;
      if (fTipo !== "todos" && a.tipo !== fTipo) return false;
      if (fBairro !== "todos" && a.bairro !== fBairro) return false;
      if (fFornecedor !== "todos" && a.fornecedor !== fFornecedor) return false;
      if (search) {
        const k = search.toLowerCase();
        const fields = [
          a.descricao,
          a.code,
          a.obra_nome,
          a.municipio,
          a.bairro,
          a.fornecedor,
          a.tipo,
          a.motivo,
        ].filter(Boolean);
        if (!fields.some((v) => v!.toLowerCase().includes(k))) return false;
      }
      return true;
    });
  }, [alertas, fSeverity, fStatus, fTipo, fBairro, fFornecedor, search]);

  const stats = useMemo(() => {
    const novos = alertas.filter((a) => a.status === "Novo").length;
    const criticos = alertas.filter((a) => a.nivel === "Crítico").length;
    const emAnalise = alertas.filter((a) => a.status === "Em análise").length;
    const resolvidos = alertas.filter((a) => a.status === "Resolvido").length;
    const prazoVencido = alertas.filter((a) => {
      if (a.status === "Resolvido" || a.status === "Descartado") return false;
      if (!a.data_deteccao) return false;
      const days = (Date.now() - new Date(a.data_deteccao).getTime()) / 86_400_000;
      return days > 30;
    }).length;
    return { novos, criticos, emAnalise, resolvidos, prazoVencido };
  }, [alertas]);

  const kanbanGroups = useMemo(() => {
    const groups: Record<string, AlertWorkflowItem[]> = {};
    const severityOrder: Record<string, number> = {
      "Crítico": 0,
      Alto: 1,
      "Médio": 2,
      Baixo: 3,
    };
    for (const status of STATUS_LIST) {
      groups[status] = filtered
        .filter((a) => a.status === status)
        .sort((a, b) => (severityOrder[a.nivel] ?? 99) - (severityOrder[b.nivel] ?? 99));
    }
    return groups;
  }, [filtered]);

  const sorted = useMemo(() => {
    const order: Record<string, number> = {
      "Crítico": 0,
      Alto: 1,
      "Médio": 2,
      Baixo: 3,
    };
    return [...filtered].sort((a, b) => (order[a.nivel] ?? 99) - (order[b.nivel] ?? 99));
  }, [filtered]);

  function handleStatusChange(id: number, newStatus: AlertStatusValue) {
    setStatusError(null);
    statusMutation.mutate({ id, status: newStatus });
  }

  const limparFiltros = () => {
    setSearch("");
    setFSeverity("todos");
    setFStatus("todos");
    setFTipo("todos");
    setFBairro("todos");
    setFFornecedor("todos");
  };

  return (
    <div>
      <PageHeader
        title="Central de Alertas"
        description="Eventos detectados automaticamente que exigem análise, encaminhamento ou resolução pela gestão."
      />

      {statusError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {statusError}
        </div>
      )}

      {/* Cards de resumo */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Alertas novos" value={stats.novos} icon={Inbox} tone="primary" />
        <StatCard label="Críticos" value={stats.criticos} icon={AlertTriangle} tone="danger" />
        <StatCard label="Em análise" value={stats.emAnalise} icon={Eye} tone="warning" />
        <StatCard label="Resolvidos" value={stats.resolvidos} icon={CheckCircle2} tone="success" />
        {stats.prazoVencido > 0 && (
          <StatCard
            label="Prazo vencido (>30d)"
            value={stats.prazoVencido}
            icon={Clock}
            tone="danger"
          />
        )}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar alerta..."
            className="pl-9 bg-card"
          />
        </div>
        <Select value={fSeverity} onValueChange={setFSeverity}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Severidade</SelectItem>
            {SEVERITY_LIST.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Status</SelectItem>
            {STATUS_LIST.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tipos.length > 0 && (
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger className="w-44 bg-card">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Tipo</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {bairros.length > 0 && (
          <Select value={fBairro} onValueChange={setFBairro}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue placeholder="Bairro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Bairro</SelectItem>
              {bairros.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {fornecedores.length > 0 && (
          <Select value={fFornecedor} onValueChange={setFFornecedor}>
            <SelectTrigger className="w-48 bg-card">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Fornecedor</SelectItem>
              {fornecedores.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="ghost" size="sm" onClick={limparFiltros}>
          Limpar
        </Button>
      </div>

      {/* Toggle de visualizacao */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={view === "kanban" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("kanban")}
        >
          <LayoutGrid className="mr-1.5 h-4 w-4" /> Kanban
        </Button>
        <Button
          variant={view === "tabela" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("tabela")}
        >
          <List className="mr-1.5 h-4 w-4" /> Tabela
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} alerta{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Conteudo */}
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          message="Nenhum alerta encontrado."
          hint="Quando o sistema detectar riscos, eles aparecerão aqui."
        />
      ) : view === "kanban" ? (
        /* --- KANBAN --- */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_LIST.map((status) => {
            const items = kanbanGroups[status] ?? [];
            return (
              <div
                key={status}
                className="flex min-w-[280px] flex-1 flex-col rounded-xl border border-border bg-card/50"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${KANBAN_HEADER_BG[status] ?? ""}`}
                  >
                    {status}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{items.length}</span>
                </div>
                <div
                  className="flex-1 space-y-3 overflow-y-auto p-3"
                  style={{ maxHeight: "calc(100vh - 26rem)" }}
                >
                  {items.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">Nenhum alerta</p>
                  ) : (
                    items.map((a) => (
                      <KanbanAlertCard
                        key={a.id}
                        alerta={a}
                        onStatusChange={handleStatusChange}
                        isPending={statusMutation.isPending}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* --- TABELA --- */
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="max-h-[calc(100vh-22rem)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-3 font-medium">Severidade</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Obra</th>
                  <th className="px-4 py-3 font-medium">Bairro</th>
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium text-center">Score</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Ação sugerida</th>
                  <th className="px-4 py-3 font-medium">Detectado</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((a) => (
                  <tr
                    key={a.id}
                    className={
                      a.nivel === "Crítico"
                        ? "bg-destructive/5 hover:bg-destructive/10"
                        : "hover:bg-primary/5"
                    }
                  >
                    <td className="px-4 py-3">
                      <AlertBadge nivel={a.nivel as AlertaNivel} />
                    </td>
                    <td className="px-4 py-3 text-foreground">{a.tipo}</td>
                    <td className="px-4 py-3 text-foreground">{a.obra_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.bairro ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.fornecedor ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={a.score_argus} showLabel={false} />
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {a.descricao ?? "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">
                      {a.acao_sugerida ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(a.data_deteccao ?? "")}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={a.status}
                        onValueChange={(v) => handleStatusChange(a.id, v as AlertStatusValue)}
                        disabled={statusMutation.isPending}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_LIST.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/obras/$id"
                        params={{ id: String(a.work_id) }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Ver obra <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponentes                                                              */
/* -------------------------------------------------------------------------- */

function KanbanAlertCard({
  alerta,
  onStatusChange,
  isPending,
}: {
  alerta: AlertWorkflowItem;
  onStatusChange: (id: number, status: AlertStatusValue) => void;
  isPending: boolean;
}) {
  const borderColor = SEVERITY_BORDER[alerta.nivel] ?? "border-l-primary";

  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 shadow-sm border-l-4 ${borderColor}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertBadge nivel={alerta.nivel as AlertaNivel} />
        <span className="text-xs font-medium text-foreground">{alerta.tipo}</span>
      </div>

      <p className="text-sm font-semibold text-foreground">
        {alerta.obra_nome ?? `Obra #${alerta.work_id}`}
      </p>

      <p className="mt-0.5 text-xs text-muted-foreground">
        {alerta.bairro ?? "—"}
        {alerta.fornecedor ? ` · ${alerta.fornecedor}` : ""}
      </p>

      {alerta.score_argus != null && (
        <div className="mt-2">
          <ScoreBadge score={alerta.score_argus} />
        </div>
      )}

      {alerta.descricao && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{alerta.descricao}</p>
      )}

      {alerta.motivo && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Motivo:</span> {alerta.motivo}
        </p>
      )}

      {alerta.acao_sugerida && (
        <div className="mt-2 rounded-md border border-dashed border-border bg-background/60 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ação sugerida
          </p>
          <p className="mt-0.5 text-xs text-foreground">{alerta.acao_sugerida}</p>
        </div>
      )}

      {alerta.valor_contratado != null && alerta.valor_contratado > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Valor: {fmtBRLCompact(alerta.valor_contratado)}
        </p>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground">
        {fmtDate(alerta.data_deteccao ?? "")}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Select
          value={alerta.status}
          onValueChange={(v) => onStatusChange(alerta.id, v as AlertStatusValue)}
          disabled={isPending}
        >
          <SelectTrigger className="w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_LIST.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link
          to="/obras/$id"
          params={{ id: String(alerta.work_id) }}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          Ver obra <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
