import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type OrderRow = {
  id: string;
  code: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_cents: number;
  status: string;
  channel: string;
  created_at: string;
};

export type EventRow = {
  id: string;
  type: string;
  message: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
  order_id: string;
};

export type LowStockRow = {
  id: string;
  name: string;
  stock_quantity: number;
};

export type DashboardData = {
  /** Pedidos reais dos últimos 30 dias (canal de teste excluído) */
  orders: OrderRow[];
  events: EventRow[];
  lowStock: LowStockRow[];
  counts: {
    bots: number;
    products: number;
    conversations30d: number;
    /** clientes distintos (telefone/nome) nos últimos 30 dias */
    customers30d: number;
  };
  setup: {
    hasBot: boolean;
    hasProduct: boolean;
    hasPayment: boolean;
    hasWhatsapp: boolean;
    firstBotId: string | null;
  };
};

/** Status que representam uma venda efetivada (dinheiro entrando). */
export const PAID_STATUSES = new Set([
  "paid",
  "preparing",
  "ready",
  "shipped",
  "completed",
]);

export function useDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    try {
      const [orders, events, products, bots, conversations, payment, wa, firstBot, lowStock] =
        await Promise.all([
          supabase
            .from("orders")
            .select("id,code,customer_name,customer_phone,total_cents,status,channel,created_at")
            .eq("user_id", user.id)
            .neq("channel", "test")
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false }),
          supabase
            .from("order_events")
            .select("id,type,message,from_status,to_status,created_at,order_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_active", true),
          supabase.from("bots").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", sinceIso),
          supabase
            .from("payment_settings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_enabled", true),
          supabase
            .from("whatsapp_credentials")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_connected", true),
          supabase
            .from("bots")
            .select("id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("products")
            .select("id,name,stock_quantity")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .eq("track_stock", true)
            .lte("stock_quantity", 3)
            .order("stock_quantity", { ascending: true })
            .limit(5),
        ]);

      const firstError =
        orders.error ?? events.error ?? products.error ?? bots.error ?? conversations.error;
      if (firstError) throw firstError;

      const orderRows = (orders.data ?? []) as OrderRow[];
      const customers = new Set(
        orderRows.map((o) => o.customer_phone ?? o.customer_name).filter(Boolean) as string[],
      );

      if (!mounted.current) return;
      setData({
        orders: orderRows,
        events: (events.data ?? []) as EventRow[],
        lowStock: (lowStock.data ?? []) as LowStockRow[],
        counts: {
          bots: bots.count ?? 0,
          products: products.count ?? 0,
          conversations30d: conversations.count ?? 0,
          customers30d: customers.size,
        },
        setup: {
          hasBot: (bots.count ?? 0) > 0,
          hasProduct: (products.count ?? 0) > 0,
          hasPayment: (payment.count ?? 0) > 0,
          hasWhatsapp: (wa.count ?? 0) > 0,
          firstBotId: firstBot.data?.id ?? null,
        },
      });
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : "Não foi possível carregar os dados.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    mounted.current = true;
    if (!user) return;
    setLoading(true);
    load();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 400);
    };

    const ch = supabase
      .channel(`dashboard-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        debounced,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_events", filter: `user_id=eq.${user.id}` },
        debounced,
      )
      .subscribe();

    return () => {
      mounted.current = false;
      clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  return { data, loading, error, reload: load };
}

/* ---------- Derivações (tudo calculado a partir de dados reais) ---------- */

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function deriveMetrics(orders: OrderRow[], conversations30d: number) {
  const today = startOfToday().getTime();
  const yStart = today - 86_400_000;

  const todayOrders = orders.filter((o) => new Date(o.created_at).getTime() >= today);
  const yesterdayOrders = orders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return t >= yStart && t < today;
  });

  const paid = (list: OrderRow[]) => list.filter((o) => PAID_STATUSES.has(o.status));
  const sum = (list: OrderRow[]) => list.reduce((s, o) => s + (o.total_cents ?? 0), 0);

  const todayPaid = paid(todayOrders);
  const yesterdayPaid = paid(yesterdayOrders);
  const paid30 = paid(orders);

  const todayRevenue = sum(todayPaid);
  const yesterdayRevenue = sum(yesterdayPaid);

  return {
    todayRevenue,
    todaySales: todayPaid.length,
    revenueDelta:
      yesterdayRevenue > 0
        ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
        : null,
    pending: orders.filter((o) => o.status === "pending").length,
    revenue30d: sum(paid30),
    sales30d: paid30.length,
    avgTicket: paid30.length > 0 ? Math.round(sum(paid30) / paid30.length) : 0,
    conversion:
      conversations30d > 0 ? Math.round((paid30.length / conversations30d) * 100) : null,
  };
}

export function deriveDailySeries(orders: OrderRow[], days = 14) {
  const base = startOfToday().getTime();
  const buckets = Array.from({ length: days }, (_, i) => {
    const date = new Date(base - (days - 1 - i) * 86_400_000);
    return { date, revenue: 0, sales: 0 };
  });

  for (const o of orders) {
    if (!PAID_STATUSES.has(o.status)) continue;
    const t = new Date(o.created_at).getTime();
    const idx = Math.floor((t - (base - (days - 1) * 86_400_000)) / 86_400_000);
    if (idx < 0 || idx >= days) continue;
    buckets[idx].revenue += o.total_cents ?? 0;
    buckets[idx].sales += 1;
  }
  return buckets;
}

export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
