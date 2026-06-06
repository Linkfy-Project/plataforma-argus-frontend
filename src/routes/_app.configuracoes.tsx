"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plug,
  Palette,
  Settings2,
  UserCircle,
  Activity,
  Trash2,
  Download,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/argus/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_BASE_URL, healthService } from "@/lib/api";
import { MUNICIPIOS_RJ } from "@/data/mock/obras";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Plataforma Argus" }] }),
  component: ConfigPage,
});

/* -------------------------------------------------------------------------- */
/* Hook: configuração persistida em localStorage                              */
/* -------------------------------------------------------------------------- */

function useSetting<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setter = useCallback(
    (v: T) => {
      setValue(v);
      localStorage.setItem(key, JSON.stringify(v));
    },
    [key],
  );

  return [value, setter];
}

/* -------------------------------------------------------------------------- */
/* Constantes                                                                 */
/* -------------------------------------------------------------------------- */

const ARGUS_FRONTEND_VERSION = "1.0.0-hackathon";
const BUILD_DATE = new Date().toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;

/* -------------------------------------------------------------------------- */
/* Componentes auxiliares                                                      */
/* -------------------------------------------------------------------------- */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Plug;
  title: string;
  children: React.ReactNode;
}) {
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

/** Badge de status online/offline. */
function StatusDot({ online }: { online: boolean | null }) {
  if (online === null) {
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />;
  }
  return online ? (
    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
  ) : (
    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
  );
}

/* -------------------------------------------------------------------------- */
/* Página principal                                                           */
/* -------------------------------------------------------------------------- */

function ConfigPage() {
  /* ---- Estados de configuração local ---- */
  const [defaultMunicipio, setDefaultMunicipio] = useSetting<string>(
    "argus_default_municipio",
    "todos",
  );
  const [pageSize, setPageSize] = useSetting<string>("argus_page_size", "25");

  /* ---- Health check ---- */
  const [apiStatus, setApiStatus] = useState<boolean | null>(null);
  const [apiChecking, setApiChecking] = useState(false);
  const [apiMessage, setApiMessage] = useState<string>("");

  const handleHealthCheck = useCallback(async () => {
    setApiChecking(true);
    setApiMessage("");
    try {
      const resp = await healthService.health();
      const statusStr =
        typeof resp === "object" && resp !== null && "status" in resp
          ? String((resp as Record<string, unknown>).status)
          : "ok";
      const isHealthy = statusStr.toLowerCase() === "ok" || statusStr.toLowerCase() === "healthy";
      setApiStatus(isHealthy);
      setApiMessage(isHealthy ? `API respondendo: ${statusStr}` : `Status inesperado: ${statusStr}`);
    } catch (err) {
      setApiStatus(false);
      setApiMessage(
        err instanceof Error ? `Falha na conexão: ${err.message}` : "Falha desconhecida ao conectar com a API.",
      );
    } finally {
      setApiChecking(false);
    }
  }, []);

  /* ---- Limpar cache ---- */
  const handleClearCache = useCallback(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("argus_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    toast.success("Cache limpo com sucesso", {
      description: `${keysToRemove.length} chave(s) removida(s) do localStorage. A página será recarregada.`,
    });
    // Pequeno delay para o toast ser visível antes do reload
    setTimeout(() => window.location.reload(), 800);
  }, []);

  /* ---- Exportar configurações ---- */
  const handleExportSettings = useCallback(() => {
    const settings: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("argus_")) {
        try {
          settings[key] = JSON.parse(localStorage.getItem(key) ?? "");
        } catch {
          settings[key] = localStorage.getItem(key);
        }
      }
    }
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `argus-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div>
      <PageHeader title="Configurações" description="Preferências da conta e da plataforma." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------------------------ */}
        {/* Perfil do Usuário (estático — PoC)                                  */}
        {/* ------------------------------------------------------------------ */}
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

        {/* ------------------------------------------------------------------ */}
        {/* Preferências do Sistema (interativo)                                */}
        {/* ------------------------------------------------------------------ */}
        <Section icon={Settings2} title="Preferências do sistema">
          <div className="space-y-4">
            {/* Idioma / Fuso — informativo */}
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Idioma: Português (Brasil)</li>
              <li>• Fuso horário: America/Sao_Paulo (BRT)</li>
              <li>• Formato de moeda: Real (R$)</li>
            </ul>

            {/* Município padrão */}
            <div>
              <Label className="text-sm">Município padrão do dashboard</Label>
              <Select value={defaultMunicipio} onValueChange={setDefaultMunicipio}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o município" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os municípios</SelectItem>
                  {MUNICIPIOS_RJ.map((mun) => (
                    <SelectItem key={mun} value={mun}>
                      {mun}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Filtra automaticamente o dashboard para este município ao carregar.
              </p>
            </div>

            {/* Itens por página */}
            <div>
              <Label className="text-sm">Itens por página em listagens</Label>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt} itens
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Controla a quantidade de itens exibidos em tabelas e listagens.
              </p>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Integração com API + Status                                         */}
        {/* ------------------------------------------------------------------ */}
        <Section icon={Plug} title="Integração com API">
          <div className="space-y-3">
            <div>
              <Label>URL base da API</Label>
              <Input readOnly value={API_BASE_URL} className="mt-1 font-mono text-xs" />
              <p className="mt-1 text-xs text-muted-foreground">
                Definida pela variável de ambiente <code>VITE_API_BASE_URL</code>.
              </p>
            </div>

            {/* Status da API */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleHealthCheck}
                disabled={apiChecking}
              >
                {apiChecking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="mr-2 h-4 w-4" />
                )}
                {apiChecking ? "Testando…" : "Testar conexão"}
              </Button>

              <div className="flex items-center gap-2 text-sm">
                <StatusDot online={apiStatus} />
                {apiStatus === null ? (
                  <span className="text-muted-foreground">Não testado</span>
                ) : apiStatus ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" /> Offline
                  </span>
                )}
              </div>
            </div>

            {apiMessage && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {apiMessage}
              </p>
            )}
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Versão do Sistema                                                   */}
        {/* ------------------------------------------------------------------ */}
        <Section icon={Info} title="Versão do sistema">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Frontend</span>
              <span className="font-mono text-xs font-medium">v{ARGUS_FRONTEND_VERSION}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-mono text-xs">{BUILD_DATE}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Backend</span>
              <span className="flex items-center gap-2 font-mono text-xs">
                <StatusDot online={apiStatus} />
                {apiStatus === null
                  ? "Não verificado"
                  : apiStatus
                    ? "Respondendo"
                    : "Indisponível"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stack</span>
              <span className="font-mono text-xs">Next.js + FastAPI + Supabase</span>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Tema da interface (visual — mantido)                                */}
        {/* ------------------------------------------------------------------ */}
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

        {/* ------------------------------------------------------------------ */}
        {/* Ações                                                               */}
        {/* ------------------------------------------------------------------ */}
        <Section icon={Trash2} title="Ações do navegador">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" onClick={handleClearCache}>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar cache do navegador
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportSettings}>
                <Download className="mr-2 h-4 w-4" />
                Exportar configurações
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Limpar cache</strong> remove todas as preferências salvas (
              <code>argus_*</code> no localStorage) e recarrega a página.
              <br />
              <strong>Exportar</strong> gera um arquivo JSON com todas as configurações do Argus.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
