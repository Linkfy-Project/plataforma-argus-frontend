import { cn } from "@/lib/utils";
import { ShieldAlert, TrendingUp, Clock, DollarSign, Wrench } from "lucide-react";

export type RiskCategory = "delay" | "cost" | "rework";

interface RiskBadgeProps {
  category: RiskCategory;
  probability: number | null | undefined;
  compact?: boolean;
  className?: string;
}

const RISK_CONFIG: Record<RiskCategory, { label: string; icon: typeof Clock }> = {
  delay: { label: "Atraso", icon: Clock },
  cost: { label: "Custo", icon: DollarSign },
  rework: { label: "Retrabalho", icon: Wrench },
};

function getRiskColor(prob: number): { bg: string; text: string; border: string } {
  if (prob >= 0.7)
    return { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" };
  if (prob >= 0.4)
    return { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/30" };
  if (prob >= 0.2)
    return {
      bg: "bg-[color:var(--warning)]/10",
      text: "text-[color:var(--warning)]",
      border: "border-[color:var(--warning)]/30",
    };
  return {
    bg: "bg-[color:var(--success)]/10",
    text: "text-[color:var(--success)]",
    border: "border-[color:var(--success)]/30",
  };
}

function getRiskLabel(prob: number): string {
  if (prob >= 0.7) return "Crítico";
  if (prob >= 0.4) return "Alto";
  if (prob >= 0.2) return "Moderado";
  return "Baixo";
}

/**
 * Badge showing ML predictive risk probability for a specific category.
 * Displays a colored pill with icon, percentage, and risk level.
 */
export function PredictiveRiskBadge({
  category,
  probability,
  compact = false,
  className,
}: RiskBadgeProps) {
  if (probability == null || Number.isNaN(probability)) return null;

  const config = RISK_CONFIG[category];
  const pct = Math.round(probability * 100);
  const colors = getRiskColor(probability);
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
          colors.bg,
          colors.text,
          colors.border,
          className,
        )}
        title={`${config.label}: ${pct}% probabilidade — ${getRiskLabel(probability)}`}
      >
        <Icon className="h-3 w-3" />
        {pct}%
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums",
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
      <span className="font-bold">{pct}%</span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        {getRiskLabel(probability)}
      </span>
    </span>
  );
}

interface PredictiveRiskGroupProps {
  delayProbability?: number | null;
  costProbability?: number | null;
  reworkProbability?: number | null;
  compact?: boolean;
  className?: string;
}

/**
 * Group of all three predictive risk badges (delay, cost, rework).
 * Shows an "IA Preditiva" label and the three risk indicators.
 */
export function PredictiveRiskGroup({
  delayProbability,
  costProbability,
  reworkProbability,
  compact = false,
  className,
}: PredictiveRiskGroupProps) {
  const hasAny = delayProbability != null || costProbability != null || reworkProbability != null;
  if (!hasAny) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ShieldAlert className="h-3 w-3" />
        IA Preditiva
      </span>
      <PredictiveRiskBadge category="delay" probability={delayProbability} compact={compact} />
      <PredictiveRiskBadge category="cost" probability={costProbability} compact={compact} />
      <PredictiveRiskBadge category="rework" probability={reworkProbability} compact={compact} />
    </div>
  );
}

/**
 * Compact risk indicator for use inline with score badges.
 * Shows the highest risk probability with a color-coded indicator.
 */
export function PredictiveRiskIndicator({
  delayProbability,
  costProbability,
  reworkProbability,
  className,
}: Omit<PredictiveRiskGroupProps, "compact">) {
  const probs = [delayProbability, costProbability, reworkProbability].filter(
    (p): p is number => p != null,
  );
  if (probs.length === 0) return null;

  const maxProb = Math.max(...probs);
  const pct = Math.round(maxProb * 100);
  const colors = getRiskColor(maxProb);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums",
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
      title={`Maior risco preditivo: ${pct}%`}
    >
      <TrendingUp className="h-3 w-3" />
      Risco IA: {pct}%
    </span>
  );
}
