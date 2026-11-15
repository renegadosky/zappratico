import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { getVisiblePlans, type PlanId } from "@/lib/plans";
import { Check, Crown, X, Loader2 } from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { changePlan, cancelSubscription, resumeSubscription } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

export const Route = createFileRoute("/plans")({
  validateSearch: (s: Record<string, unknown>): { checkout?: string; session_id?: string } => ({
    checkout: typeof s.checkout === "string" ? s.checkout : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: () => (
    <AppShell>
      <PlansPage />
    </AppShell>
  ),
});

const PRICE_IDS: Partial<Record<PlanId, string>> = {
  pro: "pro_monthly",
  business: "business_monthly",
};

const PLAN_FROM_LOOKUP: Record<string, PlanId> = {
  pro_monthly: "pro",
  business_monthly: "business",
};

function PlansPage() {
  const { profile, user, refreshProfile } = useAuth();
  const { subscription, isActive, refetch } = useSubscription();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const { checkout } = useSearch({ from: "/plans" });
  const [busy, setBusy] = useState<string | null>(null);

  // Após retorno do Stripe, força refresh
  useEffect(() => {
    if (checkout === "success") {
      const t = setInterval(async () => {
        await Promise.all([refetch(), refreshProfile()]);
      }, 1500);
      setTimeout(() => clearInterval(t), 10000);
      toast.success("Pagamento confirmado! Atualizando seu plano...");
      return () => clearInterval(t);
    }
  }, [checkout, refetch, refreshProfile]);

  const currentPlan: PlanId = (() => {
    if (subscription && isActive) {
      const fromSub = PLAN_FROM_LOOKUP[subscription.price_id];
      if (fromSub) return fromSub;
    }
    return profile?.plan ?? "free";
  })();

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
    : null;

  const handleNew = (id: PlanId) => {
    if (!user) return;
    const priceId = PRICE_IDS[id];
    if (!priceId) return;
    openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      returnUrl: `${window.location.origin}/plans?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  const handleChange = async (id: PlanId) => {
    const priceId = PRICE_IDS[id];
    if (!priceId) return;
    setBusy(id);
    try {
      await changePlan({ data: { newPriceId: priceId, environment: getStripeEnvironment() } });
      toast.success(`Troca agendada! Seu plano vira ${id} em ${periodEnd ?? "no próximo ciclo"}.`);
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível trocar o plano.");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm(`Cancelar assinatura? Você mantém acesso até ${periodEnd ?? "o fim do período pago"}.`)) return;
    setBusy("cancel");
    try {
      await cancelSubscription({ data: { environment: getStripeEnvironment() } });
      toast.success("Cancelamento agendado.");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar.");
    } finally {
      setBusy(null);
    }
  };

  const handleResume = async () => {
    setBusy("resume");
    try {
      await resumeSubscription({ data: { environment: getStripeEnvironment() } });
      toast.success("Assinatura reativada!");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao reativar.");
    } finally {
      setBusy(null);
    }
  };

  const renderButton = (planId: PlanId) => {
    const isCurrent = currentPlan === planId;
    const hasActiveSub = !!subscription && isActive;



    if (isCurrent) {
      if (subscription?.cancel_at_period_end) {
        return (
          <Button onClick={handleResume} disabled={busy === "resume"} className="w-full">
            {busy === "resume" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Reativar
          </Button>
        );
      }
      return <Button disabled className="w-full" variant="outline">Plano atual</Button>;
    }

    if (hasActiveSub) {
      return (
        <Button
          onClick={() => handleChange(planId)}
          disabled={busy === planId}
          className="w-full"
        >
          {busy === planId && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Trocar para este
        </Button>
      );
    }

    return (
      <Button
        onClick={() => handleNew(planId)}
        disabled={!user}
        className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
      >
        Assinar
      </Button>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
          <Crown className="h-3.5 w-3.5" /> Planos
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">Escolha o plano ideal</h1>
        <p className="text-muted-foreground">Crie mais lojas conforme seu negócio cresce</p>
      </div>

      {subscription && isActive && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="font-medium">
              Você está no plano <span className="text-primary">{currentPlan}</span>
              {subscription.cancel_at_period_end && (
                <Badge variant="outline" className="ml-2">Cancelamento agendado</Badge>
              )}
            </div>
            {periodEnd && (
              <div className="text-muted-foreground">
                {subscription.cancel_at_period_end
                  ? `Acesso até ${periodEnd}.`
                  : `Renova em ${periodEnd}.`}
              </div>
            )}
          </div>
          {!subscription.cancel_at_period_end && (
            <Button onClick={handleCancel} disabled={busy === "cancel"} variant="outline" size="sm">
              {busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancelar assinatura
            </Button>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {getVisiblePlans().map((p) => (
          <div
            key={p.id}
            className={`relative rounded-2xl p-6 border ${
              p.highlighted
                ? "border-primary bg-gradient-to-b from-primary/5 to-surface shadow-glow"
                : "border-border bg-surface"
            }`}
          >
            {p.highlighted && (
              <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground hover:bg-primary">
                Mais popular
              </Badge>
            )}
            <div className="mb-4">
              <h3 className="font-display font-bold text-xl">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground">/{p.priceLabel}</span>
              </div>
            </div>
            <ul className="space-y-2.5 mb-6">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {renderButton(p.id)}
          </div>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground mt-6">
        Pagamento seguro processado pela Stripe. Cancele quando quiser.
      </p>

      {/* Tabela comparativa */}
      <div className="mt-12">
        <h2 className="text-2xl font-display font-bold text-center mb-2">Compare os planos</h2>
        <p className="text-center text-muted-foreground text-sm mb-6">Tudo que cada plano oferece, lado a lado.</p>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 font-medium">Recurso</th>
                <th className="p-4 font-medium text-primary">Profissional</th>
                <th className="p-4 font-medium">Business</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Lojas", pro: "Até 5", business: "Ilimitadas" },
                { label: "Bots por loja", pro: "1", business: "Ilimitados" },
                { label: "Produtos no catálogo", pro: "Ilimitados", business: "Ilimitados" },
                { label: "Mini-loja pública", pro: true, business: true },
                { label: "PIX na sua chave", pro: true, business: true },
                { label: "QR Code PIX automático", pro: true, business: true },
                { label: "Editor visual da mini-loja", pro: true, business: true },
                { label: "Simulador de teste do bot", pro: true, business: true },
                { label: "Catálogo nativo do WhatsApp", pro: false, business: true },
                { label: "Assistente de Criação avançada", pro: false, business: true },
                { label: "Suporte", pro: "Prioritário", business: "Dedicado" },
                { label: "Taxa por pedido", pro: "0%", business: "0%" },
              ].map((row) => (
                <tr key={row.label} className="border-b border-border/50 last:border-0">
                  <td className="p-4 text-left">{row.label}</td>
                  {(["pro", "business"] as const).map((k) => {
                    const v = row[k];
                    return (
                      <td key={k} className="p-4 text-center">
                        {typeof v === "boolean" ? (
                          v ? <Check className="h-4 w-4 text-primary mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                        ) : (
                          <span className={k === "pro" ? "text-primary font-medium" : ""}>{v}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-3">
          Dúvidas antes de assinar? Fale com o suporte em zappratico_suport@gmail.com.
        </p>
      </div>



      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto relative">
            <button
              onClick={closeCheckout}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted z-10"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            {checkoutElement}
          </div>
        </div>
      )}
    </div>
  );
}
