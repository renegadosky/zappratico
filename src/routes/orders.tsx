import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  ShoppingBag,
  Phone,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ChefHat,
  Package,
  BellRing,
  Send,
  StickyNote,
  RotateCcw,
  Trash2,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { updateOrderStatus } from "@/lib/order-notify.functions";
import { addOrderNote, sendManualMessage, refundOrder } from "@/lib/order-events.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/orders")({
  component: () => (
    <AppShell>
      <OrdersPage />
    </AppShell>
  ),
});

type OrderItem = {
  product_index: number;
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "ready"
  | "shipped"
  | "completed"
  | "cancelled";

type Order = {
  id: string;
  code: string;
  bot_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: OrderItem[];
  total_cents: number;
  status: OrderStatus;
  channel: string;
  notes: string | null;
  created_at: string;
};

type StatusDef = {
  value: OrderStatus;
  label: string;
  short: string;
  icon: typeof Clock;
  color: string;
  next?: OrderStatus;
  nextLabel?: string;
};

const STATUSES: StatusDef[] = [
  { value: "pending", label: "Aguardando pagamento", short: "Pendente", icon: Clock, color: "text-amber-500 bg-amber-500/10 border-amber-500/30", next: "paid", nextLabel: "Marcar como pago" },
  { value: "paid", label: "Pago — vai para cozinha", short: "Pago", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30", next: "preparing", nextLabel: "Começar a preparar" },
  { value: "preparing", label: "Preparando", short: "Preparando", icon: ChefHat, color: "text-blue-500 bg-blue-500/10 border-blue-500/30", next: "ready", nextLabel: "Marcar como pronto" },
  { value: "ready", label: "Pronto para sair", short: "Pronto", icon: BellRing, color: "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/30", next: "shipped", nextLabel: "Saiu para entrega" },
  { value: "shipped", label: "Saiu para entrega", short: "Enviado", icon: Truck, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30", next: "completed", nextLabel: "Confirmar entrega" },
  { value: "completed", label: "Entregue", short: "Concluído", icon: Package, color: "text-primary bg-primary/10 border-primary/30" },
  { value: "cancelled", label: "Cancelado", short: "Cancelado", icon: XCircle, color: "text-destructive bg-destructive/10 border-destructive/30" },
];

const COLUMNS: OrderStatus[] = ["pending", "paid", "preparing", "ready", "shipped", "completed"];

function statusDef(s: string): StatusDef {
  return STATUSES.find((x) => x.value === s) ?? STATUSES[0];
}

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"comandas" | "lista" | "historico">("comandas");
  const [filter, setFilter] = useState<string>("active");
  const DAY_MS = 24 * 60 * 60 * 1000;
  const isRecent = (iso: string) => Date.now() - new Date(iso).getTime() < DAY_MS;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const updateStatusFn = useServerFn(updateOrderStatus);

  useEffect(() => {
    if (!user) return;
    let ignore = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, code, bot_id, customer_name, customer_phone, items, total_cents, status, channel, notes, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (ignore) return;
      if (error) {
        toast.error("Erro ao carregar pedidos");
      } else {
        setOrders((data ?? []) as unknown as Order[]);
      }
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel(`orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const o = payload.new as unknown as Order;
          setOrders((prev) => [o, ...prev]);
          toast.success(`🔔 Novo pedido #${o.code}`, {
            description: `${o.customer_name ?? "Cliente"} — ${formatBRL(o.total_cents)}`,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const o = payload.new as unknown as Order;
          setOrders((prev) => prev.map((p) => (p.id === o.id ? o : p)));
        },
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    const prev = orders;
    setOrders((p) => p.map((o) => (o.id === id ? { ...o, status } : o)));
    try {
      const res = await updateStatusFn({ data: { orderId: id, status } });
      const def = statusDef(status);
      if (res?.notified) {
        toast.success(`Status atualizado — cliente notificado no WhatsApp`);
      } else {
        toast.success(`Marcado como "${def.short}"`);
      }
    } catch (e: any) {
      setOrders(prev);
      toast.error(e?.message ?? "Não foi possível atualizar");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Apagar este pedido?")) return;
    const prev = orders;
    setOrders((p) => p.filter((o) => o.id !== id));
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      setOrders(prev);
      toast.error("Erro ao apagar");
    }
  };

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, Order[]> = {
      pending: [], paid: [], preparing: [], ready: [], shipped: [], completed: [], cancelled: [],
    };
    // Comandas (kanban) só mostra pedidos das últimas 24h para não acumular
    for (const o of orders) {
      if (!isRecent(o.created_at)) continue;
      (g[o.status] ?? g.pending).push(o);
    }
    return g;
  }, [orders]);

  const historico = useMemo(
    () => orders.filter((o) => !isRecent(o.created_at)),
    [orders],
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeOrders = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled",
  );

  return (
    <div className="p-4 md:p-8 max-w-[110rem] mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-primary" /> Comandas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeOrders.length} {activeOrders.length === 1 ? "pedido em aberto" : "pedidos em aberto"} • o cliente é avisado no WhatsApp a cada mudança.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg border border-border bg-surface">
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "comandas" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setView("comandas")}
          >
            Comandas
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setView("lista")}
          >
            Lista
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${view === "historico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setView("historico")}
          >
            <History className="h-3.5 w-3.5" />
            Histórico
            {historico.length > 0 && (
              <span className={`text-[10px] px-1.5 rounded-full ${view === "historico" ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {historico.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {view === "comandas" && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Mostrando apenas pedidos das últimas 24h. Os mais antigos vão automaticamente para o <button onClick={() => setView("historico")} className="underline hover:text-foreground">Histórico</button>.
          </p>
          <KanbanView grouped={grouped} onOpen={setSelectedId} />
        </>
      )}
      {view === "lista" && (
        <ListView
          orders={orders}
          filter={filter}
          setFilter={setFilter}
          onStatus={updateStatus}
          onDelete={remove}
        />
      )}
      {view === "historico" && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Pedidos com mais de 24h. Ficam aqui para consulta sem poluir as comandas do dia.
          </p>
          {historico.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum pedido antigo ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((o) => (
                <ListCard key={o.id} order={o} onStatus={updateStatus} onDelete={remove} />
              ))}
            </div>
          )}
        </>
      )}

      <OrderDetailsSheet
        order={orders.find((o) => o.id === selectedId) ?? null}
        onClose={() => setSelectedId(null)}
        onStatus={updateStatus}
        onDelete={(id: string) => { remove(id); setSelectedId(null); }}
      />
    </div>
  );
}

/* ===== KANBAN (comandas) ===== */
function KanbanView({
  grouped,
  onOpen,
}: {
  grouped: Record<OrderStatus, Order[]>;
  onOpen: (id: string) => void;
}) {
  const total = COLUMNS.reduce((s, c) => s + grouped[c].length, 0);
  if (total === 0) {
    return (
      <div className="relative rounded-3xl border border-border bg-gradient-surface overflow-hidden p-8 md:p-12">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
            <ShoppingBag className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Comandas em tempo real</span>
          </div>
          <h3 className="text-xl md:text-2xl font-display font-bold mb-2">Nenhuma comanda aberta agora</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Cada venda fechada pelo bot aparece aqui em um quadro estilo cozinha — pendente, pago, em preparo, pronto e entregue. O cliente é avisado no WhatsApp a cada mudança.
          </p>
          <div className="grid sm:grid-cols-3 gap-2 mb-6 max-w-md">
            {[
              { label: "Pendente", color: "bg-amber-500/20 text-amber-500" },
              { label: "Em preparo", color: "bg-blue-500/20 text-blue-500" },
              { label: "Entregue", color: "bg-emerald-500/20 text-emerald-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-dashed border-border p-3 text-center">
                <span className={`inline-block text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                <div className="mt-2 text-xs text-muted-foreground">vazio</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
      {COLUMNS.map((col) => {
        const def = statusDef(col);
        const Icon = def.icon;
        const list = grouped[col];
        return (
          <div key={col} className="bg-surface border border-border rounded-2xl p-3 flex flex-col min-h-[12rem]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`h-7 w-7 rounded-lg border flex items-center justify-center ${def.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-semibold text-sm">{def.short}</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
            </div>
            <div className="space-y-2 flex-1">
              {list.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 text-center py-6 border border-dashed border-border/50 rounded-lg">
                  vazio
                </div>
              ) : (
                list.map((o) => <ComandaCard key={o.id} order={o} onOpen={onOpen} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComandaCard({ order, onOpen }: { order: Order; onOpen: (id: string) => void }) {
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      className="w-full text-left rounded-xl border border-border bg-background p-3 hover:border-primary/40 hover:bg-accent/30 hover:shadow-card transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-sm">#{order.code}</span>
        <span className="text-[10px] text-muted-foreground">{timeAgo(order.created_at)}</span>
      </div>
      <div className="text-xs text-muted-foreground truncate mt-0.5">
        {order.customer_name ?? "Cliente"} • {totalQty} {totalQty === 1 ? "item" : "itens"}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="font-semibold text-sm tabular-nums">{formatBRL(order.total_cents)}</span>
        {order.channel === "test" && (
          <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            teste
          </span>
        )}
      </div>
    </button>
  );
}

/* ===== LISTA (clássica) ===== */
function ListView({
  orders,
  filter,
  setFilter,
  onStatus,
  onDelete,
}: {
  orders: Order[];
  filter: string;
  setFilter: (s: string) => void;
  onStatus: (id: string, s: OrderStatus) => void;
  onDelete: (id: string) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length, active: 0 };
    for (const s of STATUSES) c[s.value] = 0;
    for (const o of orders) {
      c[o.status] = (c[o.status] ?? 0) + 1;
      if (o.status !== "completed" && o.status !== "cancelled") c.active++;
    }
    return c;
  }, [orders]);

  const filtered =
    filter === "all"
      ? orders
      : filter === "active"
        ? orders.filter((o) => o.status !== "completed" && o.status !== "cancelled")
        : orders.filter((o) => o.status === filter);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        <FilterChip label="Em aberto" count={counts.active} active={filter === "active"} onClick={() => setFilter("active")} />
        <FilterChip label="Todos" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s.value}
            label={s.short}
            count={counts[s.value] ?? 0}
            active={filter === s.value}
            onClick={() => setFilter(s.value)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum pedido por aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <ListCard key={o.id} order={o} onStatus={onStatus} onDelete={onDelete} />
          ))}
        </div>
      )}
    </>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-surface border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span className={`ml-2 text-xs ${active ? "opacity-90" : "opacity-60"}`}>{count}</span>
    </button>
  );
}

function ListCard({
  order,
  onStatus,
  onDelete,
}: {
  order: Order;
  onStatus: (id: string, s: OrderStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const def = statusDef(order.status);
  const StatusIcon = def.icon;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-accent/30 transition-colors"
      >
        <div className={`shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center ${def.color}`}>
          <StatusIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">#{order.code}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(order.created_at)} atrás</span>
            {order.channel === "test" && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                teste
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {order.customer_name ?? "Cliente"}
            {order.customer_phone ? ` • ${order.customer_phone}` : ""}
            {" • "}
            {order.items.reduce((s, i) => s + i.quantity, 0)} itens
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold">{formatBRL(order.total_cents)}</div>
          <div className="text-xs text-muted-foreground">{def.short}</div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4 bg-background/50">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Itens</div>
            <div className="rounded-lg border border-border divide-y divide-border">
              {order.items.map((it, idx) => (
                <div key={idx} className="px-3 py-2 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.quantity} × {formatBRL(it.unit_price_cents)}
                    </div>
                  </div>
                  <div className="font-medium ml-3">{formatBRL(it.line_total_cents)}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Atualizar status (cliente recebe aviso no WhatsApp)
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const Active = s.value === order.status;
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    onClick={() => onStatus(order.id, s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                      Active
                        ? s.color
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {order.customer_phone && (
              <a
                href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="sm" variant="outline">
                  <Phone className="h-4 w-4 mr-1.5" /> Abrir no WhatsApp
                </Button>
              </a>
            )}
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(order.id)}>
              Apagar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== ORDER DETAILS SHEET ===== */
function OrderDetailsSheet({
  order,
  onClose,
  onStatus,
  onDelete,
}: {
  order: Order | null;
  onClose: () => void;
  onStatus: (id: string, s: OrderStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [events, setEvents] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const addNoteFn = useServerFn(addOrderNote);
  const sendFn = useServerFn(sendManualMessage);
  const refundFn = useServerFn(refundOrder);

  useEffect(() => {
    if (!order) {
      setEvents([]);
      return;
    }
    let ignore = false;
    const load = async () => {
      const { data } = await supabase
        .from("order_events")
        .select("id, type, from_status, to_status, message, metadata, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });
      if (!ignore) setEvents(data ?? []);
    };
    load();
    const ch = supabase
      .channel(`oev-${order.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_events", filter: `order_id=eq.${order.id}` },
        (payload) => setEvents((prev) => [payload.new as any, ...prev]),
      )
      .subscribe();
    return () => {
      ignore = true;
      supabase.removeChannel(ch);
    };
  }, [order?.id]);

  if (!order) return null;
  const def = statusDef(order.status);
  const StatusIcon = def.icon;

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await addNoteFn({ data: { orderId: order.id, message: note.trim() } });
      setNote("");
      toast.success("Nota adicionada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSavingNote(false);
    }
  };

  const sendMsg = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      const r = await sendFn({ data: { orderId: order.id, message: msg.trim() } });
      if (r?.sent) toast.success("Mensagem enviada");
      else toast.error(r?.error ?? "Não foi possível enviar");
      setMsg("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSending(false);
    }
  };

  const refund = async () => {
    if (!confirm("Cancelar este pedido? O estorno do PIX precisa ser feito manualmente no seu app do banco.")) return;
    setRefunding(true);
    try {
      await refundFn({ data: { orderId: order.id, reason: "Pedido cancelado pelo lojista" } });
      toast.success("Pedido marcado como cancelado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setRefunding(false);
    }
  };

  return (
    <Sheet open={!!order} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className={`h-8 w-8 rounded-lg border flex items-center justify-center ${def.color}`}>
              <StatusIcon className="h-4 w-4" />
            </span>
            Pedido #{order.code}
          </SheetTitle>
          <SheetDescription>
            {order.customer_name ?? "Cliente"}
            {order.customer_phone ? ` • ${order.customer_phone}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Itens</div>
            <div className="rounded-lg border border-border divide-y divide-border">
              {order.items.map((it, i) => (
                <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.quantity} × {formatBRL(it.unit_price_cents)}
                    </div>
                  </div>
                  <div className="font-medium ml-3">{formatBRL(it.line_total_cents)}</div>
                </div>
              ))}
              <div className="px-3 py-2 flex items-center justify-between text-sm bg-accent/30">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{formatBRL(order.total_cents)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Avançar comanda
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const active = s.value === order.status;
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    onClick={() => onStatus(order.id, s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                      active ? s.color : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" /> Enviar mensagem ao cliente
            </div>
            <Textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Olá! Tudo certo com seu pedido?"
              rows={2}
            />
            <LoadingButton
              size="sm"
              className="mt-2"
              onClick={sendMsg}
              loading={sending}
              loadingText="Enviando..."
              disabled={!msg.trim()}
            >
              <Send className="h-4 w-4 mr-1.5" /> Enviar via WhatsApp
            </LoadingButton>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" /> Nota interna
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cliente pediu sem cebola..."
              rows={2}
            />
            <LoadingButton
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={saveNote}
              loading={savingNote}
              loadingText="Salvando..."
              disabled={!note.trim()}
            >
              Adicionar nota
            </LoadingButton>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Histórico
            </div>
            {events.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem eventos.</div>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-3">
                {events.map((ev) => (
                  <li key={ev.id} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary/40 border border-primary" />
                    <div className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="text-sm">
                      {ev.message ?? ev.type}
                      {ev.from_status && ev.to_status && (
                        <span className="text-muted-foreground"> ({ev.from_status} → {ev.to_status})</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {order.customer_phone && (
              <a
                href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="sm" variant="outline">
                  <Phone className="h-4 w-4 mr-1.5" /> Abrir conversa
                </Button>
              </a>
            )}
            <LoadingButton
              size="sm"
              variant="outline"
              onClick={refund}
              loading={refunding}
              loadingText="..."
            >
              <RotateCcw className="h-4 w-4 mr-1.5" /> Cancelar pedido
            </LoadingButton>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(order.id)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Apagar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
