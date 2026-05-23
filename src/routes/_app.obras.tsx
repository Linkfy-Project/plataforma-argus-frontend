import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { EmptyState, LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { obrasService } from "@/lib/api";
import { fmtBRL, fmtDate, fmtPct } from "@/lib/format";
import type { ObraStatus } from "@/types";

export const Route = createFileRoute("/_app/obras")({
  head: () => ({ meta: [{ title: "Obras — Plataforma Argus" }] }),
  component: ObrasPage,
});

const PAGE_SIZE = 10;
const STATUSES: ObraStatus[] = ["Planejada", "Em andamento", "Concluída", "Atrasada", "Paralisada"];

function ObrasPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["obras"],
    queryFn: () => obrasService.list(),
  });
  const [q, setQ] = useState("");
  const [mun, setMun] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [faixa, setFaixa] = useState<string>("todas");
  const [page, setPage] = useState(1);

  const municipios = useMemo(() => Array.from(new Set((data ?? []).map((o) => o.municipio))).sort(), [data]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((o) => {
      if (q && !`${o.nome} ${o.municipio}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (mun !== "todos" && o.municipio !== mun) return false;
      if (status !== "todos" && o.status !== status) return false;
      if (faixa === "ate1") return o.valor_contratado <= 1_000_000;
      if (faixa === "1a5") return o.valor_contratado > 1_000_000 && o.valor_contratado <= 5_000_000;
      if (faixa === "mais5") return o.valor_contratado > 5_000_000;
      return true;
    });
  }, [data, q, mun, status, faixa]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Obras Públicas" description="Listagem completa das obras monitoradas." />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Buscar por obra ou município..." className="pl-9 bg-card" />
        </div>
        <Select value={mun} onValueChange={(v) => { setMun(v); setPage(1); }}>
          <SelectTrigger className="bg-card"><SelectValue placeholder="Município" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os municípios</SelectItem>
            {municipios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={faixa} onValueChange={(v) => { setFaixa(v); setPage(1); }}>
          <SelectTrigger className="bg-card"><SelectValue placeholder="Faixa de valor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as faixas</SelectItem>
            <SelectItem value="ate1">Até R$ 1 mi</SelectItem>
            <SelectItem value="1a5">R$ 1 mi – R$ 5 mi</SelectItem>
            <SelectItem value="mais5">Acima de R$ 5 mi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-6"><LoadingState /></div>
        ) : isError ? (
          <div className="p-6"><ErrorState /></div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Nenhuma obra encontrada." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome da obra</th>
                  <th className="px-4 py-3 font-medium">Município</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Valor contratado</th>
                  <th className="px-4 py-3 font-medium">Valor executado</th>
                  <th className="px-4 py-3 font-medium w-40">Execução</th>
                  <th className="px-4 py-3 font-medium">Início</th>
                  <th className="px-4 py-3 font-medium">Previsão</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageData.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{o.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.municipio}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-foreground">{fmtBRL(o.valor_contratado)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtBRL(o.valor_executado)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={o.percentual_execucao} className="h-2" />
                        <span className="w-10 text-right text-xs text-muted-foreground">{fmtPct(o.percentual_execucao)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.data_inicio)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.data_fim_prevista)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/obras/$id" params={{ id: o.id }}>
                          <Eye className="mr-1 h-4 w-4" /> Ver detalhes
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}