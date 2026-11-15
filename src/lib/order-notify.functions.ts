import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH_VERSION = "v21.0";

const STATUS_MESSAGES: Record<string, (code: string) => string> = {
  paid: (c) => `✅ Pagamento confirmado! Seu pedido #${c} já entrou na fila. Te aviso assim que começarmos a preparar 🍳`,
  preparing: (c) => `👨‍🍳 Boa notícia! Seu pedido #${c} está sendo preparado agora. Já já fica pronto!`,
  ready: (c) => `🎉 Seu pedido #${c} ficou pronto! Estamos só aguardando para sair pra entrega/retirada.`,
  shipped: (c) => `🛵 Seu pedido #${c} saiu para entrega! Já já chega aí.`,
  completed: (c) => `📦 Pedido #${c} entregue. Muito obrigado pela preferência! Volte sempre 💛`,
  cancelled: (c) => `❌ Seu pedido #${c} foi cancelado. Se ficou alguma dúvida, é só responder por aqui.`,
};

const Input = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "paid", "preparing", "ready", "shipped", "completed", "cancelled"]),
});

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1) Carrega o pedido (e valida posse)
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, code, user_id, bot_id, conversation_id, customer_phone, channel, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (oErr || !order) throw new Error("Pedido não encontrado");
    if (order.user_id !== userId) throw new Error("Sem permissão");

    // 2) Atualiza status
    const { error: uErr } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.orderId);
    if (uErr) throw new Error(uErr.message);

    // 3) Se canal whatsapp e tem telefone, dispara aviso ao cliente
    let notified = false;
    if (
      order.channel === "whatsapp" &&
      order.customer_phone &&
      STATUS_MESSAGES[data.status]
    ) {
      const { data: cred } = await supabaseAdmin
        .from("whatsapp_credentials")
        .select("phone_number_id, access_token")
        .eq("bot_id", order.bot_id)
        .maybeSingle();

      if (cred?.phone_number_id && cred.access_token) {
        const body = STATUS_MESSAGES[data.status](order.code);
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
                text: { body, preview_url: false },
              }),
            },
          );
          if (res.ok) {
            notified = true;
            const json: any = await res.json();
            if (order.conversation_id) {
              await supabaseAdmin.from("messages").insert({
                conversation_id: order.conversation_id,
                bot_id: order.bot_id,
                user_id: order.user_id,
                direction: "outbound",
                content: body,
                wa_message_id: json?.messages?.[0]?.id ?? null,
              });
            }
          } else {
            console.error("WA notify error", res.status, await res.text());
          }
        } catch (e) {
          console.error("WA notify exception", e);
        }
      }
    }

    return { ok: true, notified };
  });
