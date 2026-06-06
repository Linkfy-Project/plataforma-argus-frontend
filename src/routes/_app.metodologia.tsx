import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ShieldAlert, Scale, FlaskConical, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { Progress } from "@/components/ui/progress";
import { ARGUS_PILLARS, IDH_CRITICAL_THRESHOLD } from "@/lib/score";
import { worksService } from "@/lib/api";
import type { ScoringRules } from "@/types";

export const Route = createFileRoute("/_app/metodologia")({
  head: () => ({ meta: [{ title: "Metodologia ARGUS — Plataforma Argus" }] }),
  component: MetodologiaPage,
});

function MetodologiaPage() {
  /* ── Busca regras de scoring dinâmicas do backend ── */
  const { data: rules } = useQuery<ScoringRules | null>({
    queryKey: ["scoring-rules"],
    queryFn: () => worksService.scoringRules(),
    staleTime: 10 * 60_000, // cache por 10 minutos
  });

  /* ── Pesos: usa API quando disponível, fallback para ARGUS_PILLARS ── */
  const pillarsWithWeights = ARGUS_PILLARS.map((p) => ({
    ...p,
    weight: rules?.weights?.[p.key] ?? p.weight,
  }));

  /* ── Fórmula final dinâmica ── */
  const formulaLines = pillarsWithWeights.map(
    (p) => `${(p.weight * 100).toFixed(0).padStart(2)}% × ${p.label}`
  );
  const formulaText = `Score ARGUS = (\n${formulaLines.map((l, i) => (i === 0 ? "  " : "+ ") + l).join("\n")}\n) × Multiplicador de Criticidade`;

  /* ── Penalidades CREA: API ou fallback ── */
  const penalties = rules?.crea_penalties ?? { light: -5, medium: -15, grave: -40 };

  /* ── Multiplicador de criticidade: API ou fallback ── */
  const critMult = rules?.criticality_multiplier ?? {
    idh_below: IDH_CRITICAL_THRESHOLD,
    multiplier: 0.8,
    applies_to: "IDH municipal",
  };

  return (
    <div>
      <PageHeader
        title="Metodologia ARGUS"
        description="Como o Índice Composto de Eficiência ARGUS é calculado para cada obra pública monitorada em Macaé-RJ."
      />

      {/* ── Banner de origem dos dados ── */}
      {rules && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-primary">
          Pesos e regras atualizados dinamicamente via API <code>/api/v1/works/scoring/rules</code>.
        </div>
      )}

      {/* ── Seção: Índice Composto de Eficiência ARGUS ── */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Índice Composto de Eficiência ARGUS</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Score de 0 a 100 que combina seis pilares de avaliação técnica, socioeconômica e preditiva,
              ponderados conforme seu impacto sobre a eficiência da obra pública.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {pillarsWithWeights.map((p) => (
            <div key={p.key} className="rounded-lg border border-border bg-background/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{p.label}</p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {Math.round(p.weight * 100)}%
                </span>
              </div>
              <Progress value={p.weight * 100} className="mt-2 h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">{descricoes[p.key]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fórmula final + Penalidades CREA ── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Fórmula final</h3>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-foreground">
{formulaText}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            O Multiplicador de Criticidade reduz a tolerância e intensifica alertas em territórios
            de alta vulnerabilidade social — aplicado quando o{" "}
            <strong>{critMult.applies_to} {"<"} {critMult.idh_below.toFixed(3)}</strong>
            {critMult.multiplier !== 1 && (
              <> (multiplicador: <strong>{critMult.multiplier}×</strong>)</>
            )}
            .
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Penalidades CREA e gatilhos</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              • Infração <strong className="text-foreground">leve</strong>:{" "}
              <span className="text-destructive">{penalties.light} pontos</span>
            </li>
            <li>
              • Infração <strong className="text-foreground">média</strong>:{" "}
              <span className="text-destructive">{penalties.medium} pontos</span>
            </li>
            <li>
              • Infração <strong className="text-foreground">grave / embargo</strong>:{" "}
              <span className="text-destructive">{penalties.grave} pontos</span>
            </li>
            <li>• Aditivos acumulados acima de <strong className="text-foreground">25%</strong> sobre o valor original geram alerta.</li>
            <li>• Tolerância de <strong className="text-foreground">90 dias</strong> sobre o prazo contratual antes da classificação como atraso.</li>
          </ul>
        </div>
      </div>

      {/* ── Fórmulas Detalhadas por Pilar (via API) ── */}
      {rules?.formulas && Object.keys(rules.formulas).length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Fórmulas Detalhadas por Pilar</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Fórmulas matemáticas exatas retornadas pelo backend para cada componente do score ARGUS.
          </p>
          <div className="mt-4 space-y-3">
            {Object.entries(rules.formulas).map(([key, formula]) => {
              const pillar = ARGUS_PILLARS.find((p) => p.key === key);
              return (
                <div key={key} className="rounded-lg border border-border bg-background/50 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {pillar?.label ?? key}
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-2 text-xs leading-relaxed text-foreground">
                    {formula}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Regras Especiais (Multiplicador de Criticidade) ── */}
      {rules?.criticality_multiplier && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-foreground">Regras Especiais</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              • <strong className="text-foreground">Multiplicador de Criticidade ({critMult.multiplier}×):</strong>{" "}
              Aplicado quando {critMult.applies_to} {"<"} {critMult.idh_below.toFixed(3)}, reduzindo a
              tolerância e intensificando alertas em territórios de alta vulnerabilidade social.
            </li>
            <li>
              • <strong className="text-foreground">Teto de aditivos:</strong>{" "}
              Acúmulo de aditivos acima de 25% sobre o valor original gera alerta automático.
            </li>
            <li>
              • <strong className="text-foreground">Tolerância de prazo:</strong>{" "}
              90 dias de tolerância sobre o prazo contratual antes da classificação como atraso.
            </li>
            <li>
              • <strong className="text-foreground">Penalidades CREA:</strong>{" "}
              Leve ({penalties.light}), Média ({penalties.medium}), Grave/Embargo ({penalties.grave} pontos).
            </li>
          </ul>
        </div>
      )}

      {/* ── Escala de classificação ── */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Escala de classificação</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Eficiente", range: "80–100", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" },
            { label: "Atenção", range: "60–79", cls: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30" },
            { label: "Alto risco", range: "40–59", cls: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
            { label: "Crítico", range: "0–39", cls: "bg-destructive/10 text-destructive border-destructive/30" },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border px-3 py-2 text-center ${c.cls}`}>
              <p className="text-xs font-semibold uppercase tracking-wide">{c.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{c.range}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const descricoes: Record<string, string> = {
  cost: "Compara o custo praticado da obra com referências paramétricas (SINAPI/SICRO) para detectar superfaturamento.",
  deadline: "Avalia o cumprimento do cronograma físico-financeiro, com tolerância de 90 dias sobre o prazo contratual.",
  quality: "Penaliza aditivos acumulados acima de 25% e considera infrações CREA registradas.",
  recurrence: "Identifica concentração suspeita de contratos no mesmo fornecedor ou bairro em um curto intervalo.",
  social: "Pondera o impacto da obra sobre o IDH local e a vulnerabilidade socioeconômica da população beneficiada.",
  ml_risk: "Probabilidade preditiva de risco calculada por modelo de Machine Learning, baseada em histórico de atrasos, sobrecustos e retrabalho.",
};
