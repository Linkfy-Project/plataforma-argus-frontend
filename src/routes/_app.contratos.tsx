import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Eye } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { ContratoStatusBadge } from "@/components/argus/StatusBadge";
import { LoadingState, EmptyState } from "@/components/argus/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { contratosService } from "@/lib/api";
import { fmtBRL, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_app/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Plataforma Argus" }] }),
  component: ContratosPage,
});

function ContratosPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["contratos"],
    queryFn: () => contratosService.list(),
  });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!q) return list;
    const k = q.toLowerCase();
    return list.filter((c) =>
      [c.numero, c.obra_nome, c.municipio, c.empresa].some((v) => v.toLowerCase().includes(k)),
    );
  }, [data, q]);

  return (
    <div>
      <PageHeader title="Contratos" description="Contratos firmados pelas obras monitoradas." />
      <div className="mb-4 max-w-md relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contrato, empresa ou obra..." className="pl-9 bg-card" />
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-6"><LoadingState /></div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Nenhum contrato encontrado." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nº contrato</th>
                  <th className="px-4 py-3 font-medium">Obra</th>
                  <th className="px-4 py-3 font-medium">Município</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Valor contratado</th>
                  <th className="px-4 py-3 font-medium">Valor executado</th>
                  <th className="px-4 py-3 font-medium">Assinatura</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{c.numero}</td>
                    <td className="px-4 py-3 text-foreground">{c.obra_nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.municipio}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.empresa}</td>
                    <td className="px-4 py-3">{fmtBRL(c.valor_contratado)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtBRL(c.valor_executado)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.data_assinatura)}</td>
                    <td className="px-4 py-3"><ContratoStatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm"><Eye className="mr-1 h-4 w-4" /> Detalhes</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}