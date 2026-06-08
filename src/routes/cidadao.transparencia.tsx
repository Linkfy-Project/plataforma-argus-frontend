import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  DollarSign,
  Clock,
  Repeat,
  Users,
  Brain,
  ExternalLink,
  FileText,
} from "lucide-react";
import { LoadingState } from "@/components/argus/EmptyState";

export const Route = createFileRoute("/cidadao/transparencia")({
  head: () => ({ meta: [{ title: "Como o ARGUS fiscaliza? — ARGUS" }] }),
  component: CidadaoTransparencia,
});

const PILARES = [
  {
    icon: DollarSign,
    titulo: "O preço está certo?",
    descricao:
      "Comparamos o custo da obra com tabelas oficiais do governo para ver se o valor é justo.",
    cor: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: Clock,
    titulo: "Está no prazo?",
    descricao:
      "Verificamos se a obra está cumprindo o cronograma prometido. Atrasos são automaticamente detectados.",
    cor: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: ShieldCheck,
    titulo: "A obra é bem feita?",
    descricao:
      "Checamos se a construtora tem registro regular no CREA e se não há problemas de fiscalização.",
    cor: "bg-violet-500/10 text-violet-600",
  },
  {
    icon: Repeat,
    titulo: "Sem obra duplicada",
    descricao:
      "Nossa inteligência artificial avisa se a prefeitura está quebrando e refazendo o asfalto no mesmo lugar em pouco tempo.",
    cor: "bg-orange-500/10 text-orange-600",
  },
  {
    icon: Users,
    titulo: "Prioridade para quem mais precisa",
    descricao:
      "Obras em bairros com menor índice de desenvolvimento humano recebem atenção especial.",
    cor: "bg-rose-500/10 text-rose-600",
  },
  {
    icon: Brain,
    titulo: "Previsão inteligente",
    descricao:
      "Um sistema de inteligência artificial analisa o histórico de obras para prever problemas antes que aconteçam.",
    cor: "bg-cyan-500/10 text-cyan-600",
  },
];

const SEMAFOROS = [
  {
    cor: "🟢",
    bg: "bg-green-500/10 border-green-500/30",
    titulo: "Verde — Em dia",
    descricao: "Obra ocorrendo sem alertas críticos. Tudo dentro do esperado.",
  },
  {
    cor: "🟡",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    titulo: "Amarelo — Atenção",
    descricao: "Pequenos atrasos ou aditivos detectados. Acompanhamento recomendado.",
  },
  {
    cor: "🔴",
    bg: "bg-red-500/10 border-red-500/30",
    titulo: "Vermelho — Problema",
    descricao: "Risco alto, embargos ou estouro de prazo. Controle social necessário.",
  },
];

const FONTES = [
  { nome: "TCE-RJ", descricao: "Tribunal de Contas do Estado do RJ" },
  { nome: "CREA-RJ", descricao: "Conselho Regional de Engenharia" },
  { nome: "IBGE", descricao: "Instituto Brasileiro de Geografia e Estatística" },
  { nome: "SINAPI", descricao: "Sistema de Custos da Construção (Caixa)" },
];

function CidadaoTransparencia() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-sm md:p-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Como o ARGUS fiscaliza?
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            O ARGUS é uma plataforma que monitora obras públicas usando dados oficiais do Tribunal
            de Contas (TCE-RJ), CREA-RJ, IBGE e tabelas do governo. Nosso objetivo é garantir que o
            dinheiro público seja bem aplicado e que você, cidadão, possa acompanhar tudo de forma
            simples e transparente.
          </p>
        </div>
      </section>

      {/* Os 6 pilares */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-foreground">Como avaliamos cada obra?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Usamos 6 critérios simples para analisar cada obra pública.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PILARES.map((p) => (
            <div
              key={p.titulo}
              className="group rounded-xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${p.cor} transition group-hover:scale-110`}
              >
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      {/* O que significam as cores */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h2 className="mb-2 text-xl font-bold text-foreground text-center">
          O que significam as cores?
        </h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          No mapa, cada obra recebe uma cor de semáforo para facilitar a visualização.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SEMAFOROS.map((s) => (
            <div key={s.titulo} className={`rounded-xl border p-6 text-center ${s.bg}`}>
              <span className="text-4xl">{s.cor}</span>
              <h3 className="mt-3 text-base font-semibold text-foreground">{s.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      {/* De onde vêm os dados */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">De onde vêm os dados?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O ARGUS utiliza fontes oficiais e públicas para garantir a confiabilidade das
            informações.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {FONTES.map((fonte) => (
            <div
              key={fonte.nome}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background/50 p-5 text-center transition hover:bg-muted/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-bold text-foreground">{fonte.nome}</span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                {fonte.descricao}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA para metodologia completa */}
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center md:p-8">
        <h2 className="text-lg font-semibold text-foreground">Quer saber ainda mais?</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Acesse o Portal do Gestor para ver a metodologia completa, com detalhes sobre cada
          indicador utilizado pelo ARGUS.
        </p>
        <a
          href="/metodologia"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4" />
          Metodologia completa
        </a>
      </section>
    </div>
  );
}
