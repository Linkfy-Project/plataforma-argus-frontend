import { Inbox, AlertTriangle, RefreshCcw, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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

export function LoadingState({
  message = "Carregando dados do ARGUS...",
  rows = 5,
  coldStartAfterMs = 3500,
}: {
  message?: string;
  rows?: number;
  coldStartAfterMs?: number;
}) {
  const [coldStart, setColdStart] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setColdStart(true), coldStartAfterMs);
    return () => clearTimeout(t);
  }, [coldStartAfterMs]);
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted/60" />
      ))}
      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {coldStart
          ? "A API está inicializando no Render. Aguarde alguns segundos e tente novamente."
          : message}
      </p>
    </div>
  );
}

export function ErrorState({
  message = "Não foi possível carregar os dados da API ARGUS.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function CardsLoading({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/60" />
      ))}
    </div>
  );
}