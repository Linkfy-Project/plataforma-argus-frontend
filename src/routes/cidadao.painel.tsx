import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, HardHat, AlertTriangle, Trophy, MapPin, CircleDollarSign } from "lucide-react";
import { worksService, dashboardService } from "@/lib/api";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { fmtBRL, fmtNumber } from "@/lib/format";
import type { WorkRead } from "@/types";

export const Route = createFileRoute("/cidadao/painel")({
  head: () => ({ meta: [{ title: "Para onde vai o dinheiro? — ARGUS" }] }),
  component: CidadaoPainel,
});

/** Formata valor em reais de forma amigável: "R$ 2,5 milhões" */
function fmtBRLAmigavel(v: number): string {
  if (v >= 1_000_000_000) {
    return `R$ ${(v / 1_000_000_000).toFixed(1).replace(".", ",")} bilhões`;
  }
  if (v >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} milhões`;
  }
  if (v >= 1_000) {
    return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")} mil`;
  }
  return fmtBRL(v);
}

function CidadaoPainel() {
  const worksQuery = useQuery({
    queryKey: ["painel-works-all"],
    queryFn: () => worksService.listAll({}),
    staleTime: 2 * 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["painel-dashboard"],
    queryFn: () => dashboardService.getSummary(),
    staleTime: 2 * 60_000,
  });

  const isLoading = worksQuery.isLoading || summaryQuery.isLoading;
  const isError = worksQuery.isError || summaryQuery.isError;

  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState onRetry={() => worksQuery.refetch()} />;

  const allWorks: WorkRead[] = worksQuery.data ?? [];
  const d = summaryQuery.data;

  // Cálculos
  const totalInvestido = allWorks.reduce(
    (acc: number, w: WorkRead) => acc + (w.contract_value ?? 0),
    0,
  );

  const atrasadas = allWorks.filter((w: WorkRead) => {
    if (w.finished_at) return false;
    return w.due_at ? new Date(w.due_at) < new Date() : false;
  }).length;

  const emAndamento = allWorks.filter(
    (w: WorkRead) =>
      !w.finished_at &&
      !(w.status ?? "").toLowerCase().includes("paralis") &&
      (w.status ?? "") !== "Planejada",
  ).length;

  // Ranking de bairros/municípios com mais investimento
  const rankingBairros = Object.entries(
    allWorks.reduce<Record<string, { obras: number; valor: number }>>((acc, w: WorkRead) => {
      const key = w.neighborhood || w.municipio || "Não informado";
      if (!acc[key]) acc[key] = { obras: 0, valor: 0 };
      acc[key].obras += 1;
      acc[key].valor += w.contract_value ?? 0;
      return acc;
    }, {}),
  )
    .map(([nome, data]) => ({ nome, ...data }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Para onde vai o dinheiro?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Um resumo simples e direto de como os recursos públicos estão sendo aplicados em obras.
        </p>
      </div>

      {/* 3 Blocos gigantes */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Total investido */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-8 w-8" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Total Investido na Cidade
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
            {fmtBRLAmigavel(totalInvestido)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Soma de todos os contratos públicos de obras
          </p>
        </div>

        {/* Obras em andamento */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-blue-500/5 to-blue-500/10 p-8 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
            <HardHat className="h-8 w-8" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Obras em Andamento
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
            {fmtNumber(emAndamento)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Obras em execução ativa neste momento
          </p>
        </div>

        {/* Obras atrasadas */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-red-500/5 to-red-500/10 p-8 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-600">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Obras Atrasadas
          </p>
          <p className="mt-2 text-3xl font-bold text-red-600 md:text-4xl">{fmtNumber(atrasadas)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Obras que não cumpriram o prazo previsto — controle social necessário
          </p>
        </div>
      </div>

      {/* Ranking Cidadão */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[color:var(--warning)]" />
          <h2 className="text-lg font-semibold text-foreground">
            Ranking Cidadão: Locais com mais obras
          </h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Os bairros e regiões que mais recebem investimento em obras públicas.
        </p>

        {rankingBairros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Dados insuficientes para gerar o ranking.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Bairro / Região
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center justify-center gap-1">
                      <HardHat className="h-3.5 w-3.5" />
                      Obras
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center justify-end gap-1">
                      <CircleDollarSign className="h-3.5 w-3.5" />
                      Investimento
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rankingBairros.map((item, index) => (
                  <tr key={item.nome} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          index === 0
                            ? "bg-[color:var(--warning)]/20 text-[color:var(--warning)]"
                            : index === 1
                              ? "bg-muted-foreground/20 text-muted-foreground"
                              : index === 2
                                ? "bg-orange-500/20 text-orange-600"
                                : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.nome}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                      {item.obras}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {fmtBRLAmigavel(item.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Nota */}
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        Dados atualizados automaticamente com base nos registros do TCE-RJ e fontes oficiais. Os
        valores podem sofrer ajustes conforme novos contratos são registrados.
      </div>
    </div>
  );
}
