import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { downloadReport } from "@/lib/pdf-report";
import {
  BarChart3,
  Building2,
  FileSpreadsheet,
  FileText,
  ShieldAlert,
  Wallet,
  Download,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  HardHat,
  Gauge,
  MapPin,
  CheckCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/argus/EmptyState";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportsService, analyticsService, worksService } from "@/lib/api";
import { fmtBRL, fmtNumber, fmtDate } from "@/lib/format";
import { getRiskLevel } from "@/lib/score";
import type { WorkRead } from "@/types";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Plataforma Argus" }] }),
  component: RelatoriosPage,
});

/* ─── helpers ─────────────────────────────────────────────────────────── */

function statusDistribution(works: WorkRead[]) {
  const map: Record<string, number> = {};
  for (const w of works) {
    const s = w.status || (w.finished_at ? "Concluída" : w.signed_at ? "Em andamento" : "Planejada");
    map[s] = (map[s] ?? 0) + 1;
  }
  return Object.entries(map).map(([name, total]) => ({ name, total }));
}

function riskDistribution(works: WorkRead[]) {
  const labels = ["Baixo", "Atenção", "Alto", "Crítico"];
  return labels.map((label) => ({
    label,
    total: works.filter((w) => getRiskLevel(w.efficiency_score) === label).length,
  }));
}

function municipalityDistribution(works: WorkRead[]) {
  const map: Record<string, number> = {};
  for (const w of works) {
    const m = w.municipio || "—";
    map[m] = (map[m] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function topContractors(works: WorkRead[]) {
  const map: Record<string, number> = {};
  for (const w of works) {
    const name = w.contractor_name?.trim();
    if (name) map[name] = (map[name] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function valueBuckets(works: WorkRead[]) {
  return [
    { faixa: "Até R$ 500k", total: works.filter((w) => (w.contract_value ?? 0) <= 500_000).length },
    { faixa: "R$ 500k–1M", total: works.filter((w) => (w.contract_value ?? 0) > 500_000 && (w.contract_value ?? 0) <= 1_000_000).length },
    { faixa: "R$ 1M–5M", total: works.filter((w) => (w.contract_value ?? 0) > 1_000_000 && (w.contract_value ?? 0) <= 5_000_000).length },
    { faixa: "R$ 5M–10M", total: works.filter((w) => (w.contract_value ?? 0) > 5_000_000 && (w.contract_value ?? 0) <= 10_000_000).length },
    { faixa: "Acima R$ 10M", total: works.filter((w) => (w.contract_value ?? 0) > 10_000_000).length },
  ];
}

const RISK_COLORS: Record<string, string> = {
  Baixo: "#22C55E",
  Atenção: "#F59E0B",
  Alto: "#F97316",
  Crítico: "#DC2626",
};

/* ─── report definitions ─────────────────────────────────────────────── */

interface ReportDef {
  key: string;
  icon: typeof BarChart3;
  title: string;
  desc: string;
  filename: string;
  filter: (works: WorkRead[]) => WorkRead[];
  columns: { key: string; label: string; fmt?: (v: unknown, w: WorkRead) => string }[];
}

const REPORT_COLUMNS = {
  basic: [
    { key: "id", label: "ID", fmt: (_: unknown, w: WorkRead) => String(w.id) },
    { key: "object_description", label: "Obra" },
    { key: "municipio", label: "Município" },
    { key: "status", label: "Status", fmt: (_: unknown, w: WorkRead) => w.status || "—" },
    { key: "contract_value", label: "Valor Contratado", fmt: (v: unknown) => fmtBRL(Number(v ?? 0)) },
    { key: "settled_value", label: "Valor Liquidado", fmt: (v: unknown) => fmtBRL(Number(v ?? 0)) },
    { key: "paid_value", label: "Valor Pago", fmt: (v: unknown) => fmtBRL(Number(v ?? 0)) },
    { key: "contractor_name", label: "Contratado", fmt: (v: unknown) => String(v ?? "—") },
    { key: "signed_at", label: "Assinatura", fmt: (v: unknown) => fmtDate(String(v ?? "")) },
    { key: "due_at", label: "Previsão", fmt: (v: unknown) => fmtDate(String(v ?? "")) },
    { key: "efficiency_score", label: "Score ARGUS", fmt: (v: unknown) => v != null ? `${Math.round(Number(v))}` : "—" },
  ],
  financial: [
    { key: "id", label: "ID", fmt: (_: unknown, w: WorkRead) => String(w.id) },
    { key: "object_description", label: "Obra" },
    { key: "municipio", label: "Município" },
    { key: "contract_value", label: "Valor Contratado", fmt: (v: unknown) => fmtBRL(Number(v ?? 0)) },
    { key: "committed_value", label: "Valor Empenhado", fmt: (v: unknown) => fmtBRL(Number(v ?? 0)) },
    { key: "settled_value", label: "Valor Liquidado", fmt: (v: unknown) => fmtBRL(Number(v ?? 0)) },
    { key: "paid_value", label: "Valor Pago", fmt: (v: unknown) => fmtBRL(Number(v ?? 0)) },
    { key: "additive_value", label: "Valor Aditivo", fmt: (v: unknown) => fmtBRL(Number(v ?? 0)) },
    { key: "contractor_name", label: "Contratado", fmt: (v: unknown) => String(v ?? "—") },
    { key: "contract_number", label: "Contrato", fmt: (v: unknown) => String(v ?? "S/N") },
    { key: "efficiency_score", label: "Score ARGUS", fmt: (v: unknown) => v != null ? `${Math.round(Number(v))}` : "—" },
  ],
  alerts: [
    { key: "alert_code", label: "Código" },
    { key: "alert_severity", label: "Severidade" },
    { key: "alert_message", label: "Mensagem" },
    { key: "work_id", label: "ID Obra" },
    { key: "work_name", label: "Obra" },
    { key: "municipio", label: "Município" },
    { key: "contractor_name", label: "Contratado", fmt: (v: unknown) => String(v ?? "—") },
    { key: "efficiency_score", label: "Score ARGUS", fmt: (v: unknown) => v != null ? `${Math.round(Number(v))}` : "—" },
  ],
};

function buildReportDefs(works: WorkRead[]): ReportDef[] {
  return [
    {
      key: "geral",
      icon: BarChart3,
      title: "Relatório geral",
      desc: "Visão consolidada de todas as obras monitoradas com scores, valores e status.",
      filename: "argus-relatorio-geral.csv",
      filter: (w) => w,
      columns: REPORT_COLUMNS.basic,
    },
    {
      key: "municipio",
      icon: Building2,
      title: "Relatório por município",
      desc: "Obras agrupadas por município com indicadores comparativos.",
      filename: "argus-relatorio-municipios.csv",
      filter: (w) => w,
      columns: REPORT_COLUMNS.basic,
    },
    {
      key: "status",
      icon: FileText,
      title: "Relatório por status",
      desc: "Distribuição das obras de acordo com seu status atual.",
      filename: "argus-relatorio-status.csv",
      filter: (w) => w,
      columns: [
        ...REPORT_COLUMNS.basic,
      ],
    },
    {
      key: "financeiro",
      icon: Wallet,
      title: "Relatório financeiro",
      desc: "Análise detalhada de valores contratados, executados, aditivos e saldos.",
      filename: "argus-relatorio-financeiro.csv",
      filter: (w) => w.filter((x) => (x.contract_value ?? 0) > 0),
      columns: REPORT_COLUMNS.financial,
    },
    {
      key: "alertas",
      icon: ShieldAlert,
      title: "Relatório de alertas",
      desc: "Todos os alertas críticos detectados com detalhes da obra associada.",
      filename: "argus-relatorio-alertas.csv",
      filter: (w) => w.filter((x) => (x.alerts ?? []).length > 0),
      columns: REPORT_COLUMNS.alerts,
    },
  ];
}

/** Gera linhas achatadas para CSV a partir de Works + colunas definidas. */
function buildRows(works: WorkRead[], def: ReportDef): Record<string, unknown>[] {
  if (def.key === "alertas") {
    const rows: Record<string, unknown>[] = [];
    for (const w of works) {
      for (const a of w.alerts ?? []) {
        rows.push({
          alert_code: a.code,
          alert_severity: a.severity,
          alert_message: a.message,
          work_id: w.id,
          work_name: w.object_description,
          municipio: w.municipio,
          contractor_name: w.contractor_name ?? "—",
          efficiency_score: w.efficiency_score ?? "—",
        });
      }
    }
    return rows;
  }
  return def.filter(works).map((w) => {
  const row: Record<string, unknown> = {};
  for (const col of def.columns) {
    const raw = (w as unknown as Record<string, unknown>)[col.key];
    row[col.label] = col.fmt ? col.fmt(raw, w) : (raw ?? "—");
  }
  return row;
});
}

/* ─── component ──────────────────────────────────────────────────────── */

function RelatoriosPage() {
  const [munFilter, setMunFilter] = useState<string>("todos");
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["analytics", "summary", { municipio: "macae" }],
    queryFn: () => analyticsService.summary({ municipio: "macae" }),
  });

  const works = useQuery({
    queryKey: ["works", "relatorios"],
    queryFn: () => worksService.listAll({}),
  });

  const allWorks = works.data ?? [];
  const reportDefs = useMemo(() => buildReportDefs(allWorks), [allWorks]);

  const municipios = useMemo(
    () => Array.from(new Set(allWorks.map((w) => w.municipio).filter(Boolean))).sort(),
    [allWorks],
  );

  const filteredWorks = useMemo(
    () => (munFilter === "todos" ? allWorks : allWorks.filter((w) => w.municipio === munFilter)),
    [allWorks, munFilter],
  );

  /* ─── analytics derivations ─── */
  const valorTotal = useMemo(() => filteredWorks.reduce((s, w) => s + (w.contract_value ?? 0), 0), [filteredWorks]);
  const valorPago = useMemo(() => filteredWorks.reduce((s, w) => s + (w.paid_value ?? w.settled_value ?? 0), 0), [filteredWorks]);
  const mediaScore = useMemo(() => {
    const scores = filteredWorks.map((w) => w.efficiency_score).filter((s): s is number => s != null);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }, [filteredWorks]);
  const totalAlertas = useMemo(
    () => filteredWorks.reduce((s, w) => s + (w.alerts?.length ?? 0), 0),
    [filteredWorks],
  );
  const atrasadas = useMemo(
    () => filteredWorks.filter((w) => getRiskLevel(w.efficiency_score) === "Crítico").length,
    [filteredWorks],
  );

  const riskData = useMemo(() => riskDistribution(filteredWorks), [filteredWorks]);
  const statusData = useMemo(() => statusDistribution(filteredWorks), [filteredWorks]);
  const municipioData = useMemo(() => municipalityDistribution(filteredWorks), [filteredWorks]);
  const contractorData = useMemo(() => topContractors(filteredWorks), [filteredWorks]);
  const valueData = useMemo(() => valueBuckets(filteredWorks), [filteredWorks]);

  const s = summary.data;

  /* ─── export handlers ─── */
  const handlePdfExport = useCallback(async () => {
    const key = "pdf";
    setExportingKey(key);
    try {
      if (filteredWorks.length === 0) {
        toast.warning("Nenhum dado disponível para gerar o PDF.");
        return;
      }
      downloadReport({
        title: "Relatório ARGUS",
        subtitle: munFilter !== "todos" ? `Município: ${munFilter}` : "Todos os municípios",
        municipio: munFilter !== "todos" ? munFilter : undefined,
        works: filteredWorks,
        includeRecommendations: true,
      });
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PDF.";
      toast.error(msg);
    } finally {
      setExportingKey(null);
    }
  }, [filteredWorks, munFilter]);

  const handleBackendExport = useCallback(async (type: "csv" | "xlsx") => {
    const key = `backend-${type}`;
    setExportingKey(key);
    try {
      if (type === "csv") {
        await exportsService.downloadCsv();
      } else {
        await exportsService.downloadXlsx();
      }
      toast.success(`Arquivo ${type.toUpperCase()} exportado com sucesso!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao exportar.";
      toast.error(msg);
    } finally {
      setExportingKey(null);
    }
  }, []);

  const handleReportExport = useCallback(async (def: ReportDef) => {
    const key = def.key;
    setExportingKey(key);
    try {
      const rows = buildRows(filteredWorks, def);
      if (rows.length === 0) {
        toast.warning("Nenhum dado disponível para este relatório com os filtros atuais.");
        return;
      }
      exportsService.exportClientCsv(rows, def.filename);
      toast.success(`${def.title} exportado com ${rows.length} registro(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar relatório.";
      toast.error(msg);
    } finally {
      setExportingKey(null);
    }
  }, [filteredWorks]);

  /* ─── loading / error states ─── */
  if (works.isLoading) return <LoadingState rows={8} />;
  if (works.isError) return <ErrorState onRetry={() => works.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Relatórios e Análises"
        description="Gere, exporte e analise relatórios oficiais a partir dos dados monitorados pela plataforma ARGUS."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={munFilter} onValueChange={setMunFilter}>
              <SelectTrigger className="w-48 bg-card">
                <SelectValue placeholder="Filtrar município" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os municípios</SelectItem>
                {municipios.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handlePdfExport}
              disabled={exportingKey === "pdf"}
            >
              {exportingKey === "pdf" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1 h-4 w-4" />
              )}
              Gerar PDF
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={() => handleBackendExport("xlsx")}
              disabled={exportingKey === "backend-xlsx"}
            >
              {exportingKey === "backend-xlsx" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              Exportar XLSX
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBackendExport("csv")}
              disabled={exportingKey === "backend-csv"}
            >
              {exportingKey === "backend-csv" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-1 h-4 w-4" />
              )}
              Exportar CSV
            </Button>
          </div>
        }
      />

      {/* ─── Summary Stats ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Obras no recorte"
          value={fmtNumber(filteredWorks.length)}
          icon={HardHat}
          tone="primary"
          helper={munFilter !== "todos" ? `Município: ${munFilter}` : "Todas as bases"}
        />
        <StatCard
          label="Score ARGUS médio"
          value={`${Math.round(mediaScore)} / 100`}
          icon={Gauge}
          tone="success"
          helper="Média do recorte atual"
        />
        <StatCard
          label="Valor contratado total"
          value={fmtBRL(valorTotal)}
          icon={Wallet}
          tone="accent"
          helper="Somatório dos contratos"
        />
        <StatCard
          label="Alertas registrados"
          value={fmtNumber(totalAlertas)}
          icon={AlertTriangle}
          tone="danger"
          helper={`${atrasadas} obras em risco crítico`}
        />
      </div>

      {/* ─── Financial KPIs ─── */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Valor liquidado/pago</p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{fmtBRL(valorPago)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-[color:var(--success)]" />
            {valorTotal > 0 ? `${Math.round((valorPago / valorTotal) * 100)}% executado` : "Sem dados"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Saldo restante</p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{fmtBRL(valorTotal - valorPago)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-[color:var(--warning)]" />
            {valorTotal > 0 ? `${Math.round(((valorTotal - valorPago) / valorTotal) * 100)}% pendente` : "Sem dados"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Eficiência média</p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{Math.round(mediaScore)}%</p>
          <Progress value={mediaScore} className="mt-2 h-2" />
        </div>
      </div>

      {/* ─── Charts Row ─── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Risk distribution */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Distribuição por risco</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" name="Obras" radius={[6, 6, 0, 0]}>
                  {riskData.map((d) => (
                    <Cell key={d.label} fill={RISK_COLORS[d.label] ?? "#94A3B8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status distribution */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Distribuição por status</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="total"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={["#287BBE", "#22C55E", "#F59E0B", "#DC2626", "#94A3B8", "#8B5CF6"][i % 6]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Value distribution */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Distribuição por valor</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valueData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="faixa" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="total" name="Obras" fill="#287BBE" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Top municipalities & contractors ─── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            Municípios com mais obras
          </div>
          {municipioData.length === 0 ? (
            <EmptyState message="Sem dados de municípios." />
          ) : (
            <ul className="space-y-2">
              {municipioData.map((m, i) => (
                <li key={m.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={(m.total / (municipioData[0]?.total ?? 1)) * 100} className="h-1.5 w-20" />
                    <span className="w-12 text-right text-xs text-muted-foreground">{m.total} obras</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            Contratados mais recorrentes
          </div>
          {contractorData.length === 0 ? (
            <EmptyState message="Sem dados de contratados." />
          ) : (
            <ul className="space-y-2">
              {contractorData.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">{c.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.total} contratos</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ─── ETL Status ─── */}
      {s && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Resumo analítico (API)</h3>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Total de obras (API)</p>
              <p className="font-semibold text-foreground">{fmtNumber(s.total_works)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Eficiência média (API)</p>
              <p className="font-semibold text-foreground">{Math.round(s.average_efficiency_score)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Obras atrasadas (API)</p>
              <p className="font-semibold text-destructive">{fmtNumber(s.delayed_works)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alertas críticos (API)</p>
              <p className="font-semibold text-destructive">{fmtNumber(s.critical_alerts)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Report Cards ─── */}
      <div className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Gerar relatórios detalhados</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportDefs.map((r) => {
            const rows = buildRows(filteredWorks, r);
            const isExporting = exportingKey === r.key;
            return (
              <div key={r.key} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <strong>{rows.length}</strong> registro(s) disponível(is)
                  {munFilter !== "todos" && ` em ${munFilter}`}
                </p>
                <div className="mt-auto pt-4">
                  <Button
                    size="sm"
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => handleReportExport(r)}
                    disabled={isExporting || rows.length === 0}
                  >
                    {isExporting ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="mr-1 h-4 w-4" />
                    )}
                    {rows.length === 0 ? "Sem dados" : "Gerar e exportar CSV"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Top Works by Score ─── */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle className="h-4 w-4 text-[color:var(--success)]" />
          Obras com melhor score ARGUS no recorte atual
        </div>
        {filteredWorks.length === 0 ? (
          <EmptyState message="Nenhuma obra disponível." />
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-2 font-medium">Obra</th>
                  <th className="px-3 py-2 font-medium">Município</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...filteredWorks]
                  .sort((a, b) => (b.efficiency_score ?? 0) - (a.efficiency_score ?? 0))
                  .slice(0, 10)
                  .map((w) => (
                    <tr key={w.id} className="hover:bg-primary/5">
                      <td className="max-w-[200px] truncate px-3 py-2 font-medium text-foreground">
                        {w.object_description}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{w.municipio}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtBRL(w.contract_value ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ScoreBadge score={w.efficiency_score} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      <p className="mt-6 text-xs text-muted-foreground">
        Os relatórios são gerados a partir dos endpoints oficiais do backend ARGUS
        (<code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono">/api/v1/exports/works.csv</code>
        e <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono">/api/v1/exports/works.xlsx</code>)
        ou exportados localmente como CSV para filtros específicos.
        {munFilter !== "todos" && (
          <span className="ml-1 text-primary">Filtro ativo: {munFilter}</span>
        )}
      </p>
    </div>
  );
}
