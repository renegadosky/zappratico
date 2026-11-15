import Stripe from "stripe";

export type StripeEnv = "sandbox" | "live";

/**
 * Cliente Stripe direto (sem intermediários).
 *
 * Variáveis de ambiente (somente servidor):
 *   STRIPE_SECRET_KEY      sk_test_... (sandbox) ou sk_live_... (produção)
 *   STRIPE_WEBHOOK_SECRET  whsec_... do endpoint /api/public/payments/webhook?env=sandbox|live
 *
 * O ambiente (sandbox/live) é deduzido pelo prefixo da chave e precisa bater com
 * o ambiente pedido pelo front (que deduz do prefixo de VITE_STRIPE_PUBLISHABLE_KEY).
 */

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export function stripeEnvFromKey(key: string): StripeEnv {
  return key.startsWith("sk_test_") || key.startsWith("rk_test_") ? "sandbox" : "live";
}

export function createStripeClient(env: StripeEnv): Stripe {
  const key = getEnv("STRIPE_SECRET_KEY");
  if (stripeEnvFromKey(key) !== env) {
    throw new Error(
      `Stripe: STRIPE_SECRET_KEY é de ${stripeEnvFromKey(key)}, mas o front está em ${env}. ` +
        "Use chaves (pública e secreta) do mesmo modo.",
    );
  }
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

/** Valida a assinatura do webhook com o SDK oficial da Stripe. */
export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!signature || !body) throw new Error("Missing signature or body");

  const stripe = createStripeClient(env);
  const event = await stripe.webhooks.constructEventAsync(
    body,
    signature,
    getEnv("STRIPE_WEBHOOK_SECRET"),
  );
  return event as unknown as { type: string; data: { object: any } };
}
