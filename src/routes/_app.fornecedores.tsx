import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Search,
  Truck,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
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
import { fornecedoresService } from "@/lib/api";
import { fmtBRL, fmtBRLCompact, fmtNumber, fmtPctDec } from "@/lib/format";

export const Route = createFileRoute("/_app/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — Plataforma Argus" }] }),
  component: FornecedoresPage,
});

const CLASSIFICACAO_STYLES: Record<string, string> = {
  "Crítico": "bg-destructive/10 text-destructive border-destructive/30",
  Alto: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  "Médio": "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  Baixo: "bg-green-500/15 text-green-600 border-green-500/30",
};

type SortKey = "valor" | "alertas" | "score" | "default";

function FornecedoresPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fornecedores-ranking"],
    queryFn: () => fornecedoresService.ranking({ limit: 200 }),
  });

  const [search, setSearch] = useState("");
  const [fRisco, setFRisco] = useState("todos");
  const [fBairro, setFBairro] = useState("todos");
  const [fCriticos, setFCriticos] = useState("todos");
  const [sortBy, setSortBy] = useState<SortKey>("default");

  const fornecedores = useMemo(() => data ?? [], [data]);

  const bairros = useMemo(() => {
    const set = new Set<string>();
    for (const f of fornecedores) {
      for (const b of f.bairros_atuacao ?? []) {
        if (b) set.add(b);
      }
    }
    return [...set].sort();
  }, [fornecedores]);

  const filtered = useMemo(() => {
    let result = fornecedores.filter((f) => {
      if (fRisco !== "todos" && f.classificacao !== fRisco) return false;
      if (fBairro !== "todos" && !(f.bairros_atuacao ?? []).includes(fBairro)) return false;
      if (fCriticos === "sim" && f.obras_criticas === 0) return false;
      if (search) {
        const k = search.toLowerCase();
        const fields = [f.fornecedor, f.cnpj, f.classificacao].filter(Boolean);
        if (!fields.some((v) => v!.toLowerCase().includes(k))) return false;
      }
      return true;
    });

    if (sortBy === "valor") {
      result = [...result].sort((a, b) => b.valor_total - a.valor_total);
    } else if (sortBy === "alertas") {
      result = [...result].sort((a, b) => b.alertas_totais - a.alertas_totais);
    } else if (sortBy === "score") {
      result = [...result].sort((a, b) => (a.score_medio ?? 100) - (b.score_medio ?? 100));
    }
    return result;
  }, [fornecedores, fRisco, fBairro, fCriticos, search, sortBy]);

  const stats = useMemo(() => {
    const total = fornecedores.length;
    const valorTotal = fornecedores.reduce((s, f) => s + f.valor_total, 0);
    const comCriticos = fornecedores.filter((f) => f.obras_criticas > 0).length;
    const emptyFornecedor = { fornecedor: "—", valor_total: 0, alertas_totais: 0 };
    const maiorValor = fornecedores.reduce(
      (max, f) => (f.valor_total > max.valor_total ? f : max),
      fornecedores[0] ?? emptyFornecedor,
    );
    const maisAlertas = fornecedores.reduce(
      (max, f) => (f.alertas_totais > max.alertas_totais ? f : max),
      fornecedores[0] ?? emptyFornecedor,
    );
    return { total, valorTotal, comCriticos, maiorValor, maisAlertas };
  }, [fornecedores]);

  const limparFiltros = () => {
    setSearch("");
    setFRisco("todos");
    setFBairro("todos");
    setFCriticos("todos");
    setSortBy("default");
  };

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        description="Análise de recorrência, concentração contratual e risco associado a fornecedores."
      />

      {/* Cards de resumo */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Fornecedores monitorados"
          value={stats.total}
          icon={Truck}
          tone="primary"
        />
        <StatCard
          label="Valor total contratado"
          value={fmtBRLCompact(stats.valorTotal)}
          icon={DollarSign}
          tone="accent"
        />
        <StatCard
          label="Com obras críticas"
          value={stats.comCriticos}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Maior valor contratado"
          value={stats.maiorValor.fornecedor ?? "—"}
          helper={
            stats.maiorValor.valor_total > 0
              ? fmtBRLCompact(stats.maiorValor.valor_total)
              : undefined
          }
          icon={TrendingUp}
          tone="warning"
        />
        <StatCard
          label="Mais alertas"
          value={stats.maisAlertas.fornecedor ?? "—"}
          helper={
            stats.maisAlertas.alertas_totais > 0
              ? `${stats.maisAlertas.alertas_totais} alertas`
              : undefined
          }
          icon={BarChart3}
          tone="danger"
        />
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="pl-9 bg-card"
          />
        </div>
        <Select value={fRisco} onValueChange={setFRisco}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Risco" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Risco</SelectItem>
            <SelectItem value="Crítico">Crítico</SelectItem>
            <SelectItem value="Alto">Alto</SelectItem>
            <SelectItem value="Médio">Médio</SelectItem>
            <SelectItem value="Baixo">Baixo</SelectItem>
          </SelectContent>
        </Select>
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
        <Select value={fCriticos} onValueChange={setFCriticos}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Obras críticas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Obras críticas</SelectItem>
            <SelectItem value="sim">Com obras críticas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Ordenar por</SelectItem>
            <SelectItem value="valor">Maior valor</SelectItem>
            <SelectItem value="alertas">Mais alertas</SelectItem>
            <SelectItem value="score">Menor score</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={limparFiltros}>
          Limpar
        </Button>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Nenhum fornecedor encontrado." />
          </div>
        ) : (
          <div className="max-h-[calc(100vh-28rem)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-3 font-medium">Fornecedor</th>
                  <th className="px-3 py-3 font-medium">CNPJ</th>
                  <th className="px-3 py-3 font-medium text-center">Contratos</th>
                  <th className="px-3 py-3 font-medium text-center">Obras</th>
                  <th className="px-3 py-3 font-medium text-right">Valor total</th>
                  <th className="px-3 py-3 font-medium text-center">Score médio</th>
                  <th className="px-3 py-3 font-medium text-center">Críticas</th>
                  <th className="px-3 py-3 font-medium text-center">Atrasadas</th>
                  <th className="px-3 py-3 font-medium text-center">Alertas</th>
                  <th className="px-3 py-3 font-medium text-right">Aditivo médio</th>
                  <th className="px-3 py-3 font-medium">Bairros</th>
                  <th className="px-3 py-3 font-medium">Classificação</th>
                  <th className="px-3 py-3 font-medium">Recomendação</th>
                  <th className="px-3 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((f) => {
                  const classificacao = f.classificacao || "—";
                  const classStyle =
                    CLASSIFICACAO_STYLES[classificacao] ??
                    "bg-muted text-muted-foreground border-border";
                  const isCritico = classificacao === "Crítico";

                  return (
                    <tr
                      key={f.fornecedor}
                      className={
                        isCritico
                          ? "bg-destructive/5 hover:bg-destructive/10"
                          : "hover:bg-primary/5"
                      }
                    >
                      <td className="max-w-[200px] truncate px-3 py-3 font-medium text-foreground">
                        {f.fornecedor}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                        {f.cnpj ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">
                        {fmtNumber(f.contratos)}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">{fmtNumber(f.obras)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">
                        {fmtBRL(f.valor_total)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScoreBadge score={f.score_medio} showLabel={false} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {f.obras_criticas > 0 ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold text-destructive">
                            {f.obras_criticas}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {f.obras_atrasadas > 0 ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/10 text-[10px] font-bold text-orange-600">
                            {f.obras_atrasadas}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {f.alertas_totais > 0 ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold text-destructive">
                            {f.alertas_totais}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {f.aditivo_medio_percentual > 0 ? (
                          <span
                            className={
                              f.aditivo_medio_percentual > 25
                                ? "font-semibold text-destructive"
                                : ""
                            }
                          >
                            {fmtPctDec(f.aditivo_medio_percentual)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[150px] px-3 py-3 text-xs text-muted-foreground">
                        {(f.bairros_atuacao ?? []).length > 0
                          ? (f.bairros_atuacao ?? []).slice(0, 3).join(", ") +
                            ((f.bairros_atuacao ?? []).length > 3
                              ? ` +${(f.bairros_atuacao ?? []).length - 3}`
                              : "")
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classStyle}`}
                        >
                          {classificacao}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-3 py-3 text-xs text-muted-foreground">
                        {f.recomendacao || "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Link to="/obras">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota de rodape */}
      <p className="mt-4 text-xs text-muted-foreground">
        Os dados acima visam apoiar a priorização de análise técnica e
        administrativa. Classificações são baseadas em indicadores objetivos e
        não implicam acusação.
      </p>
    </div>
  );
}
