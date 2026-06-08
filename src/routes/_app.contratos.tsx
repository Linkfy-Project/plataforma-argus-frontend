import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Search,
  Eye,
  FileText,
  DollarSign,
  AlertTriangle,
  Clock,
  ShieldAlert,
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
import { contratosService } from "@/lib/api";
import { fmtBRL, fmtBRLCompact, fmtDate, fmtPct } from "@/lib/format";
import type { ContractItem } from "@/types";

export const Route = createFileRoute("/_app/contratos")({
  head: () => ({ meta: [{ title: "Contratos Publicos - Plataforma Argus" }] }),
  component: ContratosPage,
});

const RISK_STYLES: Record<string, string> = {
  Critico: "bg-destructive/10 text-destructive border-destructive/30",
  Alto: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  Medio: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  Baixo: "bg-green-500/15 text-green-600 border-green-500/30",
};

function getAcaoSugerida(c: ContractItem): string {
  if (c.acao_sugerida) return c.acao_sugerida;
  const parts: string[] = [];
  if (c.percentual_aditivo != null && c.percentual_aditivo > 25) {
    parts.push("Revisar justificativa do aditivo.");
  }
  if (c.status === "Vencido" || (c.dias_para_vencimento != null && c.dias_para_vencimento < 0)) {
    parts.push("Verificar prorrogacao ou encerramento.");
  }
  if (c.classificacao_risco === "Critico") {
    parts.push("Associar revisao contratual a vistoria tecnica.");
  }
  if (parts.length === 0 && c.alertas > 0) {
    parts.push("Analisar alertas associados ao contrato.");
  }
  return parts.join(" ") || "Monitorar evolucao contratual.";
}

function ContratosPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["contratos-rich"],
    queryFn: () => contratosService.listRich(),
  });

  const [search, setSearch] = useState("");
  const [fFornecedor, setFFornecedor] = useState("todos");
  const [fSecretaria, setFSecretaria] = useState("todos");
  const [fBairro, setFBairro] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fRisco, setFRisco] = useState("todos");
  const [fAditivo, setFAditivo] = useState("todos");
  const [fVencimento, setFVencimento] = useState("todos");

  const contratos = useMemo(() => data ?? [], [data]);

  const fornecedores = useMemo(
    () => [...new Set(contratos.map((c) => c.fornecedor).filter(Boolean))].sort() as string[],
    [contratos],
  );
  const secretarias = useMemo(
    () => [...new Set(contratos.map((c) => c.secretaria).filter(Boolean))].sort() as string[],
    [contratos],
  );
  const bairros = useMemo(
    () => [...new Set(contratos.map((c) => c.bairro).filter(Boolean))].sort() as string[],
    [contratos],
  );

  const filtered = useMemo(() => {
    return contratos.filter((c) => {
      if (fFornecedor !== "todos" && c.fornecedor !== fFornecedor) return false;
      if (fSecretaria !== "todos" && c.secretaria !== fSecretaria) return false;
      if (fBairro !== "todos" && c.bairro !== fBairro) return false;
      if (fStatus !== "todos" && c.status !== fStatus) return false;
      if (fRisco !== "todos" && c.classificacao_risco !== fRisco) return false;
      if (fAditivo === "sim") {
        if (c.percentual_aditivo == null || c.percentual_aditivo <= 25) return false;
      }
      if (fVencimento === "vencidos") {
        if (c.dias_para_vencimento == null || c.dias_para_vencimento >= 0) return false;
      }
      if (fVencimento === "vencendo") {
        if (
          c.dias_para_vencimento == null ||
          c.dias_para_vencimento < 0 ||
          c.dias_para_vencimento > 90
        )
          return false;
      }
      if (search) {
        const k = search.toLowerCase();
        const fields = [
          c.numero_contrato,
          c.objeto,
          c.obra_nome,
          c.fornecedor,
          c.municipio,
          c.bairro,
          c.secretaria,
        ].filter(Boolean);
        if (!fields.some((v) => v!.toLowerCase().includes(k))) return false;
      }
      return true;
    });
  }, [
    contratos,
    fFornecedor,
    fSecretaria,
    fBairro,
    fStatus,
    fRisco,
    fAditivo,
    fVencimento,
    search,
  ]);

  const stats = useMemo(() => {
    const total = contratos.length;
    const valorTotal = contratos.reduce((s, c) => s + (c.valor_original ?? c.valor_atual ?? 0), 0);
    const aditivoAlto = contratos.filter(
      (c) => c.percentual_aditivo != null && c.percentual_aditivo > 25,
    ).length;
    const vencidos = contratos.filter(
      (c) => c.dias_para_vencimento != null && c.dias_para_vencimento < 0,
    ).length;
    const criticos = contratos.filter((c) => c.classificacao_risco === "Critico").length;
    return { total, valorTotal, aditivoAlto, vencidos, criticos };
  }, [contratos]);

  const limparFiltros = () => {
    setSearch("");
    setFFornecedor("todos");
    setFSecretaria("todos");
    setFBairro("todos");
    setFStatus("todos");
    setFRisco("todos");
    setFAditivo("todos");
    setFVencimento("todos");
  };

  return (
    <div>
      <PageHeader
        title="Contratos Publicos"
        description="Analise contratual com indicadores de risco, aditivos e vencimentos."
      />

      {/* Cards de resumo */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Contratos monitorados"
          value={stats.total}
          icon={FileText}
          tone="primary"
        />
        <StatCard
          label="Valor total contratado"
          value={fmtBRLCompact(stats.valorTotal)}
          icon={DollarSign}
          tone="accent"
        />
        <StatCard
          label="Aditivo > 25%"
          value={stats.aditivoAlto}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard label="Vencidos" value={stats.vencidos} icon={Clock} tone="danger" />
        <StatCard label="Obras criticas" value={stats.criticos} icon={ShieldAlert} tone="danger" />
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contrato..."
            className="pl-9 bg-card"
          />
        </div>
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
        {secretarias.length > 0 && (
          <Select value={fSecretaria} onValueChange={setFSecretaria}>
            <SelectTrigger className="w-44 bg-card">
              <SelectValue placeholder="Secretaria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Secretaria</SelectItem>
              {secretarias.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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
        <Select value={fRisco} onValueChange={setFRisco}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Risco" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Risco</SelectItem>
            <SelectItem value="Critico">Critico</SelectItem>
            <SelectItem value="Alto">Alto</SelectItem>
            <SelectItem value="Medio">Medio</SelectItem>
            <SelectItem value="Baixo">Baixo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fAditivo} onValueChange={setFAditivo}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Aditivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Com aditivo</SelectItem>
            <SelectItem value="sim">{"Aditivo > 25%"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fVencimento} onValueChange={setFVencimento}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Vencimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Vencimento</SelectItem>
            <SelectItem value="vencidos">Vencidos</SelectItem>
            <SelectItem value="vencendo">Vencendo (90d)</SelectItem>
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
            <EmptyState message="Nenhum contrato encontrado." />
          </div>
        ) : (
          <div className="max-h-[calc(100vh-28rem)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-3 font-medium">Numero</th>
                  <th className="px-3 py-3 font-medium">Objeto/Obra</th>
                  <th className="px-3 py-3 font-medium">Fornecedor</th>
                  <th className="px-3 py-3 font-medium">Secretaria</th>
                  <th className="px-3 py-3 font-medium">Bairro</th>
                  <th className="px-3 py-3 font-medium text-right">Valor original</th>
                  <th className="px-3 py-3 font-medium text-right">Valor atual</th>
                  <th className="px-3 py-3 font-medium text-right">Aditivo %</th>
                  <th className="px-3 py-3 font-medium">Inicio</th>
                  <th className="px-3 py-3 font-medium">Fim</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium text-center">Score</th>
                  <th className="px-3 py-3 font-medium">Risco</th>
                  <th className="px-3 py-3 font-medium text-center">Alertas</th>
                  <th className="px-3 py-3 font-medium">Acao sugerida</th>
                  <th className="px-3 py-3 font-medium text-right">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => {
                  const risco = c.classificacao_risco ?? "—";
                  const riscoStyle =
                    RISK_STYLES[risco] ?? "bg-muted text-muted-foreground border-border";
                  const acao = getAcaoSugerida(c);
                  const isVencido = c.dias_para_vencimento != null && c.dias_para_vencimento < 0;
                  const isCritico = c.classificacao_risco === "Critico";

                  return (
                    <tr
                      key={c.id}
                      className={
                        isCritico
                          ? "bg-destructive/5 hover:bg-destructive/10"
                          : isVencido
                            ? "bg-orange-500/5 hover:bg-orange-500/10"
                            : "hover:bg-primary/5"
                      }
                    >
                      <td className="px-3 py-3 font-medium text-foreground">
                        {c.numero_contrato ?? `SN-${c.work_id}`}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-3 text-foreground">
                        {c.obra_nome ?? c.objeto ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{c.fornecedor ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{c.secretaria ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{c.bairro ?? "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fmtBRL(c.valor_original ?? 0)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fmtBRL(c.valor_atual ?? c.valor_original ?? 0)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {c.percentual_aditivo != null ? (
                          <span
                            className={
                              c.percentual_aditivo > 25 ? "font-semibold text-destructive" : ""
                            }
                          >
                            {fmtPct(c.percentual_aditivo)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {fmtDate(c.data_inicio ?? "")}
                      </td>
                      <td
                        className={`px-3 py-3 ${isVencido ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                      >
                        {fmtDate(c.data_fim ?? "")}
                        {c.dias_para_vencimento != null && (
                          <span className="ml-1 text-[10px]">
                            ({c.dias_para_vencimento > 0 ? `${c.dias_para_vencimento}d` : "vencido"}
                            )
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                            c.status === "Vigente"
                              ? "bg-primary/10 text-primary border-primary/30"
                              : c.status === "Encerrado"
                                ? "bg-green-500/15 text-green-600 border-green-500/30"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                          }`}
                        >
                          {c.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScoreBadge score={c.score_argus} showLabel={false} />
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${riscoStyle}`}
                        >
                          {risco}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">
                        {c.alertas > 0 ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold text-destructive">
                            {c.alertas}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="max-w-[200px] px-3 py-3 text-xs text-muted-foreground">
                        {acao}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          to="/obras/$id"
                          params={{ id: String(c.work_id) }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
