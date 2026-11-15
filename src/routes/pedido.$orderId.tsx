import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Check, Clock, ChefHat, Package, Truck, XCircle, ShoppingBag } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/pedido/$orderId")({
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Acompanhar pedido — status em tempo real" },
      { name: "description", content: "Veja o andamento do seu pedido: pagamento, preparo e entrega, atualizado automaticamente." },
      { property: "og:title", content: "Acompanhar pedido" },
      { property: "og:description", content: "Veja o andamento do seu pedido em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackOrder,
});

const STEPS = [
  { key: "pending", label: "Aguardando pagamento", icon: Clock },
  { key: "paid", label: "Pagamento confirmado", icon: Check },
  { key: "preparing", label: "Em preparo", icon: ChefHat },
  { key: "ready", label: "Pronto", icon: Package },
  { key: "completed", label: "Entregue", icon: Truck },
];

const ORDER = ["pending", "paid", "preparing", "ready", "shipped", "completed"];

function money(cents: number) {
  return `R$ ${((cents ?? 0) / 100).toFixed(2).replace(".", ",")}`;
}

function TrackOrder() {
  const { orderId } = Route.useParams();
  const { code } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ code: string; status: string; total_cents: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) { setError("Link inválido: falta o código do pedido."); setLoading(false); return; }
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/public/store/checkout?id=${orderId}&code=${encodeURIComponent(code)}`);
        const json = await res.json();
        if (stop) return;
        if (!res.ok) { setError(json?.error ?? "Pedido não encontrado."); }
        else { setData(json); setError(null); }
      } catch {
        if (!stop) setError("Não conseguimos consultar o pedido agora.");
      } finally {
        if (!stop) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => { stop = true; clearInterval(id); };
  }, [orderId, code]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-2xl font-display font-bold">Pedido não encontrado</h1>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const cancelled = data.status === "cancelled";
  const currentIdx = ORDER.indexOf(data.status);

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <header className="text-center">
          <div className="text-sm text-muted-foreground">Pedido</div>
          <h1 className="text-3xl font-display font-bold">#{data.code}</h1>
          <div className="text-xl font-semibold text-primary mt-1">{money(data.total_cents)}</div>
        </header>

        {cancelled ? (
          <div className="bg-surface border border-border rounded-2xl p-6 text-center space-y-2">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="font-semibold">Pedido cancelado</h2>
            <p className="text-sm text-muted-foreground">Se você já pagou, fale com a loja para resolver o estorno.</p>
          </div>
        ) : (
          <ol className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            {STEPS.map((s) => {
              const idx = ORDER.indexOf(s.key);
              const done = currentIdx >= idx;
              const active = currentIdx === idx;
              const Icon = s.icon;
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>{s.label}</div>
                    {active && <div className="text-xs text-primary">Agora</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Esta página se atualiza sozinha. Você pode salvar o link para acompanhar depois.
        </p>
      </div>
    </div>
  );
}
