import { createFileRoute, Link } from "@tanstack/react-router";
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
  Eye,
  ChevronDown,
  ChevronUp,
  Users,
  Database,
  ClipboardList,
  Target,
  Lightbulb,
  ArrowRight,
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
import { exportsService, analyticsService, worksService, reportsService } from "@/lib/api";
import { fmtBRL, fmtNumber, fmtDate, truncateToTitle } from "@/lib/format";
import { getRiskLevel } from "@/lib/score";
import type {
  WorkRead,
  ExecutiveReport,
  CriticalWorkReportItem,
  NeighborhoodReportItem,
  SupplierReportItem,
  DataQualityReportFull,
} from "@/types";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Plataforma Argus" }] }),
  component: RelatoriosPage,
});

/* ─── helpers ─────────────────────────────────────────────────────────── */

function statusDistribution(works: WorkRead[]) {
  const map: Record<string, number> = {};
  for (const w of works) {
    const s =
      w.status || (w.finished_at ? "Concluída" : w.signed_at ? "Em andamento" : "Planejada");
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
    {
      faixa: "R$ 500k–1M",
      total: works.filter(
        (w) => (w.contract_value ?? 0) > 500_000 && (w.contract_value ?? 0) <= 1_000_000,
      ).length,
    },
    {
      faixa: "R$ 1M–5M",
      total: works.filter(
        (w) => (w.contract_value ?? 0) > 1_000_000 && (w.contract_value ?? 0) <= 5_000_000,
      ).length,
    },
    {
      faixa: "R$ 5M–10M",
      total: works.filter(
        (w) => (w.contract_value ?? 0) > 5_000_000 && (w.contract_value ?? 0) <= 10_000_000,
      ).length,
    },
    {
      faixa: "Acima R$ 10M",
      total: works.filter((w) => (w.contract_value ?? 0) > 10_000_000).length,
    },
  ];
}

const RISK_COLORS: Record<string, string> = {
  Baixo: "#22C55E",
  Atenção: "#F59E0B",
  Alto: "#F97316",
  Crítico: "#DC2626",
};

/* ─── report card definitions ─────────────────────────────────────────── */

interface ReportCardDef {
  key: string;
  icon: typeof BarChart3;
  title: string;
  description: string;
  tags: string[];
  hasExport: boolean;
  hasPreview: boolean;
}

const REPORT_CARD_DEFS: ReportCardDef[] = [
  {
    key: "executive",
    icon: ClipboardList,
    title: "Relatório Executivo Geral",
    description:
      "Visão consolidada com KPIs principais, prioridades do dia, bairros críticos, fornecedores em revisão e recomendações executivas.",
    tags: ["KPIs", "Prioridades", "Recomendações"],
    hasExport: true,
    hasPreview: true,
  },
  {
    key: "critical-works",
    icon: AlertTriangle,
    title: "Obras Críticas",
    description:
      "Lista de obras com score ARGUS abaixo de 60, incluindo detalhes de atraso, aditivos e alertas ativos.",
    tags: ["Score < 60", "Atrasos", "Alertas"],
    hasExport: true,
    hasPreview: true,
  },
  {
    key: "alerts",
    icon: ShieldAlert,
    title: "Alertas",
    description:
      "Todos os alertas críticos detectados com detalhes da obra associada, código e mensagem.",
    tags: ["Críticos", "Severidade", "Mensagens"],
    hasExport: true,
    hasPreview: false,
  },
  {
    key: "contracts",
    icon: FileText,
    title: "Contratos",
    description:
      "Análise detalhada de contratos com foco em aditivos acumulados acima de 25% do valor original.",
    tags: ["Aditivos", "Valores", "Vigência"],
    hasExport: true,
    hasPreview: false,
  },
  {
    key: "suppliers",
    icon: Users,
    title: "Fornecedores",
    description:
      "Ranking consolidado de fornecedores com score médio, alertas, valor total e bairros de atuação.",
    tags: ["Ranking", "Score Médio", "Alertas"],
    hasExport: true,
    hasPreview: true,
  },
  {
    key: "neighborhoods",
    icon: MapPin,
    title: "Análise por Bairro",
    description:
      "Agrupamento de obras por bairro com indicadores de risco, valor total e obras críticas.",
    tags: ["Territorial", "Risco", "Investimento"],
    hasExport: true,
    hasPreview: true,
  },
  {
    key: "data-quality",
    icon: Database,
    title: "Qualidade dos Dados",
    description:
      "Relatório de completude dos dados: obras sem bairro, geolocalização, valor, fornecedor ou prazo.",
    tags: ["Completude", "Saneamento", "Score"],
    hasExport: false,
    hasPreview: true,
  },
];

/* ─── score color helper ──────────────────────────────────────────────── */

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-[color:var(--success)]";
  if (score >= 60) return "text-[color:var(--warning)]";
  if (score >= 40) return "text-orange-500";
  return "text-destructive";
}

function scoreBg(score: number | null | undefined): string {
  if (score == null) return "bg-muted";
  if (score >= 80) return "bg-[color:var(--success)]/10";
  if (score >= 60) return "bg-[color:var(--warning)]/10";
  if (score >= 40) return "bg-orange-500/10";
  return "bg-destructive/10";
}

/* ─── Executive Preview Component ─────────────────────────────────────── */

function ExecutivePreview({ data }: { data: ExecutiveReport }) {
  const k = data.kpis;
  return (
    <div className="space-y-6 rounded-xl border border-primary/20 bg-primary/5 p-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Prévia — Relatório Executivo</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Gerado em {fmtDate(data.gerado_em)}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Obras monitoradas</p>
          <p className="text-xl font-bold text-foreground">{fmtNumber(k.obras_monitoradas)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Score médio</p>
          <p className={`text-xl font-bold ${scoreColor(k.score_medio)}`}>
            {Math.round(k.score_medio)}/100
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Valor contratado</p>
          <p className="text-xl font-bold text-foreground">{fmtBRL(k.valor_total_contratado)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Executado</p>
          <p className="text-xl font-bold text-foreground">{k.percentual_executado}%</p>
        </div>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Eficientes", count: k.obras_eficientes, color: "text-[color:var(--success)]" },
          { label: "Atenção", count: k.obras_em_atencao, color: "text-[color:var(--warning)]" },
          { label: "Alto risco", count: k.obras_alto_risco, color: "text-orange-500" },
          { label: "Críticas", count: k.obras_criticas, color: "text-destructive" },
        ].map((r) => (
          <div key={r.label} className="rounded-md border border-border bg-card p-2 text-center">
            <p className={`text-lg font-bold ${r.color}`}>{r.count}</p>
            <p className="text-[10px] text-muted-foreground">{r.label}</p>
          </div>
        ))}
      </div>

      {/* Prioridades */}
      {data.prioridades_hoje.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Target className="h-4 w-4 text-destructive" /> Prioridades de hoje
          </h4>
          <div className="space-y-1.5">
            {data.prioridades_hoje.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.objeto}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.bairro || "—"} · {p.motivo}
                  </p>
                </div>
                <div className="ml-3 text-right">
                  <ScoreBadge score={p.score} />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {fmtBRL(p.valor_contratado)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bairros críticos */}
      {data.bairros_criticos.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-orange-500" /> Bairros críticos
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.bairros_criticos.slice(0, 6).map((b) => (
              <div key={b.bairro} className="rounded-md border border-border bg-card px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{b.bairro}</p>
                  <span className={`text-sm font-bold ${scoreColor(b.score_medio)}`}>
                    {Math.round(b.score_medio)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {b.obras} obra(s) · {b.obras_criticas} crítica(s) · {fmtBRL(b.valor_total)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fornecedores em revisão */}
      {data.fornecedores_revisao.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" /> Fornecedores que merecem revisão
          </h4>
          <div className="space-y-1.5">
            {data.fornecedores_revisao.slice(0, 5).map((f) => (
              <div
                key={f.fornecedor}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{f.fornecedor}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.obras} obra(s) · {f.alertas} alerta(s) · {fmtBRL(f.valor_total)}
                  </p>
                </div>
                <span className={`text-sm font-bold ${scoreColor(f.score_medio)}`}>
                  {Math.round(f.score_medio)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contratos com aditivos altos */}
      {data.contratos_aditivos_altos.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Wallet className="h-4 w-4 text-[color:var(--warning)]" /> Contratos com aditivos acima
            de 25%
          </h4>
          <div className="space-y-1.5">
            {data.contratos_aditivos_altos.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.objeto}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.fornecedor || "—"} · Original: {fmtBRL(c.valor_contratado)} · Aditivo:{" "}
                    {fmtBRL(c.valor_aditivo)}
                  </p>
                </div>
                <span className="ml-3 rounded-full bg-[color:var(--warning)]/10 px-2 py-0.5 text-xs font-bold text-[color:var(--warning)]">
                  +{c.percentual_aditivo}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas críticos */}
      {data.alertas_criticos.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Alertas críticos (
            {data.alertas_criticos.length})
          </h4>
          <div className="max-h-40 space-y-1 overflow-auto">
            {data.alertas_criticos.slice(0, 8).map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{a.obra}</p>
                  <p className="text-xs text-muted-foreground">{a.mensagem}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendações executivas */}
      {data.recomendacoes.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Lightbulb className="h-4 w-4 text-[color:var(--success)]" /> Recomendações executivas
          </h4>
          <ul className="space-y-1.5">
            {data.recomendacoes.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-sm text-foreground">{r}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── Critical Works Preview ──────────────────────────────────────────── */

function CriticalWorksPreview({ data }: { data: CriticalWorkReportItem[] }) {
  if (data.length === 0) return <EmptyState message="Nenhuma obra crítica encontrada." />;
  return (
    <div className="overflow-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
          <tr>
            <th className="px-3 py-2 font-medium">Obra</th>
            <th className="px-3 py-2 font-medium">Bairro</th>
            <th className="px-3 py-2 font-medium text-center">Score</th>
            <th className="px-3 py-2 font-medium text-right">Valor</th>
            <th className="px-3 py-2 font-medium text-center">Atraso</th>
            <th className="px-3 py-2 font-medium text-center">Alertas</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.slice(0, 20).map((w) => (
            <tr key={w.id} className="hover:bg-primary/5">
              <td
                className="max-w-[200px] truncate px-3 py-2 text-center font-medium text-foreground"
                title={w.objeto}
              >
                {truncateToTitle(w.objeto)}
              </td>
              <td className="px-3 py-2 text-center text-muted-foreground">{w.bairro || "—"}</td>
              <td className="px-3 py-2 text-center">
                <ScoreBadge score={w.score} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {fmtBRL(w.valor_contratado)}
              </td>
              <td className="px-3 py-2 text-center">
                {w.dias_atraso > 0 ? (
                  <span className="text-destructive font-medium">{w.dias_atraso}d</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                {w.alertas > 0 ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
                    {w.alertas}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
              <td className="px-3 py-2">
                <span className="text-xs text-muted-foreground">{w.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Neighborhoods Preview ───────────────────────────────────────────── */

function NeighborhoodsPreview({ data }: { data: NeighborhoodReportItem[] }) {
  if (data.length === 0) return <EmptyState message="Nenhum bairro encontrado." />;
  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((b) => (
        <div
          key={b.bairro}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{b.bairro}</p>
            <p className="text-xs text-muted-foreground">
              {b.obras} obra(s) · {b.obras_criticas} crítica(s) · {b.obras_atrasadas} atrasada(s) ·{" "}
              {fmtBRL(b.valor_total)}
            </p>
          </div>
          <div className="ml-3 text-right">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${scoreBg(b.score_medio)} ${scoreColor(b.score_medio)}`}
            >
              {b.score_medio != null ? Math.round(b.score_medio) : "—"}
            </span>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{b.classificacao}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Suppliers Preview ───────────────────────────────────────────────── */

function SuppliersPreview({ data }: { data: SupplierReportItem[] }) {
  if (data.length === 0) return <EmptyState message="Nenhum fornecedor encontrado." />;
  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((f) => (
        <div
          key={f.fornecedor}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{f.fornecedor}</p>
            <p className="text-xs text-muted-foreground">
              {f.contratos} contrato(s) · {f.obras_criticas} crítica(s) · {f.alertas_totais}{" "}
              alerta(s) · {fmtBRL(f.valor_total)}
            </p>
          </div>
          <div className="ml-3 text-right">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${scoreBg(f.score_medio)} ${scoreColor(f.score_medio)}`}
            >
              {f.score_medio != null ? Math.round(f.score_medio) : "—"}
            </span>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{f.classificacao}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Data Quality Preview ────────────────────────────────────────────── */

function DataQualityPreview({ data }: { data: DataQualityReportFull }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-foreground">{data.data_quality_score}%</p>
          <p className="text-xs text-muted-foreground">Score de qualidade</p>
        </div>
        <Progress value={data.data_quality_score} className="h-3 flex-1" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sem bairro", count: data.obras_sem_bairro },
          { label: "Sem geolocalização", count: data.obras_sem_geolocalizacao },
          { label: "Sem valor", count: data.obras_sem_valor },
          { label: "Sem fornecedor", count: data.obras_sem_fornecedor },
          { label: "Sem prazo", count: data.obras_sem_prazo },
          { label: "Sem score", count: data.obras_sem_score },
        ].map((item) => (
          <div key={item.label} className="rounded-md border border-border bg-card p-2 text-center">
            <p
              className={`text-lg font-bold ${item.count > 0 ? "text-[color:var(--warning)]" : "text-[color:var(--success)]"}`}
            >
              {item.count}
            </p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
      {data.obras_para_saneamento.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">
            Top obras para saneamento ({data.obras_para_saneamento.length})
          </p>
          <div className="max-h-40 space-y-1 overflow-auto">
            {data.obras_para_saneamento.slice(0, 5).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-1.5"
              >
                <p className="truncate text-xs text-foreground">{o.descricao}</p>
                <div className="ml-2 flex shrink-0 gap-1">
                  {o.problemas.map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-[color:var(--warning)]/10 px-1.5 py-0.5 text-[9px] text-[color:var(--warning)]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── component ──────────────────────────────────────────────────────── */

function RelatoriosPage() {
  const [munFilter, setMunFilter] = useState<string>("todos");
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["analytics", "summary", { municipio: "macae" }],
    queryFn: () => analyticsService.summary({ municipio: "macae" }),
  });

  const works = useQuery({
    queryKey: ["works", "relatorios"],
    queryFn: () => worksService.listAll({}),
  });

  /* ─── report-specific queries ─── */
  const executiveReport = useQuery({
    queryKey: ["reports", "executive", munFilter],
    queryFn: () => reportsService.executive(munFilter === "todos" ? "Macae" : munFilter),
    enabled: activePreview === "executive",
    staleTime: 5 * 60_000,
  });

  const criticalWorksReport = useQuery({
    queryKey: ["reports", "critical-works", munFilter],
    queryFn: () => reportsService.criticalWorks(munFilter === "todos" ? "Macae" : munFilter),
    enabled: activePreview === "critical-works",
    staleTime: 5 * 60_000,
  });

  const neighborhoodsReport = useQuery({
    queryKey: ["reports", "neighborhoods", munFilter],
    queryFn: () => reportsService.neighborhoods(munFilter === "todos" ? "Macae" : munFilter),
    enabled: activePreview === "neighborhoods",
    staleTime: 5 * 60_000,
  });

  const suppliersReport = useQuery({
    queryKey: ["reports", "suppliers", munFilter],
    queryFn: () => reportsService.suppliers(munFilter === "todos" ? "Macae" : munFilter),
    enabled: activePreview === "suppliers",
    staleTime: 5 * 60_000,
  });

  const dataQualityReport = useQuery({
    queryKey: ["reports", "data-quality", munFilter],
    queryFn: () => reportsService.dataQuality(munFilter === "todos" ? "Macae" : munFilter),
    enabled: activePreview === "data-quality",
    staleTime: 5 * 60_000,
  });

  const allWorks = useMemo(() => works.data ?? [], [works.data]);

  const municipios = useMemo(
    () => Array.from(new Set(allWorks.map((w) => w.municipio).filter(Boolean))).sort(),
    [allWorks],
  );

  const filteredWorks = useMemo(
    () => (munFilter === "todos" ? allWorks : allWorks.filter((w) => w.municipio === munFilter)),
    [allWorks, munFilter],
  );

  /* ─── analytics derivations ─── */
  const valorTotal = useMemo(
    () => filteredWorks.reduce((s, w) => s + (w.contract_value ?? 0), 0),
    [filteredWorks],
  );
  const valorPago = useMemo(
    () => filteredWorks.reduce((s, w) => s + (w.paid_value ?? w.settled_value ?? 0), 0),
    [filteredWorks],
  );
  const mediaScore = useMemo(() => {
    const scores = filteredWorks
      .map((w) => w.efficiency_score)
      .filter((s): s is number => s != null);
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

  const handleReportCsvExport = useCallback(
    async (key: string, title: string) => {
      setExportingKey(key);
      try {
        let rows: Record<string, unknown>[] = [];
        const mun = munFilter === "todos" ? "Macae" : munFilter;

        if (key === "executive") {
          const data = await reportsService.executive(mun);
          rows = data.prioridades_hoje.map((p) => ({
            ID: p.id,
            Obra: p.objeto,
            Bairro: p.bairro || "—",
            Fornecedor: p.fornecedor || "—",
            Score: p.score ?? "—",
            Classificação: p.classificacao,
            "Valor Contratado": fmtBRL(p.valor_contratado),
            Motivo: p.motivo,
          }));
        } else if (key === "critical-works") {
          const data = await reportsService.criticalWorks(mun);
          rows = data.map((w) => ({
            ID: w.id,
            Obra: w.objeto,
            Bairro: w.bairro || "—",
            Fornecedor: w.fornecedor || "—",
            Score: w.score ?? "—",
            Classificação: w.classificacao,
            "Valor Contratado": fmtBRL(w.valor_contratado),
            "Dias Atraso": w.dias_atraso,
            Alertas: w.alertas,
            Status: w.status,
          }));
        } else if (key === "suppliers") {
          const data = await reportsService.suppliers(mun);
          rows = data.map((f) => ({
            Fornecedor: f.fornecedor,
            Contratos: f.contratos,
            "Score Médio": f.score_medio ?? "—",
            Classificação: f.classificacao,
            "Obras Críticas": f.obras_criticas,
            "Valor Total": fmtBRL(f.valor_total),
            Alertas: f.alertas_totais,
          }));
        } else if (key === "neighborhoods") {
          const data = await reportsService.neighborhoods(mun);
          rows = data.map((b) => ({
            Bairro: b.bairro,
            Obras: b.obras,
            "Score Médio": b.score_medio ?? "—",
            Classificação: b.classificacao,
            "Obras Críticas": b.obras_criticas,
            "Obras Atrasadas": b.obras_atrasadas,
            "Valor Total": fmtBRL(b.valor_total),
          }));
        } else {
          rows = filteredWorks.map((w) => ({
            ID: w.id,
            Obra: w.object_description,
            Município: w.municipio,
            Status: w.status || "—",
            Score: w.efficiency_score ?? "—",
            "Valor Contratado": fmtBRL(w.contract_value ?? 0),
          }));
        }

        if (rows.length === 0) {
          toast.warning("Nenhum dado disponível para este relatório.");
          return;
        }

        exportsService.exportClientCsv(rows, `argus-${key}.csv`);
        toast.success(`${title} exportado com ${rows.length} registro(s).`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao gerar relatório.";
        toast.error(msg);
      } finally {
        setExportingKey(null);
      }
    },
    [filteredWorks, munFilter],
  );

  const togglePreview = (key: string) => {
    setActivePreview((prev) => (prev === key ? null : key));
  };

  /* ─── loading / error states ─── */
  if (works.isLoading) return <LoadingState rows={8} />;
  if (works.isError) return <ErrorState onRetry={() => works.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Relatórios e Análises"
        description="Gere, exporte e analise relatórios executivos a partir dos dados monitorados pela plataforma ARGUS."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={munFilter} onValueChange={setMunFilter}>
              <SelectTrigger className="w-48 bg-card">
                <SelectValue placeholder="Filtrar município" />
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
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
            {fmtBRL(valorPago)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-[color:var(--success)]" />
            {valorTotal > 0
              ? `${Math.round((valorPago / valorTotal) * 100)}% executado`
              : "Sem dados"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Saldo restante</p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
            {fmtBRL(valorTotal - valorPago)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-[color:var(--warning)]" />
            {valorTotal > 0
              ? `${Math.round(((valorTotal - valorPago) / valorTotal) * 100)}% pendente`
              : "Sem dados"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Eficiência média</p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
            {Math.round(mediaScore)}%
          </p>
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
                    <Cell
                      key={i}
                      fill={
                        ["#287BBE", "#22C55E", "#F59E0B", "#DC2626", "#94A3B8", "#8B5CF6"][i % 6]
                      }
                    />
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
                    <Progress
                      value={(m.total / (municipioData[0]?.total ?? 1)) * 100}
                      className="h-1.5 w-20"
                    />
                    <span className="w-12 text-right text-xs text-muted-foreground">
                      {m.total} obras
                    </span>
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
              <p className="font-semibold text-foreground">
                {Math.round(s.average_efficiency_score)}
              </p>
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

      {/* ─── Report Cards (new section) ─── */}
      <div className="mt-8">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Relatórios executivos</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Selecione um relatório para visualizar a prévia ou exportar os dados em CSV.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORT_CARD_DEFS.map((r) => {
            const isExporting = exportingKey === r.key;
            const isPreviewOpen = activePreview === r.key;
            return (
              <div
                key={r.key}
                className={`flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all ${
                  isPreviewOpen
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/20"
                }`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex gap-2 pt-4">
                  {r.hasPreview && (
                    <Button
                      size="sm"
                      variant={isPreviewOpen ? "default" : "outline"}
                      className={isPreviewOpen ? "bg-primary hover:bg-primary/90" : ""}
                      onClick={() => togglePreview(r.key)}
                    >
                      {isPreviewOpen ? (
                        <ChevronUp className="mr-1 h-4 w-4" />
                      ) : (
                        <Eye className="mr-1 h-4 w-4" />
                      )}
                      {isPreviewOpen ? "Fechar" : "Visualizar"}
                    </Button>
                  )}
                  {r.hasExport && (
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => handleReportCsvExport(r.key, r.title)}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="mr-1 h-4 w-4" />
                      )}
                      Exportar CSV
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Active Preview Panel ─── */}
      {activePreview && (
        <div className="mt-6">
          {activePreview === "executive" && (
            <>
              {executiveReport.isLoading ? (
                <LoadingState rows={4} />
              ) : executiveReport.data ? (
                <ExecutivePreview data={executiveReport.data} />
              ) : (
                <ErrorState onRetry={() => executiveReport.refetch()} />
              )}
            </>
          )}
          {activePreview === "critical-works" && (
            <>
              {criticalWorksReport.isLoading ? (
                <LoadingState rows={4} />
              ) : criticalWorksReport.data ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Obras com score abaixo de 60 ({criticalWorksReport.data.length})
                  </h3>
                  <CriticalWorksPreview data={criticalWorksReport.data} />
                </div>
              ) : (
                <ErrorState onRetry={() => criticalWorksReport.refetch()} />
              )}
            </>
          )}
          {activePreview === "neighborhoods" && (
            <>
              {neighborhoodsReport.isLoading ? (
                <LoadingState rows={4} />
              ) : neighborhoodsReport.data ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Análise por bairro ({neighborhoodsReport.data.length} bairros)
                  </h3>
                  <NeighborhoodsPreview data={neighborhoodsReport.data} />
                </div>
              ) : (
                <ErrorState onRetry={() => neighborhoodsReport.refetch()} />
              )}
            </>
          )}
          {activePreview === "suppliers" && (
            <>
              {suppliersReport.isLoading ? (
                <LoadingState rows={4} />
              ) : suppliersReport.data ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Ranking de fornecedores ({suppliersReport.data.length})
                  </h3>
                  <SuppliersPreview data={suppliersReport.data} />
                </div>
              ) : (
                <ErrorState onRetry={() => suppliersReport.refetch()} />
              )}
            </>
          )}
          {activePreview === "data-quality" && (
            <>
              {dataQualityReport.isLoading ? (
                <LoadingState rows={4} />
              ) : dataQualityReport.data ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Qualidade dos dados ({dataQualityReport.data.total_obras} obras)
                  </h3>
                  <DataQualityPreview data={dataQualityReport.data} />
                </div>
              ) : (
                <ErrorState onRetry={() => dataQualityReport.refetch()} />
              )}
            </>
          )}
        </div>
      )}

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
                  <th className="px-3 py-2 font-medium text-center">Município</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium text-right">Score</th>
                  <th className="px-3 py-2 font-medium text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...filteredWorks]
                  .sort((a, b) => (b.efficiency_score ?? 0) - (a.efficiency_score ?? 0))
                  .slice(0, 10)
                  .map((w) => (
                    <tr key={w.id} className="hover:bg-primary/5">
                      <td
                        className="max-w-[200px] truncate px-3 py-2 text-center font-medium text-foreground"
                        title={w.object_description}
                      >
                        {truncateToTitle(w.object_description)}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{w.municipio}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtBRL(w.contract_value ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ScoreBadge score={w.efficiency_score} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Link
                          to="/obras/$id"
                          params={{ id: String(w.id) }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Link>
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
        Os relatórios são gerados a partir dos endpoints oficiais do backend ARGUS (
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono">/api/v1/reports/*</code>
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono">
          /api/v1/exports/works.csv
        </code>
        ) e exportados localmente como CSV para filtros específicos.
        {munFilter !== "todos" && (
          <span className="ml-1 text-primary">Filtro ativo: {munFilter}</span>
        )}
      </p>
    </div>
  );
}
