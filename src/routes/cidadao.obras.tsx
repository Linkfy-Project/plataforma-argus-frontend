import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Search, MapPin, Calendar, ArrowRight, Wallet } from "lucide-react";
import { obrasService } from "@/lib/api";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtBRL, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/cidadao/obras")({
  head: () => ({ meta: [{ title: "Obras — Portal do Cidadão" }] }),
  component: CidadaoObras,
});

function CidadaoObras() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearchChange = (value: string) => {
    setQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(value);
    }, 400);
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cidadao-obras", debouncedQ],
    queryFn: () =>
      obrasService.list({
        q: debouncedQ || undefined,
        per_page: 100,
      }),
    staleTime: 3 * 60_000,
  });

  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Obras Públicas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conheça as obras de infraestrutura em monitoramento no município.
          </p>
        </div>
        <LoadingState rows={6} />
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Obras Públicas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conheça as obras de infraestrutura em monitoramento no município de Macaé.
        </p>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar obra por nome ou município..."
          className="pl-9 bg-card"
        />
      </div>

      {/* Contador */}
      <p className="text-sm text-muted-foreground">
        {items.length > 0
          ? `${items.length} obra${items.length > 1 ? "s" : ""} encontrada${items.length > 1 ? "s" : ""}`
          : "Nenhuma obra encontrada"}
      </p>

      {/* Cards de obras */}
      {items.length === 0 ? (
        <EmptyState
          message="Nenhuma obra encontrada."
          hint={debouncedQ ? "Tente buscar com outros termos." : "Aguardando dados do servidor."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((obra) => (
            <Link
              key={obra.id}
              to="/cidadao/obras/$id"
              params={{ id: obra.id }}
              className="group block rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {obra.nome}
                </h3>
                <StatusBadge status={obra.status} />
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{obra.municipio}</span>
              </div>

              {obra.data_fim_prevista && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Previsao: {fmtDate(obra.data_fim_prevista)}</span>
                </div>
              )}

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span>Contratado: {fmtBRL(obra.valor_contratado)}</span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <ScoreBadge score={obra.eficiencia} />
                <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Ver detalhes <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
