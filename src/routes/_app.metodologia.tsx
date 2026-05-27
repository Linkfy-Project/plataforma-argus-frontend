import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, ShieldAlert, Scale } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { Progress } from "@/components/ui/progress";
import { ARGUS_PILLARS, IDH_CRITICAL_THRESHOLD } from "@/lib/score";

export const Route = createFileRoute("/_app/metodologia")({
  head: () => ({ meta: [{ title: "Metodologia ARGUS — Plataforma Argus" }] }),
  component: MetodologiaPage,
});

function MetodologiaPage() {
  return (
    <div>
      <PageHeader
        title="Metodologia ARGUS"
        description="Como o Índice Composto de Eficiência ARGUS é calculado para cada obra pública monitorada em Macaé-RJ."
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Índice Composto de Eficiência ARGUS</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Score de 0 a 100 que combina cinco pilares de avaliação técnica e socioeconômica,
              ponderados conforme seu impacto sobre a eficiência da obra pública.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ARGUS_PILLARS.map((p) => (
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Fórmula final</h3>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-foreground">
{`Score ARGUS = (
  0,30 × Custo Paramétrico
+ 0,25 × Prazo / Cronograma
+ 0,20 × Qualidade Técnica e Aditivos
+ 0,15 × Recorrência Territorial
+ 0,10 × Impacto Socioeconômico
) × Multiplicador de Criticidade`}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            O Multiplicador de Criticidade reduz a tolerância e intensifica alertas em territórios
            de alta vulnerabilidade social — aplicado quando o <strong>IDH municipal &lt; {IDH_CRITICAL_THRESHOLD.toFixed(3)}</strong>.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Penalidades CREA e gatilhos</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Infração <strong className="text-foreground">leve</strong>: <span className="text-destructive">-5 pontos</span></li>
            <li>• Infração <strong className="text-foreground">média</strong>: <span className="text-destructive">-15 pontos</span></li>
            <li>• Infração <strong className="text-foreground">grave / embargo</strong>: <span className="text-destructive">-40 pontos</span></li>
            <li>• Aditivos acumulados acima de <strong className="text-foreground">25%</strong> sobre o valor original geram alerta.</li>
            <li>• Tolerância de <strong className="text-foreground">90 dias</strong> sobre o prazo contratual antes da classificação como atraso.</li>
          </ul>
        </div>
      </div>

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
};