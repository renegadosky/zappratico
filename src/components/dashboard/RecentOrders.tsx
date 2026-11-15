import { Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag } from "lucide-react";
import type { OrderRow } from "@/lib/use-dashboard";
import { formatBRL } from "@/lib/use-dashboard";
import { EmptyState, Panel, Skeleton, StatusBadge } from "./primitives";

export function RecentOrders({ orders, loading }: { orders: OrderRow[]; loading: boolean }) {
  const list = orders.slice(0, 6);

  return (
    <Panel
      title="Últimos pedidos"
      description="Pedidos reais recebidos pelos seus canais."
      action={
        <Link to="/orders" className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0">
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="h-3 w-16" />
            </li>
          ))}
        </ul>
      ) : list.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhum pedido ainda"
          description="Quando seus clientes fizerem pedidos, eles aparecem aqui em tempo real."
        >
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-border px-3 py-1.5 hover:border-primary/40"
          >
            Abrir comandas <ArrowRight className="h-3 w-3" />
          </Link>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((o) => (
            <li key={o.id} className="py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-[11px] font-mono text-muted-foreground shrink-0">
                #{o.code?.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{o.customer_name ?? "Cliente"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {new Date(o.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <div className="hidden sm:block shrink-0">
                <StatusBadge status={o.status} />
              </div>
              <div className="text-sm font-semibold tabular-nums shrink-0">{formatBRL(o.total_cents)}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
