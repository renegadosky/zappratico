import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Skeleton } from "./primitives";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  loading,
  attention,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** variação percentual real vs. ontem; null quando não há base de comparação */
  delta?: number | null;
  loading?: boolean;
  attention?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card p-4 ${
        attention ? "border-warning/30" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${attention ? "text-warning" : "text-muted-foreground"}`} />
      </div>

      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <div className="text-xl md:text-2xl font-display font-bold tabular-nums">{value}</div>
      )}

      <div className="mt-1 min-h-4 flex items-center gap-1.5">
        {!loading && typeof delta === "number" && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
              delta >= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
        {!loading && hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
