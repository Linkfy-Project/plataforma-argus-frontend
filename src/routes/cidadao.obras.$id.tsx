import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Wallet,
  Gauge,
  Building,
  Info,
  CheckCircle2,
} from "lucide-react";
import { obrasService } from "@/lib/api";
import { ScoreBadge } from "@/components/argus/ScoreBadge";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fmtBRL, fmtDate, fmtPct } from "@/lib/format";
import { getRiskLevel, getRiskDescription, getScoreClasses } from "@/lib/score";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cidadao/obras/$id")({
  head: () => ({ meta: [{ title: "Detalhe da Obra — Portal do Cidadão" }] }),
  component: CidadaoObraDetail,
});

/** Explicacao amigavel de cada faixa de score para o cidadao. */
const SCORE_EXPLANATIONS = [
  {
    range: "80 a 100",
    label: "Eficiencia alta",
    color: "text-[color:var(--success)]",
    bg: "bg-[color:var(--success)]/10 border-[color:var(--success)]/30",
    description:
      "A obra esta sendo executada dentro dos parametros esperados de prazo, custo e qualidade. Indica boa gestao dos recursos publicos.",
  },
  {
    range: "60 a 79",
    label: "Atencao",
    color: "text-[color:var(--warning)]",
    bg: "bg-[color:var(--warning)]/10 border-[color:var(--warning)]/30",
    description:
      "A obra apresenta alguns pontos que merecem monitoramento mais proximo, como pequenos atrasos ou variacoes de custo.",
  },
  {
    range: "40 a 59",
    label: "Risco alto",
    color: "text-orange-600",
    bg: "bg-orange-500/10 border-orange-500/30",
    description:
      "Foram identificados sinais relevantes de risco na execucao da obra. Pode indicar atrasos significativos, aditivos contratuais ou problemas tecnicos.",
  },
  {
    range: "0 a 39",
    label: "Situacao critica",
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
    description:
      "A obra apresenta situacao critica que requer atencao imediata. Pode envolver paralisacao, sobrecusto grave ou riscos de retrabalho.",
  },
];

function CidadaoObraDetail() {
  const { id } = Route.useParams();

  const { data: obra, isLoading, isError, refetch } = useQuery({
    queryKey: ["cidadao-obra", id],
    queryFn: () => obrasService.get(id),
    staleTime: 3 * 60_000,
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!obra) return <EmptyState message="Obra nao encontrada." />;

  const o = obra;
  const score = o.eficiencia ?? null;
  const riskLevel = getRiskLevel(score);
  const riskDesc = getRiskDescription(score);
  const scoreCls = getScoreClasses(score);

  const percentExecucao =
    o.valor_contratado > 0
      ? Math.min(100, Math.round((o.valor_executado / o.valor_contratado) * 100))
      : o.percentual_execucao ?? 0;

  return (
    <div className="space-y-6">
      {/* Voltar */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/cidadao/obras">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para obras
        </Link>
      </Button>

      {/* Titulo e status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{o.nome}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={o.status} />
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {o.municipio}
            </div>
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Coluna esquerda: detalhes */}
        <div className="space-y-4 lg:col-span-2">
          {/* Descricao */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Sobre esta obra</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {o.descricao || "Descricao nao disponivel."}
            </p>
          </div>

          {/* Informacoes gerais */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Informacoes</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {o.orgao_responsavel && o.orgao_responsavel !== "\u2014" && (
                <InfoRow icon={Building} label="Orgao responsavel" value={o.orgao_responsavel} />
              )}
              {o.data_inicio && (
                <InfoRow icon={Calendar} label="Data de inicio" value={fmtDate(o.data_inicio)} />
              )}
              {o.data_fim_prevista && (
                <InfoRow icon={Calendar} label="Previsao de termino" value={fmtDate(o.data_fim_prevista)} />
              )}
              {o.empresa_contratada && o.empresa_contratada !== "\u2014" && (
                <InfoRow icon={CheckCircle2} label="Contratada" value={o.empresa_contratada} />
              )}
            </div>
          </div>

          {/* Valores */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Valores financeiros</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Valor contratado</p>
                <p className="text-lg font-bold text-foreground">{fmtBRL(o.valor_contratado)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor executado</p>
                <p className="text-lg font-bold text-foreground">{fmtBRL(o.valor_executado)}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Execucao financeira</span>
                <span className="font-medium">{fmtPct(percentExecucao)}</span>
              </div>
              <Progress value={percentExecucao} className="mt-1.5 h-2" />
            </div>
          </div>
        </div>

        {/* Coluna direita: score */}
        <div className="space-y-4">
          {/* Card do score */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm text-center">
            <Gauge className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-2 text-sm font-semibold text-foreground">Score ARGUS</h2>
            <div className="mt-3">
              <ScoreBadge score={score} showLabel={false} className="text-2xl px-4 py-2" />
            </div>
            <p className={cn("mt-2 text-sm font-medium", scoreCls)}>
              {riskLevel}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{riskDesc}</p>
          </div>

          {/* O que significa o score? */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="h-4 w-4 text-primary" />
              O que significa este score?
            </h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              O Score ARGUS e um indice de 0 a 100 que avalia a eficiencia de cada obra
              publica. Ele considera prazo, custo, qualidade, impacto social e riscos
              preditivos. Quanto maior o score, melhor a execucao da obra.
            </p>
            <div className="mt-4 space-y-2">
              {SCORE_EXPLANATIONS.map((exp) => (
                <div
                  key={exp.range}
                  className={cn("rounded-lg border p-3", exp.bg)}
                >
                  <p className={cn("text-xs font-semibold", exp.color)}>
                    {exp.range} — {exp.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {exp.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Componente auxiliar para exibir uma informacao com icone. */
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
