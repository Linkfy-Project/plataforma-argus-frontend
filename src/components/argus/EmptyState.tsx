import { Inbox, AlertTriangle, RefreshCcw, Loader2, WifiOff, Server, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/* EmptyState — lista ou conteúdo vazio                                       */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  message = "Nenhum dado encontrado.",
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LoadingState — com mensagem progressiva para Render cold start             */
/* -------------------------------------------------------------------------- */

export function LoadingState({
  message = "Carregando dados do ARGUS...",
  rows = 5,
  coldStartAfterMs = 5000,
}: {
  message?: string;
  rows?: number;
  /** Tempo em ms antes de exibir a mensagem de cold start. */
  coldStartAfterMs?: number;
}) {
  const [phase, setPhase] = useState<"loading" | "coldstart" | "retry">("loading");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("coldstart"), coldStartAfterMs);
    const t2 = setTimeout(() => setPhase("retry"), coldStartAfterMs + 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [coldStartAfterMs]);

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted/60" />
      ))}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {phase === "loading" && message}
          {phase === "coldstart" && (
            <>
              <Server className="h-3.5 w-3.5" />
              A API pode estar inicializando no Render (cold start). Aguarde alguns segundos...
            </>
          )}
          {phase === "retry" && (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              A API está demorando para responder. Clique em "Tentar novamente" abaixo.
            </>
          )}
        </p>
        {phase === "retry" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-1"
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ErrorState — com título, detalhe técnico, dica e botão retry               */
/* -------------------------------------------------------------------------- */

export function ErrorState({
  title = "Erro ao carregar dados",
  message = "Não foi possível carregar os dados da API ARGUS.",
  detail,
  onRetry,
  showApiHint = true,
}: {
  /** Título principal do erro. */
  title?: string;
  /** Mensagem amigável para o usuário. */
  message?: string;
  /** Detalhe técnico opcional (ex: status HTTP, stack trace resumido). */
  detail?: string;
  /** Callback para tentar novamente. Se fornecido, exibe botão. */
  onRetry?: () => void;
  /** Se true, exibe dica para verificar se a API está rodando. */
  showApiHint?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>

      <p className="text-sm font-semibold text-destructive">{title}</p>
      <p className="text-sm text-destructive/80">{message}</p>

      {detail && (
        <details className="w-full max-w-md">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Ver detalhes técnicos
          </summary>
          <pre className="mt-2 rounded-md bg-muted/50 p-3 text-left text-xs text-muted-foreground overflow-x-auto">
            {detail}
          </pre>
        </details>
      )}

      {showApiHint && (
        <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground max-w-md">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Se o problema persistir, verifique se o backend está rodando em{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/api/argus/health</code>.
            Em ambientes no Render, a API pode levar até 60s para inicializar após período de inatividade.
          </span>
        </div>
      )}

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CardsLoading — skeleton para grids de cards                                */
/* -------------------------------------------------------------------------- */

export function CardsLoading({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/60" />
      ))}
    </div>
  );
}
