import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Bot,
  Package,
  Users,
  ArrowRight,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/analytics")({
  component: () => (
    <AppShell>
      <Analytics />
    </AppShell>
  ),
});

type RangeKey = "7d" | "30d" | "90d" | "365d";
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
  { key: "365d", label: "1 ano", days: 365 },
];

// Status considerados "venda que funcionou de verdade"
const SUCCESS_STATUSES = new Set(["paid", "preparing", "ready", "shipped", "completed"]);

interface OrderRow {
  id: string;
  code: string;
  bot_id: string;
  status: string;
  total_cents: number;
  created_at: string;
  paid_at: string | null;
  items: any;
  customer_name: string | null;
  customer_phone: string | null;
  channel: string;
}

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Analytics() {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("30d");
  const [botFilter, setBotFilter] = useState<string>("all");
  const [bots, setBots] = useState<{ id: string; name: string }[]>([]);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  const days = RANGES.find((r) => r.key === range)!.days;
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("bots")
      .select("id,name")
      .eq("user_id", user.id)
      .order("created_at")
      .then(({ data }) => setBots(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setOrders(null);
    // EXCLUI canal "test" (pedidos do bot de teste não contam como vendas)
    let q = supabase
      .from("orders")
      .select("id,code,bot_id,status,total_cents,created_at,paid_at,items,customer_name,customer_phone,channel")
      .eq("user_id", user.id)
      .neq("channel", "test")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (botFilter !== "all") q = q.eq("bot_id", botFilter);
    q.then(({ data }) => setOrders((data as OrderRow[]) ?? []));
  }, [user, since, botFilter]);

  // Apenas vendas reais que se concretizaram
  const sales = useMemo(
    () => (orders ?? []).filter((o) => SUCCESS_STATUSES.has(o.status)),
    [orders],
  );

  const metrics = useMemo(() => {
    const revenue = sales.reduce((s, o) => s + (o.total_cents ?? 0), 0);
    const count = sales.length;
    const aov = count ? Math.round(revenue / count) : 0;
    const totalAttempts = orders?.length ?? 0;
    const conv = totalAttempts ? Math.round((count / totalAttempts) * 100) : 0;
    const uniqueCustomers = new Set(
      sales.map((o) => o.customer_phone || o.customer_name || o.id),
    ).size;
    return { revenue, count, aov, conv, uniqueCustomers, totalAttempts };
  }, [sales, orders]);

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const o of sales) {
      const k = (o.paid_at ?? o.created_at).slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + o.total_cents);
    }
    return Array.from(map.entries()).map(([d, v]) => ({ d, v }));
  }, [sales, days]);

  const maxDaily = Math.max(1, ...daily.map((d) => d.v));

  const statusBreakdown = useMemo(() => {
    if (!orders) return [] as { status: string; count: number }[];
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  const topCustomers = useMemo(() => {
    const m = new Map<string, { name: string; phone: string | null; revenue: number; count: number }>();
    for (const o of sales) {
      const key = o.customer_phone || o.customer_name || o.id;
      const cur = m.get(key) ?? {
        name: o.customer_name ?? "Cliente",
        phone: o.customer_phone ?? null,
        revenue: 0,
        count: 0,
      };
      cur.revenue += o.total_cents;
      cur.count += 1;
      m.set(key, cur);
    }
    return Array.from(m.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  const recentSales = useMemo(() => sales.slice(0, 8), [sales]);

  const statusLabel: Record<string, string> = {
    pending: "Aguardando pagamento",
    paid: "Pago",
    preparing: "Em preparo",
    ready: "Pronto",
    shipped: "Enviado",
    completed: "Concluído",
    cancelled: "Cancelado",
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Análises</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas vendas reais que se concretizaram. Pedidos de teste não entram aqui.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-border bg-surface p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  range === r.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={botFilter}
            onChange={(e) => setBotFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-accent"
          >
            <option value="all">Todos os bots</option>
            {bots.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!orders ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : metrics.totalAttempts === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Stat label="Receita" value={formatBRL(metrics.revenue)} icon={DollarSign} accent />
            <Stat label="Vendas" value={String(metrics.count)} icon={ShoppingCart} />
            <Stat label="Ticket médio" value={formatBRL(metrics.aov)} icon={Package} />
            <Stat label="Conversão" value={`${metrics.conv}%`} icon={TrendingUp} />
            <Stat label="Clientes" value={String(metrics.uniqueCustomers)} icon={Users} />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Receita por dia</h2>
              <span className="text-xs text-muted-foreground">{days} dias · só vendas concluídas</span>
            </div>
            {daily.every((d) => d.v === 0) ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Sem vendas confirmadas neste período.
              </div>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {daily.map((d) => (
                  <div key={d.d} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      className="w-full rounded-t-sm bg-gradient-primary opacity-80 group-hover:opacity-100 transition-opacity"
                      style={{ height: `${(d.v / maxDaily) * 100}%`, minHeight: d.v > 0 ? 2 : 0 }}
                      title={`${d.d}: ${formatBRL(d.v)}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold mb-4">Status dos pedidos</h2>
              {statusBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido no período.</p>
              ) : (
                <ul className="space-y-2">
                  {statusBreakdown.map((s) => {
                    const pct = Math.round((s.count / metrics.totalAttempts) * 100);
                    return (
                      <li key={s.status}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{statusLabel[s.status] ?? s.status}</span>
                          <span className="text-muted-foreground tabular-nums">{s.count} · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" /> Top clientes
              </h2>
              {topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem clientes recorrentes ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {topCustomers.map((c, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.count} {c.count === 1 ? "compra" : "compras"} · {formatBRL(c.revenue)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Vendas recentes</h2>
              <Link to="/orders" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma venda concluída ainda neste período.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentSales.map((o) => (
                  <li key={o.id} className="py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-mono text-primary">
                      #{o.code?.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {o.customer_name ?? "Cliente"} · {statusLabel[o.status] ?? o.status}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.paid_at ?? o.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{formatBRL(o.total_cents)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {bots.length > 1 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Bot className="h-4 w-4" /> Vendas por bot
              </h2>
              <ul className="space-y-2">
                {bots.map((b) => {
                  const c = sales.filter((o) => o.bot_id === b.id).length;
                  const pct = metrics.count ? Math.round((c / metrics.count) * 100) : 0;
                  return (
                    <li key={b.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="truncate">{b.name}</span>
                        <span className="text-muted-foreground tabular-nums">{c} · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  const previews: { label: string; value: string; icon: typeof DollarSign }[] = [
    { label: "Receita", value: "R$ —", icon: DollarSign },
    { label: "Vendas", value: "—", icon: ShoppingCart },
    { label: "Ticket médio", value: "R$ —", icon: TrendingUp },
    { label: "Clientes", value: "—", icon: Users },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 opacity-60 pointer-events-none select-none">
        {previews.map((p) => (
          <div key={p.label} className="p-4 rounded-2xl border border-dashed border-border bg-surface">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{p.label}</span>
              <p.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-display font-bold tabular-nums text-muted-foreground">{p.value}</div>
          </div>
        ))}
      </div>

      <div className="relative rounded-3xl border border-border bg-gradient-surface overflow-hidden p-8 md:p-10">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
            <Inbox className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Sem dados ainda</span>
          </div>
          <h3 className="text-xl md:text-2xl font-display font-bold mb-2">Comece a vender para ver seus números</h3>
          <p className="text-sm text-muted-foreground mb-6">
            As análises mostram receita, ticket médio, conversão e clientes recorrentes — assim que o primeiro pedido real chegar. Pedidos do bot de teste não entram aqui.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/bots" className="inline-flex items-center gap-2 text-sm font-semibold px-4 h-10 rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
              Conectar WhatsApp <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/templates" className="inline-flex items-center gap-2 text-sm font-semibold px-4 h-10 rounded-lg border border-border hover:bg-accent">
              Usar um template
            </Link>
            <Link to="/orders" className="inline-flex items-center gap-2 text-sm font-medium px-4 h-10 rounded-lg text-muted-foreground hover:text-foreground">
              Ver comandas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border bg-surface ${accent ? "border-primary/40" : "border-border"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="text-xl md:text-2xl font-display font-bold tabular-nums">{value}</div>
    </div>
  );
}
