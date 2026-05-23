import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building, Calendar, FileText, MapPin, Wallet } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { StatusBadge } from "@/components/argus/StatusBadge";
import { AlertBadge } from "@/components/argus/AlertBadge";
import { LoadingState, EmptyState } from "@/components/argus/EmptyState";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { obrasService, alertasService } from "@/lib/api";
import { fmtBRL, fmtDate, fmtPct } from "@/lib/format";

export const Route = createFileRoute("/_app/obras/$id")({
  component: ObraDetail,
});

function ObraDetail() {
  const { id } = Route.useParams();
  const obra = useQuery({ queryKey: ["obra", id], queryFn: () => obrasService.get(id) });
  const alertas = useQuery({ queryKey: ["alertas"], queryFn: () => alertasService.list() });

  if (obra.isLoading) return <LoadingState />;
  if (!obra.data) return <EmptyState message="Obra não encontrada." />;
  const o = obra.data;
  const related = (alertas.data ?? []).filter((a) => a.obra_id === o.id);

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