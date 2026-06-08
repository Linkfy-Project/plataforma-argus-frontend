import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building,
  Calendar,
  FileText,
  MapPin,
  Wallet,
  Gauge,
  ShieldAlert,
  Brain,
  BarChart3,
  Info,
  AlertTriangle,
  Clock,
  DollarSign,
  Repeat,
  Users,
  Cpu,
  ChevronRight,
  MapPinOff,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  Database,
  Percent,
  Timer,
  BadgeAlert,
} from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { AlertBadge } from "@/components/argus/AlertBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { Progress } from "@/components/ui/progress";
import {
  PredictiveRiskGroup,
  PredictiveRiskBadge,
  type RiskCategory,
} from "@/components/argus/PredictiveRiskBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { obrasService, alertasService, worksService, contratosService } from "@/lib/api";
import { fmtBRL, fmtBRLCompact, fmtDate, fmtDateTime, fmtPct, fmtNumber } from "@/lib/format";
import {
  ARGUS_PILLARS,
  getScoreHex,
  getRiskLevel,
  getRiskDescription,
  getSeverityColorClass,
  getSeverityLabel,
} from "@/lib/score";
import type { ScoreExplain, ScoreAlert, WorkRead, Obra, Alerta, ContractDetailRead } from "@/types";

export const Route = createFileRoute("/_app/obras/$id")({
  component: ObraDetail,
});

/* ──────────────────────────────────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────────────────────────────────── */

function ObraDetail() {
  const { id } = Route.useParams();

  const obra = useQuery({ queryKey: ["obra", id], queryFn: () => obrasService.get(id) });
  const workRaw = useQuery({ queryKey: ["work-raw", id], queryFn: () => worksService.get(id) });
  const alertas = useQuery({ queryKey: ["alertas"], queryFn: () => alertasService.list() });
  const scoreExplain = useQuery<ScoreExplain | null>({
    queryKey: ["score-explain", id],
    queryFn: () => worksService.scoreExplain(id),
  });
  const contrato = useQuery({
    queryKey: ["contrato-detail", id],
    queryFn: () => contratosService.get(id),
  });

  if (obra.isLoading) return <LoadingState />;
  if (obra.isError) return <ErrorState onRetry={() => obra.refetch()} />;
  if (!obra.data) return <EmptyState message="Obra não encontrada." />;

  const o = obra.data;
  const w = workRaw.data;
  const related = (alertas.data ?? []).filter((a) => a.obra_id === o.id);
  const riskLevel = getRiskLevel(o.eficiencia);
  const hasGeo = o.latitude != null && o.longitude != null;

  // Compute delay days
  const today = new Date();
  const dueDate = o.data_fim_prevista ? new Date(o.data_fim_prevista) : null;
  const diasAtraso =
    dueDate && dueDate < today && !w?.finished_at
      ? Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
      : 0;

  // Executive action suggestion
  const actionSuggestion = getActionSuggestion(o, diasAtraso, related.length);

  return (
    <div>
      {/* Back button */}
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/obras">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para obras
        </Link>
      </Button>

      {/* ── Executive Header ── */}
      <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight">{o.nome}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {o.bairro && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {o.bairro}
                </span>
              )}
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1">
                <Building className="h-3.5 w-3.5" />
                {o.orgao_responsavel}
              </span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {o.empresa_contratada}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={o.status} />
            <ScoreBadge score={o.eficiencia ?? null} />
            <RiskLevelBadge level={riskLevel} />
          </div>
        </div>

        {/* Action suggestion */}
        {actionSuggestion && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Brain className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                Ação sugerida
              </p>
              <p className="text-sm text-foreground mt-0.5">{actionSuggestion}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard icon={DollarSign} label="Contratado" value={fmtBRLCompact(o.valor_contratado)} />
        <KpiCard icon={Wallet} label="Pago / Liquidado" value={fmtBRLCompact(o.valor_executado)} />
        <KpiCard
          icon={Percent}
          label="Execução"
          value={fmtPct(o.percentual_execucao)}
          accent={
            o.percentual_execucao >= 80 ? "green" : o.percentual_execucao >= 50 ? "yellow" : "red"
          }
        />
        <KpiCard icon={Calendar} label="Início" value={fmtDate(o.data_inicio)} small />
        <KpiCard
          icon={Calendar}
          label="Prazo previsto"
          value={fmtDate(o.data_fim_prevista)}
          small
        />
        <KpiCard
          icon={Timer}
          label="Dias de atraso"
          value={diasAtraso > 0 ? `${diasAtraso}` : "—"}
          accent={diasAtraso > 180 ? "red" : diasAtraso > 0 ? "yellow" : "green"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Alertas ativos"
          value={String(related.length)}
          accent={related.length > 0 ? "red" : "green"}
        />
        <KpiCard
          icon={Database}
          label="Qualidade dados"
          value={hasGeo ? "Completo" : "Parcial"}
          accent={hasGeo ? "green" : "yellow"}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="resumo">Resumo Executivo</TabsTrigger>
          <TabsTrigger value="score">Score Explicado</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="territorial">Análise Territorial</TabsTrigger>
          <TabsTrigger value="dados">Dados Brutos</TabsTrigger>
        </TabsList>

        {/* ── Aba: Resumo Executivo ── */}
        <TabsContent value="resumo">
          <TabResumoExecutivo
            obra={o}
            diasAtraso={diasAtraso}
            riskLevel={riskLevel}
            alertCount={related.length}
            scoreExplain={scoreExplain.data}
          />
        </TabsContent>

        {/* ── Aba: Score Explicado ── */}
        <TabsContent value="score">
          {scoreExplain.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando detalhamento do score...
            </div>
          ) : scoreExplain.data ? (
            <TabScoreExplicado data={scoreExplain.data} />
          ) : (
            <EmptyState message="Score ainda não calculado para esta obra." />
          )}
        </TabsContent>

        {/* ── Aba: Contrato ── */}
        <TabsContent value="contrato">
          <TabContrato
            obra={o}
            work={w}
            contrato={contrato.data as ContractDetailRead | null | undefined}
          />
        </TabsContent>

        {/* ── Aba: Cronograma ── */}
        <TabsContent value="cronograma">
          <TabCronograma obra={o} work={w} diasAtraso={diasAtraso} />
        </TabsContent>

        {/* ── Aba: Alertas ── */}
        <TabsContent value="alertas">
          <TabAlertas alertas={related} scoreAlerts={scoreExplain.data?.alerts ?? []} />
        </TabsContent>

        {/* ── Aba: Análise Territorial ── */}
        <TabsContent value="territorial">
          <TabTerritorial obra={o} work={w} obraId={id} />
        </TabsContent>

        {/* ── Aba: Dados Brutos ── */}
        <TabsContent value="dados">
          <TabDadosBrutos work={w} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Sub-components: KPI Cards & Badges
   ────────────────────────────────────────────────────────────────────────────── */

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  small,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  accent?: "green" | "yellow" | "red";
  small?: boolean;
}) {
  const accentColors = {
    green: "text-[color:var(--success)]",
    yellow: "text-[color:var(--warning)]",
    red: "text-destructive",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p
        className={`text-sm font-semibold ${accent ? accentColors[accent] : "text-foreground"} ${small ? "text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function RiskLevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Eficiente:
      "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    Atenção:
      "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    "Alto risco": "bg-orange-500/15 text-orange-600 border-orange-500/30",
    Crítico: "bg-destructive/10 text-destructive border-destructive/30",
    "Sem dados": "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${colors[level] ?? colors["Sem dados"]}`}
    >
      {level}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Tab: Resumo Executivo
   ────────────────────────────────────────────────────────────────────────────── */

function TabResumoExecutivo({
  obra,
  diasAtraso,
  riskLevel,
  alertCount,
  scoreExplain,
}: {
  obra: NonNullable<ReturnType<typeof obrasService.get> extends Promise<infer T> ? T : never>;
  diasAtraso: number;
  riskLevel: string;
  alertCount: number;
  scoreExplain: ScoreExplain | null | undefined;
}) {
  // Build interpretive text
  const reasons: string[] = [];
  if (diasAtraso > 0) reasons.push(`atraso de ${diasAtraso} dias`);
  if (obra.risco_atraso && obra.risco_atraso >= 0.7) reasons.push("alto risco preditivo de atraso");
  if (obra.risco_custo && obra.risco_custo >= 0.7) reasons.push("alto risco preditivo de custo");
  if (alertCount > 0) reasons.push(`${alertCount} alerta(s) ativo(s)`);
  if (obra.eficiencia != null && obra.eficiencia < 40) reasons.push("score ARGUS crítico");
  else if (obra.eficiencia != null && obra.eficiencia < 60)
    reasons.push("score ARGUS em zona de atenção");

  const interpretation =
    riskLevel === "Sem dados"
      ? "Esta obra ainda não possui dados suficientes para uma análise completa pelo sistema ARGUS."
      : reasons.length > 0
        ? `Esta obra está classificada como ${riskLevel} principalmente por ${reasons.join(", ")}.`
        : `Esta obra está classificada como ${riskLevel}. Os indicadores estão dentro dos parâmetros esperados.`;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Resumo Executivo</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{interpretation}</p>
        </div>
      </div>

      {/* Description */}
      {obra.descricao && (
        <div className="mb-4 rounded-lg border border-border bg-background/60 p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Descrição da Obra
          </h4>
          <p className="text-sm text-foreground leading-relaxed">{obra.descricao}</p>
        </div>
      )}

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MetricBox label="Valor contratado" value={fmtBRL(obra.valor_contratado)} />
        <MetricBox label="Valor executado" value={fmtBRL(obra.valor_executado)} />
        <MetricBox label="Saldo" value={fmtBRL(obra.valor_contratado - obra.valor_executado)} />
        <MetricBox label="Execução física-financeira" value={fmtPct(obra.percentual_execucao)} />
        {obra.eficiencia != null && (
          <MetricBox label="Score ARGUS" value={`${Math.round(obra.eficiencia)}/100`} />
        )}
        {obra.risco_atraso != null && (
          <MetricBox label="Risco atraso (ML)" value={fmtPct(obra.risco_atraso * 100)} />
        )}
        {obra.risco_custo != null && (
          <MetricBox label="Risco custo (ML)" value={fmtPct(obra.risco_custo * 100)} />
        )}
        {obra.risco_retrabalho != null && (
          <MetricBox label="Risco retrabalho (ML)" value={fmtPct(obra.risco_retrabalho * 100)} />
        )}
      </div>

      {/* Preventive actions */}
      {scoreExplain && scoreExplain.alerts.length > 0 && (
        <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-orange-600" />
            <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
              Ações Preventivas Sugeridas
            </h4>
          </div>
          <ul className="space-y-1.5">
            {getPreventiveActions(obra).map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Tab: Score Explicado
   ────────────────────────────────────────────────────────────────────────────── */

function TabScoreExplicado({ data }: { data: ScoreExplain }) {
  const components = data.components;
  const pillars = [
    {
      key: "cost",
      label: "Custo Paramétrico",
      icon: DollarSign,
      iconColor: "text-emerald-500",
      score: data.cost_score,
      weight: components.weights.cost,
      component: components.cost,
      description:
        "Compara o custo real por m² com o benchmark SINAPI regional. Valores muito acima do benchmark penalizam o score.",
    },
    {
      key: "deadline",
      label: "Prazo / Cronograma",
      icon: Clock,
      iconColor: "text-blue-500",
      score: data.deadline_score,
      weight: components.weights.deadline,
      component: components.deadline,
      description:
        "Avalia atrasos em relação à data prevista de conclusão. Obras com prazo vencido recebem penalidades progressivas.",
    },
    {
      key: "quality",
      label: "Qualidade Técnica e Aditivos",
      icon: ShieldAlert,
      iconColor: "text-amber-500",
      score: data.quality_score,
      weight: components.weights.quality,
      component: components.quality,
      description:
        "Analisa aditivos contratuais e infrações técnicas (CREA). Aditivos acima de 25% e infrações graves reduzem significativamente o score.",
    },
    {
      key: "recurrence",
      label: "Recorrência Territorial",
      icon: Repeat,
      iconColor: "text-purple-500",
      score: data.recurrence_score,
      weight: components.weights.recurrence,
      component: components.recurrence,
      description:
        "Verifica concentração de contratos em uma mesma região. Sobreposição territorial indica possível superfaturamento ou fracionamento.",
    },
    {
      key: "social_impact",
      label: "Impacto Socioeconômico",
      icon: Users,
      iconColor: "text-teal-500",
      score: data.social_impact_score,
      weight: components.weights.social_impact,
      component: components.social_impact,
      description:
        "Considera o IDH local. Obras em regiões com IDH baixo têm prioridade social e recebem multiplicador de criticidade.",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Composição do Score ARGUS</h3>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            Score Final: {Math.round(data.efficiency_score)}/100
          </span>
        </div>

        {/* Visual pillar bars */}
        <div className="space-y-3">
          {pillars.map((p) => {
            const riskLevel = getRiskLevel(p.score);
            return (
              <div key={p.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <p.icon className={`h-3.5 w-3.5 ${p.iconColor}`} />
                    <span className="text-xs font-medium text-foreground">{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({Math.round(p.weight * 100)}%)
                    </span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">
                    {p.score != null ? Math.round(p.score) : "—"}/100
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, p.score ?? 0))}%`,
                      backgroundColor: getScoreHex(p.score),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed pillar accordions */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <Accordion type="single" collapsible className="w-full">
          {pillars.map((p) => (
            <AccordionItem key={p.key} value={p.key}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <p.icon className={`h-4 w-4 ${p.iconColor}`} />
                  <span>
                    {p.label} — {Math.round(p.score ?? 0)}/100
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Pilar: {p.label}</p>
                      <p className="text-lg font-semibold text-foreground">
                        {Math.round(p.score ?? 0)}/100
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Peso no score</p>
                      <p className="text-sm font-medium text-foreground">
                        {Math.round(p.weight * 100)}%
                      </p>
                    </div>
                  </div>
                  <PillarFields component={p.component} />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}

          {/* Criticality multiplier */}
          <AccordionItem value="criticality">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-rose-500" />
                <span>Multiplicador de Criticidade</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CriticalityDetail component={components.criticality_rule} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

function PillarFields({ component }: { component: Record<string, unknown> }) {
  const keys = Object.keys(component).filter((k) => {
    const v = component[k];
    return v !== null && v !== undefined;
  });
  if (keys.length === 0)
    return <p className="text-xs text-muted-foreground">Nenhum detalhe disponível.</p>;

  return (
    <div className="space-y-1">
      {keys.map((key) => (
        <div
          key={key}
          className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-1.5"
        >
          <span className="text-xs text-muted-foreground">{formatFieldName(key)}</span>
          <span className="text-xs font-medium text-foreground">
            {formatFieldValue(component[key])}
          </span>
        </div>
      ))}
    </div>
  );
}

function CriticalityDetail({ component }: { component: Record<string, unknown> }) {
  const applied = component.applied as boolean | undefined;
  const multiplier = component.multiplier as number | undefined;
  const idh = component.idh as number | undefined;
  const threshold = component.threshold as number | undefined;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border p-3 ${applied ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/30 bg-green-500/5"}`}
      >
        <p className="text-sm font-medium text-foreground">
          {applied ? "⚠️ Multiplicador ativado" : "✅ Multiplicador não aplicado"}
        </p>
        {applied && multiplier && (
          <p className="mt-1 text-xs text-muted-foreground">
            IDH local ({idh?.toFixed(3) ?? "N/A"}) está abaixo de {threshold ?? 0.6}. Alertas foram
            multiplicados por <strong>{multiplier}x</strong>.
          </p>
        )}
        {!applied && idh !== undefined && idh !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            IDH local ({idh.toFixed(3)}) está acima do limiar ({threshold ?? 0.6}). Multiplicador de
            criticidade não se aplica.
          </p>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Tab: Contrato
   ────────────────────────────────────────────────────────────────────────────── */

function TabContrato({
  obra,
  work,
  contrato,
}: {
  obra: Obra;
  work: WorkRead | null | undefined;
  contrato: ContractDetailRead | null | undefined;
}) {
  const contractData = [
    { label: "Número do contrato", value: work?.contract_number ?? obra.numero_contrato ?? "—" },
    { label: "Licitação", value: String(work?.bidding_number ?? "—") },
    { label: "Fornecedor", value: work?.contractor_name ?? obra.empresa_contratada ?? "—" },
    { label: "CNPJ", value: work?.contractor_document ?? "—" },
    {
      label: "Secretaria / Unidade Gestora",
      value: work?.managing_unit ?? obra.orgao_responsavel ?? "—",
    },
    {
      label: "Valor original",
      value: fmtBRL(work?.contract_value ?? (obra.valor_contratado as number) ?? 0),
    },
    {
      label: "Valor atual (com aditivos)",
      value: fmtBRL((work?.contract_value ?? 0) + (work?.additive_value ?? 0)),
    },
    {
      label: "Valor de aditivos",
      value:
        work?.additive_value != null
          ? `${fmtBRL(work.additive_value)} (${((work.additive_value / (work.contract_value ?? 1)) * 100).toFixed(1)}%)`
          : "—",
    },
    {
      label: "Valor pago",
      value: fmtBRL(
        work?.paid_value ?? work?.settled_value ?? (obra.valor_executado as number) ?? 0,
      ),
    },
    { label: "Tipo de contrato", value: work?.contract_type ?? "—" },
    {
      label: "Status",
      value: work?.finished_at
        ? "Encerrado"
        : work?.due_at && new Date(work.due_at) < new Date()
          ? "Vencido"
          : "Vigente",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        Dados Contratuais
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {contractData.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3"
          >
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Contrato detail from API if available */}
      {contrato &&
        contrato.alertas_detalhes &&
        Array.isArray(contrato.alertas_detalhes) &&
        contrato.alertas_detalhes.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Alertas vinculados ao contrato
            </h4>
            <div className="space-y-2">
              {(contrato.alertas_detalhes as Record<string, unknown>[]).map((alert, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border bg-background/40 p-2 text-xs"
                >
                  <span className="font-medium text-foreground">
                    {String(formatFieldValue(alert.code ?? alert.titulo ?? alert.message))}
                  </span>
                  {alert.severity != null && (
                    <span className="ml-2 text-muted-foreground">({String(alert.severity)})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Tab: Cronograma
   ────────────────────────────────────────────────────────────────────────────── */

function TabCronograma({
  obra,
  work,
  diasAtraso,
}: {
  obra: Obra;
  work: WorkRead | null | undefined;
  diasAtraso: number;
}) {
  const events: { date: string; label: string; color: string; icon: typeof Calendar }[] = [];

  if (work?.signed_at || obra.data_inicio) {
    events.push({
      date: (work?.signed_at ?? obra.data_inicio) as string,
      label: "Assinatura do contrato / Início da obra",
      color: "bg-primary",
      icon: Calendar,
    });
  }

  if (work?.due_at || obra.data_fim_prevista) {
    events.push({
      date: (work?.due_at ?? obra.data_fim_prevista) as string,
      label:
        diasAtraso > 0
          ? `Prazo de vencimento (vencido há ${diasAtraso} dias)`
          : "Prazo de vencimento previsto",
      color: diasAtraso > 0 ? "bg-destructive" : "bg-accent",
      icon: diasAtraso > 0 ? AlertTriangle : Calendar,
    });
  }

  if (work?.finished_at) {
    events.push({
      date: work.finished_at,
      label: "Conclusão da obra",
      color: "bg-[color:var(--success)]",
      icon: CheckCircle2,
    });
  }

  // Add alert events from work alerts
  (work?.alerts ?? []).slice(0, 5).forEach((a) => {
    events.push({
      date: a.created_at,
      label: `Alerta: ${a.code}`,
      color: "bg-orange-500",
      icon: AlertTriangle,
    });
  });

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        Linha do Tempo
      </h3>

      {events.length === 0 ? (
        <EmptyState message="Sem eventos de cronograma disponíveis." />
      ) : (
        <ol className="relative ml-3 space-y-6 border-l border-border pl-6">
          {events.map((evt, i) => {
            const Icon = evt.icon;
            return (
              <li key={i} className="relative">
                <span
                  className={`absolute -left-[1.65rem] mt-1 flex h-5 w-5 items-center justify-center rounded-full ${evt.color}`}
                >
                  <Icon className="h-3 w-3 text-white" />
                </span>
                <p className="text-xs text-muted-foreground">{fmtDate(evt.date)}</p>
                <p className="text-sm font-medium text-foreground">{evt.label}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Tab: Alertas
   ────────────────────────────────────────────────────────────────────────────── */

function TabAlertas({
  alertas,
  scoreAlerts,
}: {
  alertas: Array<{
    id: string;
    nivel: string;
    titulo: string;
    descricao: string;
    data_deteccao: string;
    acao_sugerida: string;
  }>;
  scoreAlerts: ScoreAlert[];
}) {
  const hasLegacy = alertas.length > 0;
  const hasScore = scoreAlerts.length > 0;

  if (!hasLegacy && !hasScore) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <EmptyState
          message="Nenhum alerta registrado para esta obra."
          hint="Ausência de alertas é um bom sinal."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legacy alerts */}
      {hasLegacy && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Alertas do Sistema ({alertas.length})
          </h3>
          <div className="space-y-3">
            {alertas.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <AlertBadge nivel={a.nivel as "Baixo" | "Médio" | "Alto" | "Crítico"} />
                  <span className="text-xs text-muted-foreground">{fmtDate(a.data_deteccao)}</span>
                </div>
                <p className="text-sm font-medium text-foreground">{a.titulo}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.descricao}</p>
                {a.acao_sugerida && (
                  <div className="mt-2 flex items-start gap-1.5 rounded bg-primary/5 px-2 py-1.5">
                    <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                    <span className="text-xs text-primary">{a.acao_sugerida}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score-level alerts */}
      {hasScore && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BadgeAlert className="h-4 w-4 text-primary" />
            Alertas do Score ARGUS ({scoreAlerts.length})
          </h3>
          <div className="space-y-2">
            {scoreAlerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Tab: Análise Territorial
   ────────────────────────────────────────────────────────────────────────────── */

function TabTerritorial({
  obra,
  work,
  obraId,
}: {
  obra: Obra;
  work: WorkRead | null | undefined;
  obraId: string;
}) {
  const hasGeo = obra.latitude != null && obra.longitude != null;
  const lat = obra.latitude;
  const lng = obra.longitude;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        Análise Territorial
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Bairro</p>
          <p className="text-sm font-medium text-foreground">
            {obra.bairro || work?.neighborhood || "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Município</p>
          <p className="text-sm font-medium text-foreground">{obra.municipio}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Endereço</p>
          <p className="text-sm font-medium text-foreground">
            {obra.endereco || work?.address || "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Coordenadas</p>
          {hasGeo ? (
            <p className="text-sm font-mono text-foreground">
              {lat?.toFixed(6)}, {lng?.toFixed(6)}
            </p>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPinOff className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sem geolocalização</p>
            </div>
          )}
        </div>
      </div>

      {/* Geospatial indicators */}
      {(work?.territorial_overlap_ratio != null ||
        work?.benchmark_cost_m2 != null ||
        work?.idh != null) && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Indicadores Geoespaciais
          </h4>
          <div className="space-y-2">
            {work?.territorial_overlap_ratio != null && (
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Sobreposição territorial (raio 500m)
                </span>
                <span className="text-xs font-medium">
                  {(work.territorial_overlap_ratio * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {work?.benchmark_cost_m2 != null && (
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">Benchmark SINAPI (R$/m²)</span>
                <span className="text-xs font-medium">{fmtBRL(work.benchmark_cost_m2)}</span>
              </div>
            )}
            {work?.idh != null && (
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">IDH do setor censitário</span>
                <span className="text-xs font-medium">{work.idh.toFixed(3)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map link */}
      {hasGeo ? (
        <Button asChild variant="outline" size="sm">
          <Link to="/mapa" search={{ obra: obraId }}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Abrir no mapa
          </Link>
        </Button>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
          <MapPinOff className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            Esta obra não possui coordenadas geográficas cadastradas. A análise territorial está
            limitada.
          </p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Tab: Dados Brutos
   ────────────────────────────────────────────────────────────────────────────── */

function TabDadosBrutos({ work }: { work: WorkRead | null | undefined }) {
  if (!work) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <EmptyState message="Dados brutos não disponíveis." />
      </div>
    );
  }

  const entries = Object.entries(work).filter(([, v]) => v !== null && v !== undefined);
  const alertEntries = work.alerts ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        Dados Brutos do Backend ({entries.length} campos)
      </h3>

      <div className="space-y-1 max-h-[500px] overflow-auto">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-start justify-between rounded border border-border/50 bg-background/40 px-3 py-1.5"
          >
            <span className="text-xs font-mono text-muted-foreground shrink-0 mr-4">{key}</span>
            <span className="text-xs font-mono text-foreground text-right break-all">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>

      {alertEntries.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Alertas ({alertEntries.length})
          </h4>
          <pre className="text-xs bg-background/60 rounded-lg p-3 overflow-auto max-h-[300px] border border-border">
            {JSON.stringify(alertEntries, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────────── */

function getActionSuggestion(
  o: {
    risco_atraso?: number;
    risco_custo?: number;
    risco_retrabalho?: number;
    eficiencia?: number;
  },
  diasAtraso: number,
  alertCount: number,
): string | null {
  if (diasAtraso > 180)
    return "Obra com atraso crítico. Recomenda-se auditoria técnica presencial imediata e revisão do cronograma físico-financeiro.";
  if (diasAtraso > 90)
    return "Atraso significativo detectado. Solicitar replanejamento e verificar justificativas do fornecedor.";
  if ((o.risco_atraso ?? 0) >= 0.7)
    return "Modelo preditivo indica alto risco de atraso. Reforçar fiscalização em campo.";
  if ((o.risco_custo ?? 0) >= 0.7)
    return "Modelo preditivo indica alto risco de estouro de custo. Auditar aditivos contratuais.";
  if (alertCount >= 3)
    return "Múltiplos alertas ativos. Revisar integralmente a situação da obra com a equipe técnica.";
  if (o.eficiencia != null && o.eficiencia < 40)
    return "Score ARGUS crítico. Agendar reunião com o gestor da obra para plano de ação.";
  return null;
}

function getPreventiveActions(o: {
  risco_atraso?: number;
  risco_custo?: number;
  risco_retrabalho?: number;
}): string[] {
  const actions: string[] = [];
  if ((o.risco_atraso ?? 0) >= 0.4)
    actions.push(
      "Recomenda-se auditoria técnica presencial antes da liberação da próxima parcela financeira.",
    );
  if ((o.risco_custo ?? 0) >= 0.4)
    actions.push("Solicitar revisão detalhada dos aditivos contratuais e justificativas de custo.");
  if ((o.risco_retrabalho ?? 0) >= 0.4)
    actions.push("Reforçar fiscalização técnica em campo e verificar qualidade dos materiais.");
  if (actions.length === 0)
    actions.push(
      "Manter monitoramento contínuo. Nenhuma ação preventiva urgente necessária no momento.",
    );
  return actions;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-green-500/10 text-green-700 border-green-500/30",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  critical: "bg-red-500/10 text-red-700 border-red-500/30",
};

function AlertCard({ alert }: { alert: ScoreAlert }) {
  const severityClass = SEVERITY_COLORS[alert.severity?.toLowerCase()] ?? SEVERITY_COLORS["medium"];

  return (
    <div className={`rounded-lg border p-3 ${severityClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">
            {alert.code}
          </span>
          <span className="text-xs font-medium capitalize">{alert.severity}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Peso: {alert.severity_weight}</span>
          <span>×{alert.severity_multiplier}</span>
          <span>= {alert.weighted_severity.toFixed(2)}</span>
        </div>
      </div>
      <p className="mt-1.5 text-sm">{alert.message}</p>
      {alert.details && Object.keys(alert.details).length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {Object.entries(alert.details).map(([key, val]) => (
            <div key={key} className="text-[10px]">
              <span className="text-muted-foreground">{formatFieldName(key)}: </span>
              <span className="font-medium">{formatFieldValue(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFieldName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (typeof val === "number") {
    if (Math.abs(val) < 1 && val !== 0) return `${(val * 100).toFixed(1)}%`;
    if (Number.isInteger(val)) return val.toLocaleString("pt-BR");
    return val.toFixed(2);
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/** Calcula a média dos 3 riscos preditivos (0–1) convertida para escala 0–100. */
function mlRiskScore(o: {
  risco_atraso?: number;
  risco_custo?: number;
  risco_retrabalho?: number;
}): number | null {
  const vals = [o.risco_atraso, o.risco_custo, o.risco_retrabalho].filter(
    (v): v is number => typeof v === "number",
  );
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100);
}
