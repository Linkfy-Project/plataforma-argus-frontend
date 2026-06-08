import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  MapPin,
  AlertTriangle,
  ShieldAlert,
  XCircle,
  Building2,
  Filter,
  RotateCcw,
  ArrowUpDown,
  ExternalLink,
  MapPinOff,
  DollarSign,
  BarChart3,
  Clock,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { EmptyState, LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { obrasService, worksService, adaptObra } from "@/lib/api";
import { fmtBRL, fmtBRLCompact, fmtDate, fmtPct } from "@/lib/format";
import { getRiskLevel, getScoreHex } from "@/lib/score";
import type { Obra, WorkRead, ObraStatus } from "@/types";

export const Route = createFileRoute("/_app/obras")({
  head: () => ({ meta: [{ title: "Obras Públicas — Plataforma Argus" }] }),
  component: ObrasPage,
});

const STATUSES: ObraStatus[] = ["Planejada", "Em andamento", "Concluída", "Atrasada", "Paralisada"];
const PAGE_SIZES = [10, 25, 50, 100];

/* ──────────────────────────────────────────────────────────────────────────────
   Extended Obra type with fields needed for the rich table.
   Computed locally from WorkRead without changing the shared Obra interface.
   ────────────────────────────────────────────────────────────────────────────── */

interface ExtendedObra extends Obra {
  bairro: string;
  secretaria: string;
  fornecedor: string;
  dias_atraso: number;
  alertas_ativos: number;
  classificacao_risco: string;
  motivo_principal: string;
  lat?: number;
  lng?: number;
  contract_number?: string;
  bidding_number?: string;
  paid_value?: number;
  additive_value?: number;
  additive_pct?: number;
  contractor_document?: string;
  managing_unit?: string;
}

/** Adapta WorkRead para ExtendedObra com todos os campos enriquecidos. */
function adaptExtendedObra(w: WorkRead): ExtendedObra {
  const base = adaptObra(w);
  const today = new Date();
  const dueDate = w.due_at ? new Date(w.due_at) : null;
  const diasAtraso =
    dueDate && dueDate < today && !w.finished_at
      ? Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
      : 0;

  const alertas = w.alerts ?? [];
  const alertasAtivos = alertas.length;
  const hasCritical = alertas.some((a) =>
    ["critical", "critico", "crítico", "danger"].includes(a.severity?.toLowerCase()),
  );

  const score = w.efficiency_score ?? null;
  const riskLevel = getRiskLevel(score);

  // Determina motivo principal de risco
  let motivoPrincipal = "Monitoramento contínuo";
  if (hasCritical) motivoPrincipal = "Alertas críticos ativos";
  else if (diasAtraso > 180) motivoPrincipal = `Atraso severo (${diasAtraso} dias)`;
  else if (diasAtraso > 0) motivoPrincipal = `Atraso de ${diasAtraso} dias`;
  else if ((w.risk_delay_probability ?? 0) >= 0.7) motivoPrincipal = "Alto risco de atraso (ML)";
  else if ((w.risk_cost_probability ?? 0) >= 0.7) motivoPrincipal = "Alto risco de custo (ML)";
  else if ((w.additive_value ?? 0) > 0 && (w.contract_value ?? 0) > 0) {
    const pct = w.additive_value! / w.contract_value!;
    if (pct > 0.25) motivoPrincipal = `Aditivo elevado (${(pct * 100).toFixed(0)}%)`;
  } else if (score !== null && score < 40) motivoPrincipal = "Score ARGUS crítico";
  else if (score !== null && score < 60) motivoPrincipal = "Score ARGUS em atenção";

  return {
    ...base,
    bairro: w.neighborhood ?? "—",
    secretaria: w.managing_unit ?? w.requesting_agency ?? "—",
    fornecedor: w.contractor_name ?? "—",
    dias_atraso: diasAtraso,
    alertas_ativos: alertasAtivos,
    classificacao_risco: riskLevel,
    motivo_principal: motivoPrincipal,
    lat: w.latitude ?? undefined,
    lng: w.longitude ?? undefined,
    contract_number: w.contract_number ?? undefined,
    bidding_number: w.bidding_number ?? undefined,
    paid_value: w.paid_value ?? undefined,
    additive_value: w.additive_value ?? undefined,
    additive_pct:
      w.additive_value && w.contract_value ? w.additive_value / w.contract_value : undefined,
    contractor_document: w.contractor_document ?? undefined,
    managing_unit: w.managing_unit ?? undefined,
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
   Risk classification helpers
   ────────────────────────────────────────────────────────────────────────────── */

function riskBadgeColor(classificacao: string): string {
  switch (classificacao) {
    case "Crítico":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "Alto risco":
      return "bg-orange-500/15 text-orange-600 border-orange-500/30";
    case "Atenção":
      return "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30";
    case "Eficiente":
      return "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   ObrasPage Component
   ────────────────────────────────────────────────────────────────────────────── */

type SortField = "priority" | "score" | "atraso" | "valor" | "alertas" | "nome";

function ObrasPage() {
  // ── Filter state ──
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [mun, setMun] = useState<string>("todos");
  const [bairro, setBairro] = useState<string>("todos");
  const [secretaria, setSecretaria] = useState<string>("todos");
  const [fornecedor, setFornecedor] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [classificacao, setClassificacao] = useState<string>("todos");
  const [valorMin, setValorMin] = useState<string>("");
  const [valorMax, setValorMax] = useState<string>("");
  const [onlyAtrasadas, setOnlyAtrasadas] = useState(false);
  const [onlyAditivo25, setOnlyAditivo25] = useState(false);
  const [onlySemGeo, setOnlySemGeo] = useState(false);
  const [onlyAlertasCriticos, setOnlyAlertasCriticos] = useState(false);
  const [onlySemScore, setOnlySemScore] = useState(false);
  const [sortField, setSortField] = useState<SortField>("priority");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounce para a busca textual
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = (value: string) => {
    setQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(value);
      setPage(1);
    }, 400);
  };

  // ── Fetch ALL works for local filtering ──
  const {
    data: allWorksRaw,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["obras-all-extended"],
    queryFn: () => worksService.listAll({}),
    staleTime: 2 * 60_000,
  });

  const allWorks: ExtendedObra[] = useMemo(
    () => (allWorksRaw ?? []).map(adaptExtendedObra),
    [allWorksRaw],
  );

  // ── Derive filter options from data ──
  const bairros = useMemo(
    () => Array.from(new Set(allWorks.map((w) => w.bairro).filter((b) => b !== "—"))).sort(),
    [allWorks],
  );

  const secretarias = useMemo(
    () => Array.from(new Set(allWorks.map((w) => w.secretaria).filter((s) => s !== "—"))).sort(),
    [allWorks],
  );

  const fornecedores = useMemo(
    () => Array.from(new Set(allWorks.map((w) => w.fornecedor).filter((f) => f !== "—"))).sort(),
    [allWorks],
  );

  // ── Local filtering ──
  const filtered = useMemo(() => {
    let result = [...allWorks];

    // Text search
    if (debouncedQ) {
      const k = debouncedQ.toLowerCase();
      result = result.filter((o) => {
        const searchable = [
          o.nome,
          o.bairro,
          o.secretaria,
          o.fornecedor,
          o.contract_number,
          o.bidding_number,
          o.municipio,
          o.numero_contrato,
        ]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(k));
        return searchable;
      });
    }

    // Município
    if (mun !== "todos") {
      result = result.filter((o) => o.municipio === mun);
    }

    // Bairro
    if (bairro !== "todos") {
      result = result.filter((o) => o.bairro === bairro);
    }

    // Secretaria
    if (secretaria !== "todos") {
      result = result.filter((o) => o.secretaria === secretaria);
    }

    // Fornecedor
    if (fornecedor !== "todos") {
      result = result.filter((o) => o.fornecedor === fornecedor);
    }

    // Status
    if (status !== "todos") {
      result = result.filter((o) => o.status === status);
    }

    // Classificação de risco
    if (classificacao !== "todos") {
      result = result.filter((o) => o.classificacao_risco === classificacao);
    }

    // Valor mínimo
    if (valorMin) {
      const minVal = parseFloat(valorMin);
      if (!isNaN(minVal)) {
        result = result.filter((o) => o.valor_contratado >= minVal);
      }
    }

    // Valor máximo
    if (valorMax) {
      const maxVal = parseFloat(valorMax);
      if (!isNaN(maxVal)) {
        result = result.filter((o) => o.valor_contratado <= maxVal);
      }
    }

    // Somente atrasadas
    if (onlyAtrasadas) {
      result = result.filter((o) => o.dias_atraso > 0);
    }

    // Somente aditivo acima de 25%
    if (onlyAditivo25) {
      result = result.filter((o) => (o.additive_pct ?? 0) > 0.25);
    }

    // Somente sem geolocalização
    if (onlySemGeo) {
      result = result.filter((o) => !o.lat || !o.lng);
    }

    // Somente com alertas críticos
    if (onlyAlertasCriticos) {
      result = result.filter((o) => o.alertas_ativos > 0);
    }

    // Somente sem score
    if (onlySemScore) {
      result = result.filter((o) => o.eficiencia == null);
    }

    return result;
  }, [
    allWorks,
    debouncedQ,
    mun,
    bairro,
    secretaria,
    fornecedor,
    status,
    classificacao,
    valorMin,
    valorMax,
    onlyAtrasadas,
    onlyAditivo25,
    onlySemGeo,
    onlyAlertasCriticos,
    onlySemScore,
  ]);

  // ── Sorting ──
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortField) {
      case "priority":
        // Priority: critical first, then by atraso desc, then by score asc (low score = high risk)
        arr.sort((a, b) => {
          const aRisk = riskPriority(a.classificacao_risco);
          const bRisk = riskPriority(b.classificacao_risco);
          if (aRisk !== bRisk) return aRisk - bRisk;
          if (a.dias_atraso !== b.dias_atraso) return b.dias_atraso - a.dias_atraso;
          const aScore = a.eficiencia ?? 100;
          const bScore = b.eficiencia ?? 100;
          return aScore - bScore;
        });
        break;
      case "score":
        arr.sort((a, b) => (a.eficiencia ?? 100) - (b.eficiencia ?? 100));
        break;
      case "atraso":
        arr.sort((a, b) => b.dias_atraso - a.dias_atraso);
        break;
      case "valor":
        arr.sort((a, b) => b.valor_contratado - a.valor_contratado);
        break;
      case "alertas":
        arr.sort((a, b) => b.alertas_ativos - a.alertas_ativos);
        break;
      case "nome":
        arr.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
    }
    return arr;
  }, [filtered, sortField]);

  // ── Pagination ──
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  // ── Summary cards ──
  const stats = useMemo(() => {
    const criticas = filtered.filter(
      (o) => o.classificacao_risco === "Crítico" || o.classificacao_risco === "Alto risco",
    ).length;
    const atrasadas = filtered.filter((o) => o.dias_atraso > 0).length;
    const valorTotal = filtered.reduce((s, o) => s + o.valor_contratado, 0);
    const semGeo = filtered.filter((o) => !o.lat || !o.lng).length;
    return { total: filtered.length, criticas, atrasadas, valorTotal, semGeo };
  }, [filtered]);

  // ── Municípios para filtro ──
  const municipios = useMemo(
    () => Array.from(new Set(allWorks.map((w) => w.municipio).filter(Boolean))).sort(),
    [allWorks],
  );

  // ── Clear all filters ──
  const clearFilters = useCallback(() => {
    setQ("");
    setDebouncedQ("");
    setMun("todos");
    setBairro("todos");
    setSecretaria("todos");
    setFornecedor("todos");
    setStatus("todos");
    setClassificacao("todos");
    setValorMin("");
    setValorMax("");
    setOnlyAtrasadas(false);
    setOnlyAditivo25(false);
    setOnlySemGeo(false);
    setOnlyAlertasCriticos(false);
    setOnlySemScore(false);
    setSortField("priority");
    setPage(1);
  }, []);

  const hasActiveFilters =
    debouncedQ ||
    mun !== "todos" ||
    bairro !== "todos" ||
    secretaria !== "todos" ||
    fornecedor !== "todos" ||
    status !== "todos" ||
    classificacao !== "todos" ||
    valorMin ||
    valorMax ||
    onlyAtrasadas ||
    onlyAditivo25 ||
    onlySemGeo ||
    onlyAlertasCriticos ||
    onlySemScore;

  return (
    <div>
      <PageHeader
        title="Obras Públicas"
        description="Análise e monitoramento das obras públicas com score ARGUS e alertas de risco."
      />

      {/* ── Summary Cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          icon={BarChart3}
          label="Total filtrado"
          value={String(stats.total)}
          helper="obras"
          tone="primary"
        />
        <SummaryCard
          icon={ShieldAlert}
          label="Críticas / Alto risco"
          value={String(stats.criticas)}
          helper="obras em risco"
          tone="danger"
        />
        <SummaryCard
          icon={Clock}
          label="Atrasadas"
          value={String(stats.atrasadas)}
          helper="com prazo vencido"
          tone="warning"
        />
        <SummaryCard
          icon={DollarSign}
          label="Valor total"
          value={fmtBRLCompact(stats.valorTotal)}
          helper="contratado"
          tone="success"
        />
        <SummaryCard
          icon={MapPinOff}
          label="Sem geolocalização"
          value={String(stats.semGeo)}
          helper="obras"
          tone="accent"
        />
      </div>

      {/* ── Filters Section ── */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            Filtros
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
              <RotateCcw className="mr-1 h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Row 1: Text search + Município */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por obra, contrato, fornecedor, secretaria ou licitação..."
              className="pl-9 bg-background"
            />
          </div>
          <Select
            value={mun}
            onValueChange={(v) => {
              setMun(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-background">
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
        </div>

        {/* Row 2: Bairro, Secretaria, Fornecedor, Status */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
          <Select
            value={bairro}
            onValueChange={(v) => {
              setBairro(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Bairro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bairros</SelectItem>
              {bairros.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={secretaria}
            onValueChange={(v) => {
              setSecretaria(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Secretaria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as secretarias</SelectItem>
              {secretarias.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={fornecedor}
            onValueChange={(v) => {
              setFornecedor(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os fornecedores</SelectItem>
              {fornecedores.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
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
            <SelectTrigger className="bg-background">
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
        </div>

        {/* Row 3: Classificação, Valor min/max */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
          <Select
            value={classificacao}
            onValueChange={(v) => {
              setClassificacao(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Classificação de risco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as classificações</SelectItem>
              <SelectItem value="Eficiente">Eficiente</SelectItem>
              <SelectItem value="Atenção">Atenção</SelectItem>
              <SelectItem value="Alto risco">Alto risco</SelectItem>
              <SelectItem value="Crítico">Crítico</SelectItem>
              <SelectItem value="Sem dados">Sem dados</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              value={valorMin}
              onChange={(e) => {
                setValorMin(e.target.value);
                setPage(1);
              }}
              placeholder="Valor mínimo (R$)"
              className="pl-9 bg-background"
            />
          </div>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              value={valorMax}
              onChange={(e) => {
                setValorMax(e.target.value);
                setPage(1);
              }}
              placeholder="Valor máximo (R$)"
              className="pl-9 bg-background"
            />
          </div>
        </div>

        {/* Row 4: Checkbox filters */}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <Checkbox
              checked={onlyAtrasadas}
              onCheckedChange={(v) => {
                setOnlyAtrasadas(!!v);
                setPage(1);
              }}
            />
            Somente atrasadas
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <Checkbox
              checked={onlyAditivo25}
              onCheckedChange={(v) => {
                setOnlyAditivo25(!!v);
                setPage(1);
              }}
            />
            Aditivo acima de 25%
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <Checkbox
              checked={onlySemGeo}
              onCheckedChange={(v) => {
                setOnlySemGeo(!!v);
                setPage(1);
              }}
            />
            Sem geolocalização
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <Checkbox
              checked={onlyAlertasCriticos}
              onCheckedChange={(v) => {
                setOnlyAlertasCriticos(!!v);
                setPage(1);
              }}
            />
            Com alertas críticos
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <Checkbox
              checked={onlySemScore}
              onCheckedChange={(v) => {
                setOnlySemScore(!!v);
                setPage(1);
              }}
            />
            Sem score ARGUS
          </label>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {/* Sort controls */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Ordenar por:</span>
          {(
            [
              ["priority", "Prioridade / Risco"],
              ["score", "Score ARGUS"],
              ["atraso", "Dias de atraso"],
              ["valor", "Valor contratado"],
              ["alertas", "Alertas"],
              ["nome", "Nome"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={sortField === key ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSortField(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message="Nenhuma obra encontrada com os filtros aplicados."
              hint="Ajuste os filtros ou clique em 'Limpar filtros' para ver mais resultados."
            />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-30rem)]">
            <table className="w-full text-sm min-w-[1400px]">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-3 font-medium w-[200px]">Obra</th>
                  <th className="px-3 py-3 font-medium w-[120px]">Bairro</th>
                  <th className="px-3 py-3 font-medium w-[140px]">Secretaria</th>
                  <th className="px-3 py-3 font-medium w-[160px]">Fornecedor</th>
                  <th className="px-3 py-3 font-medium text-right w-[130px]">Valor contratado</th>
                  <th className="px-3 py-3 font-medium w-[100px]">Prazo previsto</th>
                  <th className="px-3 py-3 font-medium text-right w-[80px]">Dias atraso</th>
                  <th className="px-3 py-3 font-medium w-[130px]">Execução</th>
                  <th className="px-3 py-3 font-medium w-[100px]">Score ARGUS</th>
                  <th className="px-3 py-3 font-medium w-[90px]">Risco</th>
                  <th className="px-3 py-3 font-medium text-center w-[70px]">Alertas</th>
                  <th className="px-3 py-3 font-medium w-[180px]">Motivo principal</th>
                  <th className="px-3 py-3 font-medium text-right w-[160px]">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.map((o) => (
                  <ObraTableRow key={o.id} obra={o} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
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

/* ──────────────────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────────────────── */

function riskPriority(classificacao: string): number {
  switch (classificacao) {
    case "Crítico":
      return 0;
    case "Alto risco":
      return 1;
    case "Atenção":
      return 2;
    case "Eficiente":
      return 3;
    default:
      return 4;
  }
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  helper?: string;
  tone: "primary" | "success" | "warning" | "danger" | "accent";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
    danger: "bg-destructive/10 text-destructive",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {helper && <p className="mt-0.5 text-[10px] text-muted-foreground">{helper}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ObraTableRow({ obra: o }: { obra: ExtendedObra }) {
  const hasGeo = !!o.lat && !!o.lng;
  const riskColor = riskBadgeColor(o.classificacao_risco);

  return (
    <tr className="transition-colors hover:bg-primary/5">
      {/* Obra */}
      <td className="px-3 py-3">
        <Link
          to="/obras/$id"
          params={{ id: o.id }}
          className="text-sm font-medium text-foreground hover:text-primary hover:underline line-clamp-2"
        >
          {o.nome}
        </Link>
      </td>

      {/* Bairro */}
      <td className="px-3 py-3 text-xs text-muted-foreground">{o.bairro}</td>

      {/* Secretaria */}
      <td className="px-3 py-3 text-xs text-muted-foreground line-clamp-1" title={o.secretaria}>
        {o.secretaria}
      </td>

      {/* Fornecedor */}
      <td className="px-3 py-3 text-xs text-muted-foreground line-clamp-1" title={o.fornecedor}>
        {o.fornecedor}
      </td>

      {/* Valor contratado */}
      <td className="px-3 py-3 text-right tabular-nums text-xs text-foreground">
        {fmtBRL(o.valor_contratado)}
      </td>

      {/* Prazo previsto */}
      <td className="px-3 py-3 text-xs text-muted-foreground">{fmtDate(o.data_fim_prevista)}</td>

      {/* Dias de atraso */}
      <td className="px-3 py-3 text-right">
        {o.dias_atraso > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive tabular-nums">
            <TrendingDown className="h-3 w-3" />
            {o.dias_atraso}d
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Execução financeira */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Progress value={o.percentual_execucao} className="h-2" />
          <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">
            {fmtPct(o.percentual_execucao)}
          </span>
        </div>
      </td>

      {/* Score ARGUS */}
      <td className="px-3 py-3">
        <ScoreBadge score={o.eficiencia ?? null} />
      </td>

      {/* Risco */}
      <td className="px-3 py-3">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskColor}`}
        >
          {o.classificacao_risco}
        </span>
      </td>

      {/* Alertas */}
      <td className="px-3 py-3 text-center">
        {o.alertas_ativos > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive tabular-nums">
            <AlertTriangle className="h-3 w-3" />
            {o.alertas_ativos}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        )}
      </td>

      {/* Motivo principal */}
      <td className="px-3 py-3">
        <span className="text-xs text-muted-foreground line-clamp-2" title={o.motivo_principal}>
          {o.motivo_principal}
        </span>
      </td>

      {/* Ação */}
      <td className="px-3 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
            <Link to="/obras/$id" params={{ id: o.id }}>
              <Eye className="mr-1 h-3.5 w-3.5" />
              Detalhes
            </Link>
          </Button>
          {hasGeo ? (
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Link to="/mapa" search={{ obra: o.id }}>
                <MapPin className="mr-1 h-3.5 w-3.5" />
                Mapa
              </Link>
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
              <MapPinOff className="h-3 w-3" />
              Sem geo
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
