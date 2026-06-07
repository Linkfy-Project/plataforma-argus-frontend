/**
 * ApiStatusBadge — Badge que mostra o status da API no Topbar.
 *
 * Consulta healthService.health com React Query e exibe:
 * - API online (verde)
 * - API indisponível (vermelho)
 * - Inicializando (amarelo pulsante)
 * - Última verificação (tooltip)
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { healthService } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Status = "online" | "offline" | "loading" | "cold-start";

function resolveStatus(
  isLoading: boolean,
  isError: boolean,
  data: unknown,
): Status {
  if (isLoading) return "loading";
  if (isError) return "offline";
  if (data && typeof data === "object" && "status" in data) {
    const s = (data as { status?: string }).status?.toLowerCase();
    if (s === "ok" || s === "healthy" || s === "online") return "online";
  }
  // Se recebemos dados mas sem status claro, consideramos online
  if (data) return "online";
  return "offline";
}

const STATUS_CONFIG: Record<
  Status,
  { label: string; color: string; icon: typeof Wifi; pulse?: boolean }
> = {
  online: {
    label: "API online",
    color: "text-[color:var(--success)]",
    icon: Wifi,
  },
  offline: {
    label: "API indisponível",
    color: "text-destructive",
    icon: WifiOff,
  },
  loading: {
    label: "Verificando...",
    color: "text-muted-foreground",
    icon: Loader2,
    pulse: true,
  },
  "cold-start": {
    label: "Inicializando",
    color: "text-[color:var(--warning)]",
    icon: Loader2,
    pulse: true,
  },
};

export function ApiStatusBadge() {
  const {
    data,
    isLoading,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["api-health"],
    queryFn: () => healthService.health(),
    refetchInterval: 30_000, // Re-verifica a cada 30s
    retry: 1,
    staleTime: 15_000,
  });

  const status = resolveStatus(isLoading, isError, data);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const lastCheck = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Nunca";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              "hover:bg-white/10",
              config.color,
            )}
            aria-label={config.label}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                config.pulse && "animate-spin",
              )}
            />
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>{config.label}</p>
          <p className="text-muted-foreground">Última verificação: {lastCheck}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
