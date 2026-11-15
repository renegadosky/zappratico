import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

type PlanId = "free" | "pro" | "business";
const PRICE_TO_PLAN: Record<string, PlanId> = {
  pro_monthly: "pro",
  business_monthly: "business",
};

function lookupKeyOf(sub: any): string | undefined {
  const item = sub.items?.data?.[0];
  return item?.price?.lookup_key;
}

function planFromLookup(lookup: string | undefined): PlanId {
  if (lookup && PRICE_TO_PLAN[lookup]) return PRICE_TO_PLAN[lookup];
  return "free";
}

async function setProfilePlan(userId: string, plan: PlanId) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ plan })
    .eq("id", userId);
  if (error) console.error("[payments-webhook] update plan failed", error);
}

async function upsertSubscription(sub: any, env: StripeEnv) {
  const userId: string | undefined = sub?.metadata?.userId;
  if (!userId) {
    console.error("[payments-webhook] no userId in subscription metadata");
    return null;
  }
  const item = sub.items?.data?.[0];
  const lookup = lookupKeyOf(sub);
  const priceId = lookup ?? item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      product_id: productId ?? null,
      price_id: priceId,
      status: sub.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) console.error("[payments-webhook] upsert subscription failed", error);

  return { userId, lookup, status: sub.status as string, periodEnd };
}

/**
 * Deriva o plano a aplicar no profile, respeitando o grace period:
 * - active/trialing/past_due => plano do preço
 * - canceled mas com período pago no futuro => mantém plano (grace)
 * - canceled após o período / unpaid / incomplete_expired => free
 */
function derivePlan(status: string, lookup: string | undefined, periodEndSec: number | null | undefined): PlanId {
  const stillInPaidWindow = periodEndSec && periodEndSec * 1000 > Date.now();
  if (status === "active" || status === "trialing" || status === "past_due") {
    return planFromLookup(lookup);
  }
  if (status === "canceled" && stillInPaidWindow) {
    return planFromLookup(lookup);
  }
  return "free";
}

async function handle(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const sub = event.data.object;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const result = await upsertSubscription(sub, env);
      if (!result) return;
      const plan = derivePlan(result.status, result.lookup, result.periodEnd);
      await setProfilePlan(result.userId, plan);
      break;
    }
    case "customer.subscription.deleted": {
      const result = await upsertSubscription({ ...sub, status: "canceled" }, env);
      if (!result) return;
      // deleted = terminou completamente, sem grace
      await setProfilePlan(result.userId, "free");
      break;
    }
    default:
      console.log("[payments-webhook] ignored", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handle(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[payments-webhook] error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
