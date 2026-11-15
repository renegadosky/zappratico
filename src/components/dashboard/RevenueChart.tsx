import { BarChart3 } from "lucide-react";
import { formatBRL } from "@/lib/use-dashboard";
import { EmptyState, Panel, Skeleton } from "./primitives";

type Bucket = { date: Date; revenue: number; sales: number };

export function RevenueChart({
  buckets,
  loading,
  total,
}: {
  buckets: Bucket[];
  loading: boolean;
  total: number;
}) {
  const max = Math.max(...buckets.map((b) => b.revenue), 0);
  const hasData = max > 0;

  return (
    <Panel
      title="Receita dos últimos 14 dias"
      description="Somente pedidos pagos, calculados a partir das suas vendas."
      action={
        !loading && (
          <span className="text-sm font-semibold tabular-nums shrink-0">{formatBRL(total)}</span>
        )
      }
    >
      {loading ? (
        <div className="flex items-end gap-1.5 h-36">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-full" />
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={BarChart3}
          title="Aguardando primeiras vendas"
          description="Assim que um pedido for pago, a receita aparece aqui automaticamente."
        />
      ) : (
        <div className="flex items-end gap-1.5 h-36">
          {buckets.map((b) => {
            const pct = max > 0 ? (b.revenue / max) * 100 : 0;
            return (
              <div key={b.date.toISOString()} className="flex-1 h-full flex flex-col justify-end group">
                <div
                  className={`w-full rounded-t-md transition-colors ${
                    b.revenue > 0 ? "bg-primary/70 group-hover:bg-primary" : "bg-muted"
                  }`}
                  style={{ height: `${Math.max(pct, b.revenue > 0 ? 6 : 2)}%` }}
                  title={`${b.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${formatBRL(
                    b.revenue,
                  )} · ${b.sales} venda(s)`}
                />
                <span className="text-[9px] text-muted-foreground text-center mt-1 tabular-nums hidden sm:block">
                  {b.date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
