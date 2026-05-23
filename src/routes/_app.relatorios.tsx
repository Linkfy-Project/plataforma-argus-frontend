import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3, Building2, FileSpreadsheet, FileText, ShieldAlert, Wallet, Download,
} from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { Button } from "@/components/ui/button";
import { exportsService } from "@/lib/api";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Plataforma Argus" }] }),
  component: RelatoriosPage,
});

const reports = [
  { icon: BarChart3, title: "Relatório geral", desc: "Visão consolidada de todas as obras monitoradas." },
  { icon: Building2, title: "Relatório por município", desc: "Detalhamento de obras agrupadas por município." },
  { icon: FileText, title: "Relatório por status", desc: "Distribuição das obras de acordo com seu status atual." },
  { icon: Wallet, title: "Relatório financeiro", desc: "Análise de valores contratados, executados e saldos." },
  { icon: ShieldAlert, title: "Relatório de alertas", desc: "Resumo dos alertas críticos detectados na plataforma." },
];

function RelatoriosPage() {
  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Gere e exporte relatórios oficiais a partir dos dados monitorados."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
              <a href={exportsService.worksXlsxUrl()} target="_blank" rel="noreferrer">
                <Download className="mr-1 h-4 w-4" /> Exportar todas (XLSX)
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={exportsService.worksCsvUrl()} target="_blank" rel="noreferrer">
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Exportar todas (CSV)
              </a>
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <div key={r.title} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <r.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{r.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                <a href={exportsService.worksXlsxUrl()} target="_blank" rel="noreferrer">
                  Gerar relatório (XLSX)
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={exportsService.worksCsvUrl()} target="_blank" rel="noreferrer">
                  <FileSpreadsheet className="mr-1 h-4 w-4" /> Exportar CSV
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Os relatórios são gerados diretamente pelo backend Argus a partir dos endpoints oficiais
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono">/api/v1/exports/works.csv</code>
        e
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono">/api/v1/exports/works.xlsx</code>.
      </p>
    </div>
  );
}