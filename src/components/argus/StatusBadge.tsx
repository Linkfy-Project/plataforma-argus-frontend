import type { ObraStatus } from "@/types";
import { cn } from "@/lib/utils";

const map: Record<ObraStatus, string> = {
  Concluída:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  "Em andamento": "bg-primary/10 text-primary border-primary/30",
  Planejada: "bg-muted text-muted-foreground border-border",
  Atrasada:
    "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
  Paralisada: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: ObraStatus | string }) {
  const cls =
    (map as Record<string, string>)[status] || "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {status}
    </span>
  );
}

export function ContratoStatusBadge({ status }: { status: string }) {
  const cls =
    status === "Vigente"
      ? "bg-primary/10 text-primary border-primary/30"
      : status === "Encerrado"
        ? "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
        : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {status}
    </span>
  );
}
