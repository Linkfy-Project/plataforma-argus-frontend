import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building, Calendar, FileText, MapPin, Wallet, Gauge, ShieldAlert, Brain, BarChart3, Info, AlertTriangle, Clock, Percent, DollarSign, Repeat, Users, Cpu, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { AlertBadge } from "@/components/argus/AlertBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { Progress } from "@/components/ui/progress";
import { PredictiveRiskGroup, PredictiveRiskBadge, type RiskCategory } from "@/components/argus/PredictiveRiskBadge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { obrasService, alertasService, worksService } from "@/lib/api";
import { fmtBRL, fmtDate, fmtPct } from "@/lib/format";
import { ARGUS_PILLARS, getScoreHex } from "@/lib/score";
import type { ScoreExplain, ScoreAlert } from "@/types";

export const Route = createFileRoute("/_app/obras/$id")({
  component: ObraDetail,
});

/** Calcula a média dos 3 riscos preditivos (0–1) convertida para escala 0–100. */
function mlRiskScore(o: { risco_atraso?: number; risco_custo?: number; risco_retrabalho?: number }): number | null {
  const vals = [o.risco_atraso, o.risco_custo, o.risco_retrabalho].filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100);
}

function ObraDetail() {
  const { id } = Route.useParams();
  const obra = useQuery({ queryKey: ["obra", id], queryFn: () => obrasService.get(id) });
  const alertas = useQuery({ queryKey: ["alertas"], queryFn: () => alertasService.list() });
  const scoreExplain = useQuery<ScoreExplain | null>({
    queryKey: ["score-explain", id],
    queryFn: () => worksService.scoreExplain(id),
  });

  if (obra.isLoading) return <LoadingState />;
  if (obra.isError) return <ErrorState onRetry={() => obra.refetch()} />;
  if (!obra.data) return <EmptyState message="Obra não encontrada." />;
  const o = obra.data;
  const related = (alertas.data ?? []).filter((a) => a.obra_id === o.id);

  const riscos = [
    { label: "Atraso", value: o.risco_atraso, category: "delay" as RiskCategory },
    { label: "Custo", value: o.risco_custo, category: "cost" as RiskCategory },
    { label: "Retrabalho", value: o.risco_retrabalho, category: "rework" as RiskCategory },
  ].filter((r): r is typeof r & { value: number } => typeof r.value === "number");

  const preventiveActions = [];
  if ((o.risco_atraso ?? 0) >= 0.4) preventiveActions.push("Recomenda-se auditoria técnica presencial antes da liberação da próxima parcela financeira.");
  if ((o.risco_custo ?? 0) >= 0.4) preventiveActions.push("Solicitar revisão detalhada dos aditivos contratuais e justificativas de custo.");
  if ((o.risco_retrabalho ?? 0) >= 0.4) preventiveActions.push("Reforçar fiscalização técnica em campo e verificar qualidade dos materiais.");
  if (preventiveActions.length === 0 && riscos.length > 0) {
    preventiveActions.push("Manter monitoramento contínuo. Nenhuma ação preventiva urgente necessária no momento.");
  }

  const info: { label: string; value: string; icon: typeof MapPin }[] = [
    { label: "Município", value: o.municipio, icon: MapPin },
    { label: "Órgão responsável", value: o.orgao_responsavel, icon: Building },
    { label: "Empresa contratada", value: o.empresa_contratada, icon: FileText },
    { label: "Data de início", value: fmtDate(o.data_inicio), icon: Calendar },
    { label: "Previsão de término", value: fmtDate(o.data_fim_prevista), icon: Calendar },
  ];

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/obras"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar para obras</Link>
      </Button>
      <PageHeader
        title={o.nome}
        description={`Identificador ${o.id}`}
        actions={<StatusBadge status={o.status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Descrição</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{o.descricao}</p>

          <h3 className="mt-6 mb-3 text-sm font-semibold text-foreground">Informações gerais</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {info.map((i) => (
              <div key={i.label} className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3">
                <i.icon className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{i.label}</p>
                  <p className="text-sm font-medium text-foreground">{i.value}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mt-6 mb-3 text-sm font-semibold text-foreground">Linha do tempo</h3>
          <ol className="relative ml-3 space-y-4 border-l border-border pl-5">
            <li>
              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
              <p className="text-xs text-muted-foreground">{fmtDate(o.data_inicio)}</p>
              <p className="text-sm font-medium text-foreground">Início da obra</p>
            </li>
            <li>
              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-accent" />
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="text-sm font-medium text-foreground">
                Execução atual: {fmtPct(o.percentual_execucao)} • {fmtBRL(o.valor_executado)}
              </p>
            </li>
            <li>
              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-muted-foreground" />
              <p className="text-xs text-muted-foreground">{fmtDate(o.data_fim_prevista)}</p>
              <p className="text-sm font-medium text-foreground">Previsão de entrega</p>
            </li>
          </ol>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Indicadores financeiros</h3>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Valor contratado</dt>
                <dd className="font-medium text-foreground">{fmtBRL(o.valor_contratado)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Valor executado</dt>
                <dd className="font-medium text-foreground">{fmtBRL(o.valor_executado)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Saldo</dt>
                <dd className="font-medium text-foreground">{fmtBRL(o.valor_contratado - o.valor_executado)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Indicadores de execução</h3>
            <p className="mt-3 text-3xl font-semibold text-primary">{fmtPct(o.percentual_execucao)}</p>
            <Progress value={o.percentual_execucao} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">Percentual físico-financeiro executado.</p>
          </div>

          {(typeof o.eficiencia === "number" || riscos.length > 0) && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Indicadores preditivos</h3>
              </div>
              {typeof o.eficiencia === "number" && (
                <>
                  <p className="text-xs text-muted-foreground">Score de eficiência</p>
                  <p className="text-2xl font-semibold text-foreground">{Math.round(o.eficiencia)}%</p>
                  <Progress value={o.eficiencia} className="mt-2 h-2" />
                </>
              )}
              {riscos.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ShieldAlert className="h-3.5 w-3.5" /> Probabilidade de risco
                  </p>
                  {riscos.map((r) => (
                    <div key={r.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{r.label}</span>
                        <PredictiveRiskBadge category={r.category} probability={r.value} compact />
                      </div>
                      <Progress value={(r.value as number) * 100} className="h-1.5" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Composição do Score ARGUS — pilares individuais */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Composição do Score ARGUS</h3>
            </div>
            <div className="space-y-3">
              {ARGUS_PILLARS.map((pilar) => {
                const score =
                  pilar.key === "ml_risk"
                    ? mlRiskScore(o)
                    : ((o as unknown as Record<string, unknown>)[pilar.scoreField] as number | undefined) ?? null;
                return (
                  <div key={pilar.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {pilar.label} ({Math.round(pilar.weight * 100)}%)
                      </span>
                      <span className="font-medium">
                        {score != null ? Math.round(score) : "—"}/100
                      </span>
                    </div>
                    {/* Barra de progresso colorida conforme nível de risco */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, score ?? 0))}%`,
                          backgroundColor: getScoreHex(score),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {preventiveActions.length > 0 && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-orange-600" />
                <h3 className="text-sm font-semibold text-orange-700">Ações Preventivas Sugeridas (IA)</h3>
              </div>
              <ul className="space-y-2">
                {preventiveActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PredictiveRiskGroup
            delayProbability={o.risco_atraso}
            costProbability={o.risco_custo}
            reworkProbability={o.risco_retrabalho}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          />

          {/* ── Detalhamento do Score ARGUS (Score-Explain) ── */}
          {scoreExplain.data && (
            <ScoreExplainSection data={scoreExplain.data} />
          )}

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Alertas relacionados</h3>
            {related.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alerta registrado para esta obra.</p>
            ) : (
              <ul className="space-y-3">
                {related.map((a) => (
                  <li key={a.id} className="rounded-md border border-border p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <AlertBadge nivel={a.nivel} />
                      <span className="text-xs text-muted-foreground">{fmtDate(a.data_deteccao)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{a.titulo}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Infrações Técnicas (CREA Proxy) ── */}
          {(o.crea_light_count ?? 0) > 0 || (o.crea_medium_count ?? 0) > 0 || (o.crea_grave_count ?? 0) > 0 ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Infrações Técnicas (CREA Proxy)</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Infrações estimadas via proxy multi-fonte: TCE-RJ, Portal da Transparência (CGU) e detecção textual.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-background/50 p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{o.crea_light_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Leves (-5 pts)</p>
                </div>
                <div className="rounded-lg border border-border bg-background/50 p-3 text-center">
                  <p className="text-2xl font-bold text-orange-500">{o.crea_medium_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Médias (-15 pts)</p>
                </div>
                <div className="rounded-lg border border-border bg-background/50 p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{o.crea_grave_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Graves (-40 pts)</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Indicadores Geoespaciais ── */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Indicadores Geoespaciais</h3>
            </div>
            <dl className="space-y-3 text-sm">
              {o.territorial_overlap_ratio != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sobreposição territorial (raio 500m)</dt>
                  <dd className="font-medium">{(o.territorial_overlap_ratio * 100).toFixed(1)}%</dd>
                </div>
              )}
              {o.benchmark_cost_m2 != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Benchmark SINAPI (R$/m²)</dt>
                  <dd className="font-medium">{fmtBRL(o.benchmark_cost_m2)}</dd>
                </div>
              )}
              {o.latitude != null && o.longitude != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Coordenadas</dt>
                  <dd className="font-mono text-xs">{o.latitude?.toFixed(6)}, {o.longitude?.toFixed(6)}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Histórico de atualizações</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Dados sincronizados automaticamente com o backend Argus.</li>
              <li>• Última leitura de medições registrada.</li>
              <li>• Cadastro inicial importado do contrato.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Sub-componente: ScoreExplainSection
   Renderiza o detalhamento completo do cálculo ARGUS usando Accordion.
   ────────────────────────────────────────────────────────────────────────────── */

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-green-500/10 text-green-700 border-green-500/30",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  critical: "bg-red-500/10 text-red-700 border-red-500/30",
};

function ScoreExplainSection({ data }: { data: ScoreExplain }) {
  const components = data.components;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Detalhamento do Cálculo ARGUS</h3>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Score Final: {Math.round(data.efficiency_score)}/100
        </span>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {/* Pilar de Custo */}
        <AccordionItem value="cost">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span>Custo Paramétrico — {Math.round(data.cost_score)}/100</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <PillarDetail
              label="Custo"
              score={data.cost_score}
              weight={components.weights.cost}
              component={components.cost}
              fieldsOrder={["strategy", "actual_cost_m2", "benchmark_cost_m2", "area_m2", "expected_cost", "ratio"]}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Pilar de Prazo */}
        <AccordionItem value="deadline">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Prazo — {Math.round(data.deadline_score)}/100</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <PillarDetail
              label="Prazo"
              score={data.deadline_score}
              weight={components.weights.deadline}
              component={components.deadline}
              fieldsOrder={["days_overdue", "due_date", "today", "status"]}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Pilar de Qualidade */}
        <AccordionItem value="quality">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span>Qualidade — {Math.round(data.quality_score)}/100</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <PillarDetail
              label="Qualidade"
              score={data.quality_score}
              weight={components.weights.quality}
              component={components.quality}
              fieldsOrder={["additive_ratio", "additive_value", "contract_value", "additive_threshold", "crea_light", "crea_medium", "crea_grave", "crea_penalty"]}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Pilar de Recorrência */}
        <AccordionItem value="recurrence">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-purple-500" />
              <span>Recorrência — {Math.round(data.recurrence_score)}/100</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <PillarDetail
              label="Recorrência"
              score={data.recurrence_score}
              weight={components.weights.recurrence}
              component={components.recurrence}
              fieldsOrder={["strategy", "overlap_ratio", "fallback", "cnpj_count"]}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Pilar de Impacto Social */}
        <AccordionItem value="social_impact">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-500" />
              <span>Impacto Social — {Math.round(data.social_impact_score)}/100</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <PillarDetail
              label="Impacto Social"
              score={data.social_impact_score}
              weight={components.weights.social_impact}
              component={components.social_impact}
              fieldsOrder={["idh", "idh_source"]}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Multiplicador de Criticidade */}
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

        {/* Alertas Detectados */}
        <AccordionItem value="alerts">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>Alertas Detectados ({data.alerts.length})</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alerta detectado para esta obra.</p>
            ) : (
              <div className="space-y-2">
                {data.alerts.map((alert, i) => (
                  <AlertCard key={i} alert={alert} />
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/** Renderiza os detalhes de um pilar individual dentro do Accordion. */
function PillarDetail({
  label,
  score,
  weight,
  component,
  fieldsOrder,
}: {
  label: string;
  score: number;
  weight: number;
  component: Record<string, unknown>;
  fieldsOrder: string[];
}) {
  // Determina os campos a mostrar — tenta usar fieldsOrder primeiro, senão todos do objeto
  const knownFields = fieldsOrder.filter((k) => k in component);
  const extraFields = Object.keys(component).filter((k) => !knownFields.includes(k));
  const allFields = [...knownFields, ...extraFields];

  return (
    <div className="space-y-3">
      {/* Resumo do pilar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-3">
        <div>
          <p className="text-xs text-muted-foreground">Pilar: {label}</p>
          <p className="text-lg font-semibold text-foreground">{Math.round(score)}/100</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Peso no score</p>
          <p className="text-sm font-medium text-foreground">{Math.round(weight * 100)}%</p>
        </div>
      </div>

      {/* Campos detalhados */}
      {allFields.length > 0 ? (
        <div className="space-y-1.5">
          {allFields.map((key) => {
            const val = component[key];
            if (val === null || val === undefined) return null;
            return (
              <div key={key} className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-1.5">
                <span className="text-xs text-muted-foreground">{formatFieldName(key)}</span>
                <span className="text-xs font-medium text-foreground">{formatFieldValue(val)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum detalhe disponível para este pilar.</p>
      )}
    </div>
  );
}

/** Renderiza o detalhe do multiplicador de criticidade. */
function CriticalityDetail({ component }: { component: Record<string, unknown> }) {
  const applied = component.applied as boolean | undefined;
  const multiplier = component.multiplier as number | undefined;
  const idh = component.idh as number | undefined;
  const threshold = component.threshold as number | undefined;

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border p-3 ${applied ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/30 bg-green-500/5"}`}>
        <p className="text-sm font-medium text-foreground">
          {applied ? "⚠️ Multiplicador ativado" : "✅ Multiplicador não aplicado"}
        </p>
        {applied && multiplier && (
          <p className="mt-1 text-xs text-muted-foreground">
            IDH local ({idh?.toFixed(3) ?? "N/A"}) está abaixo de {threshold ?? 0.600}. Alertas foram multiplicados por <strong>{multiplier}x</strong>.
          </p>
        )}
        {!applied && idh !== undefined && idh !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            IDH local ({idh.toFixed(3)}) está acima do limiar ({threshold ?? 0.600}). Multiplicador de criticidade não se aplica.
          </p>
        )}
      </div>

      {/* Campos extras do componente */}
      {Object.entries(component)
        .filter(([k]) => !["applied", "multiplier", "idh", "threshold"].includes(k))
        .map(([key, val]) => (
          <div key={key} className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{formatFieldName(key)}</span>
            <span className="text-xs font-medium text-foreground">{formatFieldValue(val)}</span>
          </div>
        ))}
    </div>
  );
}

/** Renderiza um card individual de alerta. */
function AlertCard({ alert }: { alert: ScoreAlert }) {
  const severityClass = SEVERITY_COLORS[alert.severity?.toLowerCase()] ?? SEVERITY_COLORS["medium"];

  return (
    <div className={`rounded-lg border p-3 ${severityClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">{alert.code}</span>
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

/** Formata nome de campo snake_case para texto legível. */
function formatFieldName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Formata valor de campo para exibição. */
function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (typeof val === "number") {
    // Se for menor que 1, provavelmente é um ratio/percentual
    if (Math.abs(val) < 1 && val !== 0) return `${(val * 100).toFixed(1)}%`;
    if (Number.isInteger(val)) return val.toLocaleString("pt-BR");
    return val.toFixed(2);
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}