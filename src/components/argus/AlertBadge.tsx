import type { AlertaNivel } from "@/types";
import { cn } from "@/lib/utils";

const map: Record<AlertaNivel, string> = {
  "Baixo": "bg-primary/10 text-primary border-primary/30",
  "Médio": "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
  "Alto": "bg-orange-500/15 text-orange-600 border-orange-500/30",
  "Crítico": "bg-destructive/10 text-destructive border-destructive/30",
};

export function AlertBadge({ nivel }: { nivel: AlertaNivel }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide", map[nivel])}>
      {nivel}
    </span>
  );
}