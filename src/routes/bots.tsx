import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Plus, Trash2, Loader2, Sparkles, Pencil, Package, MessageCircle, ShoppingBag, Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getPlan } from "@/lib/plans";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/bots")({
  component: () => (
    <AppShell>
      <BotsList />
    </AppShell>
  ),
});

interface BotRow {
  id: string;
  name: string;
  bot_type: string;
  segment: string | null;
  tone: string;
  is_active: boolean;
  template_slug: string | null;
  created_at: string;
}

type BotStats = { products: number; waConnected: boolean; salesToday: number; revenueToday: number };

function BotsList() {
  const { user, profile } = useAuth();
  const [bots, setBots] = useState<BotRow[]>([]);
  const [stats, setStats] = useState<Record<string, BotStats>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const plan = getPlan(profile?.plan);
  const atLimit = bots.length >= plan.botLimit;
  const limitLabel = plan.botLimit === Infinity ? "ilimitado" : plan.botLimit;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("bots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = (data as BotRow[]) ?? [];
    setBots(list);
    setLoading(false);

    // Carrega métricas por bot (em paralelo)
    if (list.length > 0) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const ids = list.map((b) => b.id);

      const [prodRes, waRes, ordersRes] = await Promise.all([
        supabase.from("products").select("bot_id").in("bot_id", ids).eq("is_active", true),
        supabase.from("whatsapp_credentials").select("bot_id, is_connected").in("bot_id", ids),
        supabase
          .from("orders")
          .select("bot_id, total_cents, status")
          .in("bot_id", ids)
          .neq("channel", "test")
          .gte("created_at", startOfDay.toISOString()),
      ]);

      const SUCCESS = new Set(["paid", "preparing", "ready", "shipped", "completed"]);
      const next: Record<string, BotStats> = {};
      for (const id of ids) next[id] = { products: 0, waConnected: false, salesToday: 0, revenueToday: 0 };
      for (const p of prodRes.data ?? []) next[p.bot_id].products += 1;
      for (const w of waRes.data ?? []) if (w.is_connected) next[w.bot_id].waConnected = true;
      for (const o of ordersRes.data ?? []) {
        if (SUCCESS.has(o.status)) {
          next[o.bot_id].salesToday += 1;
          next[o.bot_id].revenueToday += o.total_cents ?? 0;
        }
      }
      setStats(next);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const deleteBot = async (id: string) => {
    const { error } = await supabase.from("bots").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Bot excluído");
      load();
    }
  };

  const toggleActive = async (b: BotRow) => {
    setToggling(b.id);
    const { error } = await supabase.from("bots").update({ is_active: !b.is_active }).eq("id", b.id);
    setToggling(null);
    if (error) toast.error(error.message);
    else {
      setBots((prev) => prev.map((x) => (x.id === b.id ? { ...x, is_active: !b.is_active } : x)));
      toast.success(!b.is_active ? "Bot ativado" : "Bot pausado");
    }
  };

  const formatBRL = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });



  const NewBotButton = atLimit ? (
    <Link to="/stores">
      <Button className="bg-gradient-primary text-primary-foreground shadow-glow">
        <Plus className="h-4 w-4 mr-2" /> Adicionar loja
      </Button>
    </Link>
  ) : (
    <Link to="/templates">
      <Button className="bg-gradient-primary text-primary-foreground shadow-glow">
        <Plus className="h-4 w-4 mr-2" /> Novo bot
      </Button>
    </Link>
  );

  const handleBlockedNew = () => {
    toast.error(`Você atingiu o limite de ${limitLabel} ${plan.botLimit === 1 ? "bot" : "bots"} do plano ${plan.name}.`, {
      description: "Faça upgrade para criar mais.",
      action: { label: "Ver planos", onClick: () => (window.location.href = "/plans") },
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Meus bots</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {bots.length} de {limitLabel} · plano <span className="capitalize text-foreground font-medium">{plan.name}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/ai-builder">
            <Button variant="outline">
              <Sparkles className="h-4 w-4 mr-2" /> Gerar com IA
            </Button>
          </Link>
          {atLimit ? (
            <Button onClick={handleBlockedNew} className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4 mr-2" /> Novo bot
            </Button>
          ) : (
            NewBotButton
          )}
        </div>
      </div>

      {loading ? (

        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : bots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 md:p-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-xl font-display font-semibold mb-2">Nenhum bot ainda</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            Crie seu primeiro bot a partir de um template pronto ou gere com IA em segundos.
          </p>
          <div className="flex justify-center gap-2">
            <Link to="/templates">
              <Button className="bg-gradient-primary text-primary-foreground shadow-glow">
                <Plus className="h-4 w-4 mr-2" /> Escolher template
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((b) => {
            const st = stats[b.id];
            return (
              <div
                key={b.id}
                className={`p-5 rounded-2xl bg-surface border transition-all hover:shadow-card ${
                  b.is_active ? "border-border hover:border-primary/40" : "border-border/60 opacity-90"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      b.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-base truncate">{b.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {b.segment && <span className="truncate">{b.segment}</span>}
                        {b.segment && <span>·</span>}
                        <span className="capitalize">{b.tone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" title={b.is_active ? "Pausar bot" : "Ativar bot"}>
                    <Power className={`h-3.5 w-3.5 ${b.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    <Switch
                      checked={b.is_active}
                      disabled={toggling === b.id}
                      onCheckedChange={() => toggleActive(b)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <Metric
                    icon={Package}
                    label="Produtos"
                    value={st ? String(st.products) : "—"}
                  />
                  <Metric
                    icon={MessageCircle}
                    label="WhatsApp"
                    value={st ? (st.waConnected ? "On" : "Off") : "—"}
                    tone={st?.waConnected ? "ok" : st ? "warn" : "muted"}
                  />
                  <Metric
                    icon={ShoppingBag}
                    label="Hoje"
                    value={st ? (st.salesToday > 0 ? formatBRL(st.revenueToday) : `${st.salesToday}`) : "—"}
                    tone={st && st.salesToday > 0 ? "ok" : "muted"}
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <Link to="/bots/$botId/edit" params={{ botId: b.id }}>
                    <Button size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Abrir editor
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir bot?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso removerá "{b.name}" e tudo relacionado permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteBot(b.id)} className="bg-destructive text-destructive-foreground">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "muted",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "muted" | "ok" | "warn";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-500"
      : tone === "warn"
      ? "text-amber-500"
      : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums truncate ${toneCls}`}>{value}</div>
    </div>
  );
}
