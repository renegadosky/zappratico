import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Circle, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  to: string;
  cta: string;
};

const STORAGE_KEY = "setup-checklist-dismissed";

export function SetupChecklist() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  const doneCount = steps?.filter((s) => s.done).length ?? 0;
  const total = steps?.length ?? 0;
  const allDone = total > 0 && doneCount === total;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const next = steps?.find((s) => !s.done);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let ignore = false;

    const load = async () => {
      const [bots, products, payments, wa, firstBot] = await Promise.all([
        supabase.from("bots").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id),
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
      ]);

      if (ignore) return;

      const botId = firstBot.data?.id;
      const editPath = botId ? `/bots/${botId}/edit` : "/bots";

      const next: Step[] = [
        {
          id: "bot",
          title: "Criar seu primeiro bot",
          description: "Use um template ou deixe a IA montar.",
          done: (bots.count ?? 0) > 0,
          to: "/templates",
          cta: "Criar bot",
        },
        {
          id: "product",
          title: "Adicionar um produto",
          description: "Cadastre o que você vende para o bot oferecer.",
          done: (products.count ?? 0) > 0,
          to: editPath,
          cta: "Adicionar produto",
        },
        {
          id: "pix",
          title: "Configurar pagamento PIX",
          description: "Para o bot enviar PIX automático ao cliente.",
          done: (payments.count ?? 0) > 0,
          to: editPath,
          cta: "Configurar PIX",
        },
        {
          id: "wa",
          title: "Conectar o WhatsApp",
          description: "Para receber e responder pedidos de verdade.",
          done: (wa.count ?? 0) > 0,
          to: editPath,
          cta: "Conectar",
        },
      ];
      setSteps(next);
    };
    load();

    const ch = supabase
      .channel(`setup-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bots", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_settings", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_credentials", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Celebra uma vez quando completar
  useEffectOnce(allDone, () => {
    if (!celebrated) {
      setCelebrated(true);
      toast.success("🎉 Setup completo! Tudo pronto pra vender.", {
        description: "Você pode esconder esta seção quando quiser.",
      });
    }
  });

  if (!steps) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 mb-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando setup...
      </div>
    );
  }

  if (dismissed && allDone) return null;

  return (
    <div className="relative rounded-2xl border border-border bg-surface overflow-hidden mb-8">
      {/* Top accent stripe — only green touch on the card */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/60" />

      <div className="relative p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted border border-border mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground/80">
                {allDone ? "Tudo pronto" : "Comece por aqui"}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold">
              {allDone ? "Seu negócio está no ar 🚀" : "Configure seu bot em 4 passos"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {allDone
                ? "Você completou todos os passos de configuração."
                : `Faltam ${total - doneCount} passos para começar a vender no automático.`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-display font-bold tabular-nums">
              {doneCount}<span className="text-muted-foreground text-lg">/{total}</span>
            </div>
            <div className="text-xs text-muted-foreground">{pct}% completo</div>
          </div>
        </div>

        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ol className="space-y-2">
          {steps.map((s, idx) => {
            const isNext = !s.done && next?.id === s.id;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  s.done
                    ? "border-border bg-background/40"
                    : isNext
                    ? "border-border bg-background/60"
                    : "border-border bg-background/40"
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    s.done
                      ? "bg-primary/15 text-primary"
                      : isNext
                      ? "bg-muted text-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${s.done ? "line-through text-muted-foreground" : ""}`}>
                    {idx + 1}. {s.title}
                  </div>
                  {!s.done && (
                    <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                  )}
                </div>
                {!s.done && (
                  <Link
                    to={s.to}
                    className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      isNext
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border hover:bg-accent"
                    }`}
                  >
                    {s.cta} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        {allDone && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={() => {
                window.localStorage.setItem(STORAGE_KEY, "1");
                setDismissed(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Esconder este painel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function useEffectOnce(condition: boolean, fn: () => void) {
  useEffect(() => {
    if (condition) fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition]);
}
