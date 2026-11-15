import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH_VERSION = "v21.0";

/**
 * Adiciona uma nota interna à timeline do pedido (não envia nada ao cliente).
 */
export const addOrderNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        message: z.string().trim().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, bot_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("Pedido não encontrado");

    const { error } = await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      user_id: order.user_id,
      bot_id: order.bot_id,
      type: "note",
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Envia uma mensagem manual ao cliente via WhatsApp e registra na timeline.
 */
export const sendManualMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        message: z.string().trim().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, bot_id, conversation_id, customer_phone, channel")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("Pedido não encontrado");

    let sent = false;
    let errorMsg: string | null = null;

    if (order.channel === "whatsapp" && order.customer_phone) {
      const { data: cred } = await supabaseAdmin
        .from("whatsapp_credentials")
        .select("phone_number_id, access_token")
        .eq("bot_id", order.bot_id)
        .maybeSingle();

      if (cred?.phone_number_id && cred.access_token) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/${GRAPH_VERSION}/${cred.phone_number_id}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${cred.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: order.customer_phone,
                type: "text",
                text: { body: data.message, preview_url: false },
              }),
            },
          );
          if (res.ok) {
            sent = true;
            const json: any = await res.json();
            if (order.conversation_id) {
              await supabaseAdmin.from("messages").insert({
                conversation_id: order.conversation_id,
                bot_id: order.bot_id,
                user_id: order.user_id,
                direction: "outbound",
                content: data.message,
                wa_message_id: json?.messages?.[0]?.id ?? null,
              });
            }
          } else {
            errorMsg = `WhatsApp respondeu ${res.status}`;
          }
        } catch (e: any) {
          errorMsg = e?.message ?? "Erro de rede";
        }
      } else {
        errorMsg = "WhatsApp não está conectado";
      }
    } else {
      errorMsg = "Pedido sem canal WhatsApp/telefone";
    }

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      user_id: order.user_id,
      bot_id: order.bot_id,
      type: "message_sent",
      message: data.message,
      metadata: { sent, error: errorMsg },
    });

    return { ok: true, sent, error: errorMsg };
  });

/** Busca as credenciais do gateway do bot (server-only). */
async function loadBotCredentials(botId: string) {
  const { data } = await supabaseAdmin
    .from("payment_settings")
    .select("mp_access_token, asaas_api_key")
    .eq("bot_id", botId)
    .maybeSingle();
  return { mpAccessToken: data?.mp_access_token ?? null, asaasApiKey: data?.asaas_api_key ?? null };
}

/**
 * Cancela o pedido. Quando houve cobrança real no Mercado Pago/Asaas,
 * solicita o estorno no provedor e registra o resultado.
 */
export const refundOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.string().trim().max(500).optional(),
        amountCents: z.number().int().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, user_id, bot_id, status, total_cents, refunded_cents, payment_provider, provider_charge_id",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("Pedido não encontrado");

    const provider = order.payment_provider;
    const isGateway =
      (provider === "mercadopago" || provider === "asaas") && Boolean(order.provider_charge_id);

    let refundedCents = Number(order.refunded_cents ?? 0);
    let refundStatus: string = isGateway ? "requested" : "not_applicable";
    let providerStatus: string | null = null;
    let gatewayMessage: string | null = null;

    if (isGateway) {
      const { refundGatewayPayment, normalizePaymentStatus } = await import(
        "@/server/pix-gateways.server"
      );
      const credentials = await loadBotCredentials(order.bot_id);
      const result = await refundGatewayPayment({
        provider: provider as "mercadopago" | "asaas",
        credentials,
        chargeId: order.provider_charge_id!,
        amountCents: data.amountCents ?? null,
      });
      gatewayMessage = result.message ?? null;
      providerStatus = normalizePaymentStatus(provider, result.status).state;
      if (result.ok) {
        refundedCents += result.refundedCents || (data.amountCents ?? Number(order.total_cents ?? 0));
        refundStatus =
          refundedCents >= Number(order.total_cents ?? 0) ? "refunded" : "partially_refunded";
      } else {
        refundStatus = "failed";
      }

      await supabaseAdmin.from("payment_events").insert({
        order_id: order.id,
        user_id: order.user_id,
        bot_id: order.bot_id,
        provider,
        kind: "refund",
        status: refundStatus,
        amount_cents: result.refundedCents ?? 0,
        message: gatewayMessage,
        raw: JSON.parse(JSON.stringify(result)),
      });

      if (!result.ok) throw new Error(gatewayMessage ?? "O provedor recusou o reembolso.");
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelled",
        refunded_cents: refundedCents,
        refund_status: refundStatus,
        refund_reason: data.reason ?? null,
        refunded_at: new Date().toISOString(),
        ...(providerStatus ? { provider_payment_status: providerStatus } : {}),
      })
      .eq("id", order.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      user_id: order.user_id,
      bot_id: order.bot_id,
      type: "refund",
      message: data.reason ?? (isGateway ? "Pedido cancelado e estornado" : "Pedido cancelado"),
      metadata: { refundStatus, refundedCents, provider },
    });

    return { ok: true, refundStatus, refundedCents };
  });

/**
 * Conciliação manual/automática: consulta o provedor e sincroniza o status real
 * do pagamento com o pedido (usado quando o webhook não chegou).
 */
export const reconcileOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, user_id, bot_id, status, payment_provider, provider_charge_id, reconcile_attempts",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("Pedido não encontrado");

    const provider = order.payment_provider;
    if ((provider !== "mercadopago" && provider !== "asaas") || !order.provider_charge_id) {
      return { ok: false, reason: "sem_cobranca_no_provedor" as const };
    }

    const { fetchGatewayPaymentStatus, normalizePaymentStatus } = await import(
      "@/server/pix-gateways.server"
    );
    const credentials = await loadBotCredentials(order.bot_id);
    const status = await fetchGatewayPaymentStatus({
      provider,
      credentials,
      chargeId: order.provider_charge_id,
    });
    const normalized = normalizePaymentStatus(provider, status.status);

    const shouldPay = status.paid && order.status === "pending";
    await supabaseAdmin
      .from("orders")
      .update({
        provider_payment_status: normalized.state,
        last_reconciled_at: new Date().toISOString(),
        reconcile_attempts: Number(order.reconcile_attempts ?? 0) + 1,
        ...(shouldPay ? { status: "paid" } : {}),
      })
      .eq("id", order.id);

    await supabaseAdmin.from("payment_events").insert({
      order_id: order.id,
      user_id: order.user_id,
      bot_id: order.bot_id,
      provider,
      kind: "reconcile",
      status: normalized.state,
      amount_cents: 0,
      message: `Status no provedor: ${status.status}`,
      raw: JSON.parse(JSON.stringify(status)),
    });

    return { ok: true, paid: status.paid, state: normalized.state, changed: shouldPay };
  });

