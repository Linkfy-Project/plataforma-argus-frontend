import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Wallet,
  Building,
  Info,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { obrasService } from "@/lib/api";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/argus/EmptyState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fmtBRL, fmtDate } from "@/lib/format";
import { getSemaforo, fmtMonthYear, getSituacaoMensagem } from "@/lib/semaforo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cidadao/obras/$id")({
  head: () => ({ meta: [{ title: "Detalhe da Obra — Portal do Cidadão" }] }),
  component: CidadaoObraDetail,
});

function CidadaoObraDetail() {
  const { id } = Route.useParams();

  const { data: obra, isLoading, isError, refetch } = useQuery({
    queryKey: ["cidadao-obra", id],
    queryFn: () => obrasService.get(id),
    staleTime: 3 * 60_000,
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!obra) return <EmptyState message="Obra não encontrada." />;

  const o = obra;
  const semaforo = getSemaforo(o.eficiencia);
  const situacao = getSituacaoMensagem(o.status);

  const percentExecucao =
    o.valor_contratado > 0
      ? Math.min(100, Math.round((o.valor_executado / o.valor_contratado) * 100))
      : o.percentual_execucao ?? 0;

  const saldoRestante = Math.max(0, o.valor_contratado - o.valor_executado);

  const labels = {
    planejada: "Planejada",
    andamento: "Em andamento",
    atrasada: "Atrasada",
    paralisada: "Paralisada",
    concluida: "Concluída",
  };

  return (
    <div className="space-y-6">
      {/* Voltar */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/cidadao/obras">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para obras
        </Link>
      </Button>

      {/* ───── Card único principal ───── */}
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Cabeçalho — nome + semáforo + localização */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {o.nome}
              </h1>

              {/* Badge de semáforo grande */}
              <div className="mt-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold",
                    semaforo.bg,
                    semaforo.color,
                  )}
                >
                  <span className="text-lg">{semaforo.emoji}</span>
                  {semaforo.label}
                </span>
              </div>

              {/* Bairro + município */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>
                    {o.bairro ? `${o.bairro}, ${o.municipio}` : o.municipio}
                  </span>
                </div>
                <StatusBadge status={o.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Sobre esta obra */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Info className="h-4 w-4 text-primary" />
            Sobre esta obra
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {o.descricao || "Descrição não disponível."}
          </p>
        </div>

        {/* Quem está fazendo */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building className="h-4 w-4 text-primary" />
            Quem está fazendo
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Construtora — destaque */}
            {o.empresa_contratada && o.empresa_contratada !== "—" && (
              <InfoRow
                icon={CheckCircle2}
                label="Construtora"
                value={o.empresa_contratada}
                highlight
              />
            )}
            {o.orgao_responsavel && o.orgao_responsavel !== "—" && (
              <InfoRow
                icon={Building}
                label="Órgão responsável"
                value={o.orgao_responsavel}
              />
            )}
            {o.data_inicio && (
              <InfoRow
                icon={Calendar}
                label="Data de início"
                value={fmtDate(o.data_inicio)}
              />
            )}
            {o.data_fim_prevista && (
              <InfoRow
                icon={Calendar}
                label="Previsão de entrega"
                value={fmtMonthYear(o.data_fim_prevista)}
              />
            )}
          </div>
        </div>

        {/* Quanto custa e quanto já foi pago */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            Quanto custa e quanto já foi pago
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Custo Total Previsto</p>
              <p className="text-xl font-bold text-foreground">
                {fmtBRL(o.valor_contratado)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quanto já foi pago</p>
              <p className="text-xl font-bold text-foreground">
                {fmtBRL(o.valor_executado)}
              </p>
            </div>
          </div>

          {/* Barra de progresso grande e visual */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso financeiro</span>
              <span className="font-semibold text-foreground">{percentExecucao}% concluído</span>
            </div>
            <Progress value={percentExecucao} className="mt-2 h-3" />
          </div>

          {/* Saldo restante */}
          <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                Saldo restante
              </span>
              <span className="text-base font-bold text-foreground">
                {fmtBRL(saldoRestante)}
              </span>
            </div>
          </div>
        </div>

        {/* Situação da obra */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            Situação da obra
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={o.status} />
            <p className={cn("text-sm font-medium", situacao.cor)}>
              {situacao.mensagem}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Componente auxiliar para exibir uma informação com ícone. */
function InfoRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-background/60",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "truncate",
            highlight ? "text-base font-bold text-foreground" : "text-sm font-medium text-foreground",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
