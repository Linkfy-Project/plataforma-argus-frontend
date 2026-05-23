import { Inbox } from "lucide-react";

export function EmptyState({ message = "Nenhum dado encontrado." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function LoadingState({ message = "Carregando dados..." }: { message?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted/60" />
      ))}
      <p className="text-center text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorState({ message = "Ocorreu um erro ao carregar os dados. Tente novamente." }: { message?: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center text-sm text-destructive">
      {message}
    </div>
  );
}