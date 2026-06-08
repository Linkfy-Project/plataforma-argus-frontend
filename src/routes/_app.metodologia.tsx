import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ShieldAlert,
  Scale,
  FlaskConical,
  AlertTriangle,
  Clock,
  DollarSign,
  Repeat,
  Brain,
  MapPin,
  Info,
  CheckCircle,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
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
    (p) => `${(p.weight * 100).toFixed(0).padStart(2)}% × ${p.label}`,
  );
  const formulaText = `Score ARGUS = (\n${formulaLines.map((l, i) => (i === 0 ? "  " : "+ ") + l).join("\n")}\n) × Agravante Social`;

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
        description="Como o Índice Composto de Eficiência ARGUS é calculado para cada obra pública monitorada. Transparência total sobre critérios, pesos e regras de classificação."
      />

      {/* ── Banner de origem dos dados ── */}
      {rules && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-primary">
          Pesos e regras atualizados dinamicamente via API <code>/api/v1/works/scoring/rules</code>.
        </div>
      )}

      {/* ── Seção: O que é o Score ARGUS ── */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">O que é o Score ARGUS?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O Score ARGUS é um índice composto de <strong>0 a 100 pontos</strong> que avalia a
              eficiência de cada obra pública. Quanto <strong>maior</strong> o score,{" "}
              <strong>melhor</strong> a classificação da obra. O índice combina cinco pilares de
              avaliação técnica e preditiva, ponderados conforme seu impacto sobre a eficiência da
              obra pública. O IDH não compõe o score — ele atua como um{" "}
              <strong>Agravante Social</strong> (multiplicador de risco) aplicado sobre alertas em
              regiões de vulnerabilidade.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              O score é calculado automaticamente pelo sistema sempre que novos dados são inseridos
              ou atualizados na base. Ele serve como ferramenta de{" "}
              <strong>priorização para o gestor</strong>, indicando quais obras merecem atenção
              imediata.
            </p>
          </div>
        </div>

        {/* ── Escala de classificação ── */}
        <div className="mt-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Escala de classificação</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Eficiente",
                range: "80–100",
                description: "Indicadores dentro dos parâmetros esperados",
                cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
              },
              {
                label: "Atenção",
                range: "60–79",
                description: "Monitoramento ativo recomendado",
                cls: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
              },
              {
                label: "Alto risco",
                range: "40–59",
                description: "Sinais relevantes de risco — revisão necessária",
                cls: "bg-orange-500/15 text-orange-600 border-orange-500/30",
              },
              {
                label: "Crítico",
                range: "0–39",
                description: "Situação crítica — auditoria recomendada",
                cls: "bg-destructive/10 text-destructive border-destructive/30",
              },
            ].map((c) => (
              <div key={c.label} className={`rounded-lg border px-3 py-3 text-center ${c.cls}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">{c.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{c.range}</p>
                <p className="mt-1 text-[10px] opacity-80">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Exemplo prático ── */}
      <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/5 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Exemplo prático</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Uma obra com <strong className="text-foreground">score 42/100</strong> é classificada
              como <strong className="text-orange-600">Alto risco</strong>. Isso{" "}
              <strong>não significa automaticamente irregularidade</strong>, mas indica que ela deve
              ser priorizada para análise. O gestor deve verificar os pilares com pontuação mais
              baixa (ex: atraso no cronograma ou aditivos acima do limite) para entender a causa
              específica da classificação.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Da mesma forma, uma obra com <strong className="text-foreground">score 85/100</strong>{" "}
              está classificada como{" "}
              <strong className="text-[color:var(--success)]">Eficiente</strong>, indicando que seus
              indicadores estão dentro dos parâmetros esperados — mas isso não exclui a necessidade
              de acompanhamento contínuo.
            </p>
          </div>
        </div>
      </div>

      {/* ── Os 5 Pilares do Score ── */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Os 5 Pilares do Score ARGUS</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada pilar contribui com um peso específico para o cálculo final. O IDH não compõe o score
          — ele atua como Agravante Social. Os pesos podem ser ajustados via API conforme a política
          de monitoramento evolui.
        </p>

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

      {/* ── Como cada fator afeta o score ── */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FlaskConical className="h-5 w-5 text-primary" />
          Como cada fator afeta o score
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Entenda o impacto de cada variável no cálculo do índice de eficiência.
        </p>

        <div className="space-y-4">
          {/* Atraso */}
          <div className="rounded-lg border border-border bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-foreground">Como o atraso afeta o score</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              O pilar <strong>Prazo / Cronograma</strong> (peso de{" "}
              {Math.round((rules?.weights?.deadline ?? 0.25) * 100)}%) avalia se a obra está
              cumprindo o cronograma contratual. Existe uma <strong>tolerância de 90 dias</strong>{" "}
              sobre a data de entrega prevista. Após esse período, a obra é classificada como
              atrasada e o score de prazo é reduzido progressivamente. Quanto maior o atraso, maior
              a penalidade. Obras finalizadas dentro do prazo recebem pontuação máxima neste pilar.
            </p>
          </div>

          {/* Aditivos */}
          <div className="rounded-lg border border-border bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[color:var(--warning)]" />
              <h3 className="text-sm font-semibold text-foreground">
                Aditivos acima de 25% geram alerta
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              O pilar <strong>Qualidade Técnica e Aditivos</strong> (peso de{" "}
              {Math.round((rules?.weights?.quality ?? 0.2) * 100)}%) monitora o acúmulo de aditivos
              contratuais. Quando o valor total dos aditivos acumulados{" "}
              <strong>ultrapassa 25%</strong> do valor original do contrato, o sistema gera um
              alerta automático. Isso indica possível desvio de escopo ou planejamento inicial
              inadequado. Aditivos moderados (até 25%) são considerados normais em obras públicas.
            </p>
          </div>

          {/* Fornecedor recorrente */}
          <div className="rounded-lg border border-border bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Fornecedor recorrente aumenta a atenção
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              O pilar <strong>Recorrência Territorial</strong> (peso de{" "}
              {Math.round((rules?.weights?.recurrence ?? 0.15) * 100)}%) identifica concentrações
              suspeitas de contratos. Quando o mesmo fornecedor acumula múltiplas obras no mesmo
              bairro ou região em curto intervalo de tempo, o sistema aumenta o nível de atenção.
              Isso não configura irregularidade por si só, mas sinaliza que a situação merece
              investigação para verificar se há justificativa técnica para a concentração.
            </p>
          </div>

          {/* Geolocalização */}
          <div className="rounded-lg border border-border bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Falta de geolocalização afeta a qualidade da análise
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Obras sem coordenadas geográficas (latitude/longitude) ou sem bairro definido não
              podem ser analisadas pelo pilar de <strong>Recorrência Territorial</strong> nem
              receber o <strong>Agravante Social</strong> baseado no IDH local. Isso reduz a
              precisão da análise e pode resultar em score subestimado ou superestimado. O sistema
              prioriza o saneamento cadastral dessas obras para melhorar a cobertura analítica.
            </p>
          </div>

          {/* Risco preditivo */}
          <div className="rounded-lg border border-border bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-cyan-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Risco preditivo (Machine Learning)
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              O pilar <strong>Risco Preditivo</strong> (peso de{" "}
              {Math.round((rules?.weights?.ml_risk ?? 0.15) * 100)}%) utiliza um modelo de Machine
              Learning treinado com o histórico de obras para prever a probabilidade de atraso,
              sobrecusto e retrabalho. O modelo analisa padrões como: características do fornecedor,
              complexidade da obra, valor contratado, localização e histórico de performance. Os
              resultados são probabilísticos e servem como indicador adicional de priorização.
            </p>
          </div>
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
            O Agravante Social intensifica a criticidade dos alertas em territórios de alta
            vulnerabilidade social — aplicado quando o{" "}
            <strong>
              {critMult.applies_to} {"<"} {critMult.idh_below.toFixed(3)}
            </strong>
            {critMult.multiplier !== 1 && (
              <>
                {" "}
                (multiplicador: <strong>{critMult.multiplier}×</strong>)
              </>
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
            <li>
              • Aditivos acumulados acima de <strong className="text-foreground">25%</strong> sobre
              o valor original geram alerta.
            </li>
            <li>
              • Tolerância de <strong className="text-foreground">90 dias</strong> sobre o prazo
              contratual antes da classificação como atraso.
            </li>
          </ul>
        </div>
      </div>

      {/* ── Agravante Social (Multiplicador de Criticidade) ── */}
      <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/5 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Agravante Social — Multiplicador de Criticidade
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              O IDH (Índice de Desenvolvimento Humano) do setor censitário associado à obra{" "}
              <strong>não faz parte do score base de 0 a 100</strong>. Em vez disso, ele atua como
              um <strong>Agravante Social</strong>: quando o IDH é inferior a 0.600, a severidade e
              criticidade dos alertas gerados para aquela obra são multiplicadas por{" "}
              <strong>1.5×</strong>. Isso garante que obras em regiões de maior vulnerabilidade
              social recebam atenção prioritária do gestor, sem distorcer o score técnico de
              eficiência.
            </p>
          </div>
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
                  <p className="text-sm font-semibold text-foreground">{pillar?.label ?? key}</p>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-2 text-xs leading-relaxed text-foreground">
                    {formula}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Regras Especiais (Agravante Social) ── */}
      {rules?.criticality_multiplier && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-foreground">Regras Especiais</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              •{" "}
              <strong className="text-foreground">
                Agravante Social ({critMult.multiplier}×):
              </strong>{" "}
              Aplicado quando {critMult.applies_to} {"<"} {critMult.idh_below.toFixed(3)},
              intensificando a criticidade dos alertas em territórios de alta vulnerabilidade
              social. O IDH não altera o score base, apenas a severidade dos alertas.
            </li>
            <li>
              • <strong className="text-foreground">Teto de aditivos:</strong> Acúmulo de aditivos
              acima de 25% sobre o valor original gera alerta automático.
            </li>
            <li>
              • <strong className="text-foreground">Tolerância de prazo:</strong> 90 dias de
              tolerância sobre o prazo contratual antes da classificação como atraso.
            </li>
            <li>
              • <strong className="text-foreground">Penalidades CREA:</strong> Leve (
              {penalties.light}), Média ({penalties.medium}), Grave/Embargo ({penalties.grave}{" "}
              pontos).
            </li>
          </ul>
        </div>
      )}

      {/* ── Avisos Importantes sobre Limitações ── */}
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                O sistema apoia decisão, mas não substitui auditoria humana
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                O Score ARGUS é uma ferramenta de <strong>priorização e apoio à decisão</strong>.
                Ele analisa dados quantitativos e identifica padrões que merecem atenção, mas{" "}
                <strong>não substitui o julgamento profissional</strong> de engenheiros, auditores e
                gestores públicos. Toda obra classificada como crítica ou alto risco deve passar por
                análise humana antes de qualquer medida administrativa.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Alertas são indícios para priorização, não conclusão de irregularidade
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Os alertas gerados pelo ARGUS indicam <strong>padrões estatísticos</strong> que
                fogem do esperado — como aditivos acima de 25%, atrasos significativos ou
                concentração de contratos. Esses sinais são{" "}
                <strong>indícios para priorização</strong> de análise, e não evidência de
                irregularidade. Um alerta deve ser investigado, não utilizado como conclusão
                isolada. A decisão final sempre cabe ao gestor ou ao órgão de controle competente.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--success)]/30 bg-[color:var(--success)]/5 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--success)]" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Fontes de dados oficiais e auditáveis
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                O ARGUS utiliza exclusivamente <strong>fontes de dados públicas e oficiais</strong>:
                TCE-RJ (Tribunal de Contas do Estado), CREA-RJ (Conselho Regional de Engenharia),
                IBGE (dados socioeconômicos), SINAPI/SICRO (benchmarks de custo) e dados cadastrais
                municipais. Todos os cálculos são auditáveis e rastreáveis até a fonte original.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Glossário rápido ── */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Glossário rápido</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            {
              termo: "Score ARGUS",
              definicao: "Índice de 0 a 100 que mede a eficiência da obra. Quanto maior, melhor.",
            },
            {
              termo: "Aditivo contratual",
              definicao:
                "Alteração no valor ou prazo do contrato original. Acima de 25% gera alerta.",
            },
            {
              termo: "CREA",
              definicao:
                "Conselho Regional de Engenharia. Infrações registradas penalizam o score.",
            },
            {
              termo: "IDH / Agravante Social",
              definicao:
                "Índice de Desenvolvimento Humano. IDH baixo (< 0.600) ativa o Agravante Social, multiplicando a criticidade dos alertas por 1.5×. Não compõe o score base.",
            },
            {
              termo: "SINAPI",
              definicao:
                "Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil (referência de custo).",
            },
            {
              termo: "Agravante Social",
              definicao:
                "Fator que intensifica a criticidade dos alertas em áreas de vulnerabilidade social (IDH < 0,600). Não compõe o score base.",
            },
          ].map((g) => (
            <div
              key={g.termo}
              className="rounded-md border border-border bg-background/50 px-3 py-2"
            >
              <p className="text-xs font-semibold text-foreground">{g.termo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{g.definicao}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const descricoes: Record<string, string> = {
  cost: "Compara o custo praticado da obra com referências paramétricas (SINAPI/SICRO) para detectar superfaturamento. Obras com custo acima do benchmark recebem penalidade proporcional ao desvio.",
  deadline:
    "Avalia o cumprimento do cronograma físico-financeiro, com tolerância de 90 dias sobre o prazo contratual. Atrasos progressivos reduzem o score de forma cumulativa.",
  quality:
    "Penaliza aditivos acumulados acima de 25% sobre o valor original e considera infrações CREA registradas (leve, média, grave). Obras sem registro CREA regular também são penalizadas.",
  recurrence:
    "Identifica concentração suspeita de contratos no mesmo fornecedor ou bairro em um curto intervalo. Concentração elevada não é irregularidade, mas sinal de atenção.",
  ml_risk:
    "Probabilidade preditiva de risco calculada por modelo de Machine Learning, baseada em histórico de atrasos, sobrecustos e retrabalho. Resultado probabilístico, não determinístico.",
};
