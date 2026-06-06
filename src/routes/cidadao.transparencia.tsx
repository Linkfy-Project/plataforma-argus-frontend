import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Gauge,
  Brain,
  DollarSign,
  Clock,
  Users,
  Repeat,
  ExternalLink,
  AlertTriangle,
  HardHat,
  Wallet,
} from "lucide-react";
import { analyticsService, dashboardService } from "@/lib/api";
import { StatCard } from "@/components/argus/StatCard";
import { LoadingState, ErrorState } from "@/components/argus/EmptyState";
import { Button } from "@/components/ui/button";
import { fmtBRL, fmtNumber } from "@/lib/format";

export const Route = createFileRoute("/cidadao/transparencia")({
  head: () => ({ meta: [{ title: "Transparencia — Portal do Cidadao" }] }),
  component: CidadaoTransparencia,
});

const PILLARS = [
  {
    icon: DollarSign,
    title: "Custo Parametrico (25%)",
    description:
      "Compara o custo da obra com benchmarks do SINAPI e dados historicos de obras semelhantes. Avalia se o valor contratado esta dentro do esperado para o tipo de servico.",
  },
  {
    icon: Clock,
    title: "Prazo e Cronograma (25%)",
    description:
      "Analisa se a obra esta dentro do prazo previsto, considerando aditivos de prazo e atrasos acumulados em relacao ao cronograma original.",
  },
  {
    icon: ShieldCheck,
    title: "Qualidade Tecnica (20%)",
    description:
      "Avalia a qualidade da execucao com base em registros do CREA-RJ, fiscalizacao tecnica e presenca de aditivos contratuais que possam indicar problemas.",
  },
  {
    icon: Repeat,
    title: "Recorrencia Territorial (10%)",
    description:
      "Identifica se ha concentracao excessiva de contratos com o mesmo contratado na mesma regiao, o que pode indicar direcionamento ou falta de competitividade.",
  },
  {
    icon: Users,
    title: "Impacto Socioeconomico (5%)",
    description:
      "Considera o IDH (Indice de Desenvolvimento Humano) do setor censitario onde a obra esta localizada, priorizando obras em areas mais vulneraveis.",
  },
  {
    icon: Brain,
    title: "Risco Preditivo - ML (15%)",
    description:
      "Modelo de Machine Learning treinado com dados historicos que preve a probabilidade de atraso, sobrecusto e retrabalho para cada obra.",
  },
];

function CidadaoTransparencia() {
  const summary = useQuery({
    queryKey: ["transparencia-summary"],
    queryFn: () => analyticsService.summary(),
    staleTime: 5 * 60_000,
  });

  const dashboard = useQuery({
    queryKey: ["transparencia-dashboard"],
    queryFn: () => dashboardService.getSummary(),
    staleTime: 5 * 60_000,
  });

  if (summary.isLoading || dashboard.isLoading) return <LoadingState rows={6} />;
  if (summary.isError) return <ErrorState onRetry={() => summary.refetch()} />;

  const s = summary.data;
  const d = dashboard.data;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              O que e o ARGUS?
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              O ARGUS e uma plataforma de monitoramento de obras publicas que utiliza
              dados oficiais do TCE-RJ (Tribunal de Contas do Estado do Rio de Janeiro),
              CREA-RJ, IBGE e benchmarks do SINAPI para calcular um indice de eficiencia
              transparente para cada obra. O objetivo e promover transparencia, prevenir
              desperdicios e facilitar o controle social.
            </p>
          </div>
        </div>
      </section>

      {/* Dados de transparencia */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Dados de transparencia</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total investido"
            value={fmtBRL(d?.valor_total_contratado ?? 0)}
            helper="Em obras publicas"
            icon={Wallet}
            tone="primary"
          />
          <StatCard
            label="Obras monitoradas"
            value={fmtNumber(s?.total_works ?? d?.total_obras ?? 0)}
            helper="Com dados oficiais"
            icon={HardHat}
            tone="success"
          />
          <StatCard
            label="Alertas ativos"
            value={fmtNumber(s?.critical_alerts ?? d?.alertas_criticos ?? 0)}
            helper="Requerem atencao"
            icon={AlertTriangle}
            tone="danger"
          />
          <StatCard
            label="Score medio"
            value={Math.round(s?.average_efficiency_score ?? d?.eficiencia_media ?? 0)}
            helper="Eficiencia geral"
            icon={Gauge}
            tone="warning"
          />
        </div>
      </section>

      {/* Como o score e calculado */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          Como o Score ARGUS e calculado?
        </h2>
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground leading-relaxed">
          O Score ARGUS e um indice composto de 0 a 100 que combina seis pilares de
          avaliacao. Cada pilar recebe um peso diferente, refletindo sua importancia
          relativa na avaliacao da eficiencia de uma obra publica. A nota final e uma
          media ponderada dos seis componentes.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Faixas de score */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Interpretacao do Score</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-4">
            <p className="text-lg font-bold text-[color:var(--success)]">80 - 100</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Eficiencia alta</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Obra executada dentro dos parametros. Boa gestao de recursos.
            </p>
          </div>
          <div className="rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 p-4">
            <p className="text-lg font-bold text-[color:var(--warning)]">60 - 79</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Atencao</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pontos que merecem monitoramento ativo. Risco moderado.
            </p>
          </div>
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
            <p className="text-lg font-bold text-orange-600">40 - 59</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Risco alto</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sinais relevantes de risco. Necessita revisao detalhada.
            </p>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-lg font-bold text-destructive">0 - 39</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Critico</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Situacao critica. Recomendada auditoria imediata.
            </p>
          </div>
        </div>
      </section>

      {/* Metodologia */}
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center md:p-8">
        <h2 className="text-lg font-semibold text-foreground">Quer saber mais?</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Acesse a metodologia completa do ARGUS com detalhes tecnicos, formulas e
          fontes de dados utilizadas.
        </p>
        <Button asChild size="lg" variant="outline" className="gap-2">
          <Link to="/cidadao">
            <ExternalLink className="h-4 w-4" />
            Metodologia ARGUS
          </Link>
        </Button>
      </section>
    </div>
  );
}
