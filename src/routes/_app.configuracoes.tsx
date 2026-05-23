import { createFileRoute } from "@tanstack/react-router";
import { Plug, Palette, Settings2, UserCircle } from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Plataforma Argus" }] }),
  component: ConfigPage,
});

function Section({ icon: Icon, title, children }: { icon: typeof Plug; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ConfigPage() {
  return (
    <div>
      <PageHeader title="Configurações" description="Preferências da conta e da plataforma." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={UserCircle} title="Perfil do usuário">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome completo</Label>
              <Input defaultValue="Administrador Argus" className="mt-1" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input defaultValue="admin@argus.rj.gov.br" className="mt-1" />
            </div>
            <div>
              <Label>Órgão</Label>
              <Input defaultValue="Secretaria de Infraestrutura" className="mt-1" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input defaultValue="Gestor de Obras" className="mt-1" />
            </div>
          </div>
          <Button className="mt-4 bg-primary hover:bg-primary/90">Salvar alterações</Button>
        </Section>

        <Section icon={Settings2} title="Preferências do sistema">
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Idioma: Português (Brasil)</li>
            <li>• Fuso horário: America/Sao_Paulo (BRT)</li>
            <li>• Formato de moeda: Real (R$)</li>
            <li>• Itens por página em listagens: 10</li>
          </ul>
        </Section>

        <Section icon={Plug} title="Integração com API">
          <p className="text-sm text-muted-foreground">
            A interface está configurada para consumir os endpoints REST do backend FastAPI da Plataforma Argus.
          </p>
          <div className="mt-3">
            <Label>URL base da API</Label>
            <Input readOnly value={API_BASE_URL} className="mt-1 font-mono text-xs" />
            <p className="mt-1 text-xs text-muted-foreground">
              Definida pela variável de ambiente <code>VITE_API_BASE_URL</code>. Caso o backend esteja indisponível,
              dados de exemplo são exibidos automaticamente.
            </p>
          </div>
        </Section>

        <Section icon={Palette} title="Tema da interface">
          <p className="text-sm text-muted-foreground">
            Tema institucional Argus, com paleta azul corporativa otimizada para painéis de gestão pública.
          </p>
          <div className="mt-3 flex gap-2">
            {["#287BBE", "#06162F", "#38A5DB", "#22C55E", "#F59E0B", "#DC2626"].map((c) => (
              <span key={c} className="h-8 w-8 rounded-md border border-border" style={{ background: c }} />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}