import { cn } from "@/lib/utils";
import { getRiskLevel, getScoreClasses } from "@/lib/score";

interface Props {
  score: number | null | undefined;
  showLabel?: boolean;
  className?: string;
}

export function ScoreBadge({ score, showLabel = true, className }: Props) {
  if (score == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        —
      </span>
    );
  }
  const cls = getScoreClasses(score);
  const label = getRiskLevel(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums",
        cls,
        className,
      )}
    >
      <span>{Math.round(score)}</span>
      {showLabel && (
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</span>
      )}
    </span>
  );
}
