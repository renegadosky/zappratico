/**
 * Webhook público de confirmação de PIX (Mercado Pago e Asaas).
 *
 * Segurança: nada do corpo é confiado. Pegamos apenas o ID da cobrança,
 * localizamos o pedido correspondente e RECONSULTAMOS o provedor com as
 * credenciais do lojista para confirmar o pagamento.
 *
 * URLs a cadastrar no provedor:
 *   /api/public/payments/pix?provider=mercadopago
 *   /api/public/payments/pix?provider=asaas
 */
import { createFileRoute } from "@tanstack/react-router";

type Provider = "mercadopago" | "asaas";

function extractChargeId(provider: Provider, body: any, url: URL): string | null {
  if (provider === "mercadopago") {
    const id =
      body?.data?.id ??
      body?.resource ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id");
    const s = id ? String(id) : "";
    const digits = s.split("/").pop() ?? "";
    return /^\d+$/.test(digits) ? digits : null;
  }
  const id = body?.payment?.id ?? body?.id;
  return typeof id === "string" && /^pay_[A-Za-z0-9]+$/.test(id) ? id : null;
}

async function handle(provider: Provider, request: Request): Promise<Response> {
  const url = new URL(request.url);
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const chargeId = extractChargeId(provider, body, url);
  if (!chargeId) return Response.json({ received: true, ignored: "no charge id" });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, bot_id, status, payment_provider, platform_fee_cents")
    .eq("provider_charge_id", chargeId)
    .eq("payment_provider", provider)
    .maybeSingle();

  if (!order) return Response.json({ received: true, ignored: "order not found" });

  const { data: settings } = await supabaseAdmin
    .from("payment_settings")
    .select("mp_access_token, asaas_api_key")
    .eq("bot_id", order.bot_id)
    .maybeSingle();

  const { fetchGatewayPaymentStatus } = await import("@/server/pix-gateways.server");
  const result = await fetchGatewayPaymentStatus({
    provider,
    credentials: {
      mpAccessToken: settings?.mp_access_token ?? null,
      asaasApiKey: settings?.asaas_api_key ?? null,
    },
    chargeId,
  });

  await supabaseAdmin
    .from("orders")
    .update({
      provider_payment_status: result.status,
      ...(result.paid && order.status === "pending" ? { status: "paid" } : {}),
    })
    .eq("id", order.id);

  if (result.paid) {
    // taxa efetivamente retida pelo split do provedor
    await supabaseAdmin
      .from("platform_fee_ledger")
      .update({ status: "collected" })
      .eq("order_id", order.id)
      .eq("status", "pending");
  }

  return Response.json({ received: true, paid: result.paid, status: result.status });
}

export const Route = createFileRoute("/api/public/payments/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provider = new URL(request.url).searchParams.get("provider");
        if (provider !== "mercadopago" && provider !== "asaas") {
          return Response.json({ received: true, ignored: "invalid provider" });
        }
        try {
          return await handle(provider, request);
        } catch (e) {
          console.error("[pix-webhook] error", e);
          return Response.json({ received: true, error: true });
        }
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
