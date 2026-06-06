import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Search, MapPin, Calendar, ArrowRight, Wallet, Building } from "lucide-react";
import { obrasService } from "@/lib/api";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { ObraDetailModal } from "@/components/argus/ObraDetailModal";
import { Input } from "@/components/ui/input";
import { fmtBRL, fmtDate } from "@/lib/format";
import { getSemaforo } from "@/lib/semaforo";

export const Route = createFileRoute("/cidadao/obras")({
  head: () => ({ meta: [{ title: "Obras — Portal do Cidadão" }] }),
  component: CidadaoObras,
});

function CidadaoObras() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Obras Públicas
          </h1>
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
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Obras Públicas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conheça as obras de infraestrutura em monitoramento no município de Macaé.
        </p>
      </div>

      {/* Busca — aceita nome, bairro, rua ou município */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar obra por nome, bairro ou município..."
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
          hint={
            debouncedQ
              ? "Tente buscar com outros termos."
              : "Aguardando dados do servidor."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((obra) => {
            const semaforo = getSemaforo(obra.eficiencia);

            return (
              <div
                key={obra.id}
                role="button"
                tabIndex={0}
                data-testid={`obra-card-${obra.id}`}
                onClick={() => { setSelectedObraId(obra.id); setModalOpen(true); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedObraId(obra.id);
                    setModalOpen(true);
                  }
                }}
                className="group relative block cursor-pointer rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                {/* Badge de semáforo — canto superior direito */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${semaforo.bg} ${semaforo.color}`}
                  >
                    <span className="text-base">{semaforo.emoji}</span>
                    {semaforo.label}
                  </span>
                </div>

                {/* Nome da obra */}
                <h3 className="line-clamp-2 pr-28 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {obra.nome}
                </h3>

                {/* Bairro e município */}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {obra.bairro
                      ? `${obra.bairro}, ${obra.municipio}`
                      : obra.municipio}
                  </span>
                </div>

                {/* Construtora */}
                {obra.empresa_contratada && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{obra.empresa_contratada}</span>
                  </div>
                )}

                {/* Custo Total Previsto */}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5 shrink-0" />
                  <span>Custo Total Previsto: {fmtBRL(obra.valor_contratado)}</span>
                </div>

                {/* Quanto já foi pago */}
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground pl-5">
                  <span>Quanto já foi pago: {fmtBRL(obra.valor_executado)}</span>
                </div>

                {/* Previsão de Entrega */}
                {obra.data_fim_prevista && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>Previsão de Entrega: {fmtDate(obra.data_fim_prevista)}</span>
                  </div>
                )}

                {/* Rodapé — status + "ver detalhes" */}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <StatusBadge status={obra.status} />
                  <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Ver detalhes <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de detalhes da obra */}
      <ObraDetailModal
        obraId={selectedObraId}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedObraId(null);
        }}
      />
    </div>
  );
}
