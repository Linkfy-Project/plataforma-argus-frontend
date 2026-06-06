import { useState, useMemo, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HardHat, AlertTriangle, Wallet, Search, MapPin, Loader2 } from "lucide-react";
import { worksService, dashboardService } from "@/lib/api";
import { CidadaoMap } from "@/components/argus/CidadaoMap";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/argus/EmptyState";
import { Input } from "@/components/ui/input";
import { fmtBRL, fmtNumber } from "@/lib/format";
import type { WorkRead } from "@/types";

export const Route = createFileRoute("/cidadao/")({
  head: () => ({ meta: [{ title: "O Mapa da Minha Cidade — ARGUS" }] }),
  component: CidadaoIndex,
});

function CidadaoIndex() {
  const [search, setSearch] = useState("");

  const worksQuery = useQuery({
    queryKey: ["cidadao-index-works"],
    queryFn: () => worksService.listAll({}),
    staleTime: 5 * 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["cidadao-index-summary"],
    queryFn: () => dashboardService.getSummary(),
    staleTime: 5 * 60_000,
  });

  const isLoading = worksQuery.isLoading || summaryQuery.isLoading;
  const isError = worksQuery.isError || summaryQuery.isError;

  // Filtro de busca
  const filteredWorks = useMemo(() => {
    const all = worksQuery.data ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase().trim();
    return all.filter((w: WorkRead) => {
      const searchable = [
        w.object_description,
        w.neighborhood,
        w.address,
        w.municipio,
        w.contractor_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [worksQuery.data, search]);

  // IDs das obras filtradas (para centralizar o mapa)
  const filteredIds = useMemo(() => {
    if (!search.trim()) return undefined;
    return new Set(filteredWorks.map((w: WorkRead) => w.id));
  }, [filteredWorks, search]);

  const d = summaryQuery.data;
  const allWorks = worksQuery.data ?? [];

  // Contagem de obras atrasadas
  const atrasadas = allWorks.filter((w: WorkRead) => {
    if (w.finished_at) return false;
    return w.due_at ? new Date(w.due_at) < new Date() : false;
  }).length;

  // Obras em andamento (não concluídas, não paralisadas)
  const emAndamento = allWorks.filter(
    (w: WorkRead) =>
      !w.finished_at &&
      !(w.status ?? "").toLowerCase().includes("paralis") &&
      (w.status ?? "") !== "Planejada",
  ).length;

  // Total investido
  const totalInvestido = allWorks.reduce(
    (acc: number, w: WorkRead) => acc + (w.contract_value ?? 0),
    0,
  );

  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState onRetry={() => worksQuery.refetch()} />;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          O Mapa da Minha Cidade
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja no mapa as obras públicas da sua cidade. Clique nos marcadores para saber mais.
        </p>
      </div>

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="🔍 Busque pelo seu bairro ou rua..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 w-full rounded-xl border-border bg-card pl-12 pr-4 text-base shadow-sm placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Mapa */}
      <section className="overflow-hidden rounded-xl border border-border shadow-sm">
        <CidadaoMap
          works={allWorks}
          height="480px"
          filteredIds={filteredIds}
        />
      </section>

      {/* Resultado da busca */}
      {search.trim() && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          {filteredWorks.length > 0 ? (
            <span>
              <strong className="text-foreground">{filteredWorks.length}</strong> obra(s)
              encontrada(s) para "<strong>{search.trim()}</strong>"
            </span>
          ) : (
            <span>
              Nenhuma obra encontrada para "<strong>{search.trim()}</strong>"
            </span>
          )}
        </div>
      )}

      {/* Cards de resumo rápido */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wider">
          Resumo rápido
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Obras em andamento"
            value={fmtNumber(emAndamento)}
            helper="Em execução ativa"
            icon={HardHat}
            tone="primary"
          />
          <StatCard
            label="Obras atrasadas"
            value={fmtNumber(atrasadas)}
            helper="Controle social necessário"
            icon={AlertTriangle}
            tone="danger"
          />
          <StatCard
            label="Total investido"
            value={fmtBRL(totalInvestido)}
            helper="Soma de todos os contratos"
            icon={Wallet}
            tone="accent"
          />
        </div>
      </section>

      {/* CTA para lista completa */}
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center md:p-8">
        <h2 className="text-lg font-semibold text-foreground">
          Quer ver a lista completa?
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Acesse a lista de todas as obras públicas com detalhes de valores, prazos e situação.
        </p>
        <Link
          to="/cidadao/obras"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Ver todas as obras
        </Link>
      </section>
    </div>
  );
}
