import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateReply, type ReplyMessage } from "@/server/ai-reply.server";

/**
 * WhatsApp Cloud API webhook (Meta).
 *
 * GET  → Verificação inicial (Meta envia hub.challenge)
 * POST → Recebe mensagens dos clientes e responde via IA (texto + imagens + PIX)
 */

const GRAPH_VERSION = "v21.0";

// Rate limit: máx N mensagens por janela por (bot, customer_phone)
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode !== "subscribe" || !token || !challenge) return new Response("Bad Request", { status: 400 });

        const { data } = await supabaseAdmin
          .from("whatsapp_credentials")
          .select("id")
          .eq("verify_token", token)
          .limit(1)
          .maybeSingle();

        if (!data) return new Response("Forbidden", { status: 403 });
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      },

      POST: async ({ request }) => {
        // Verifica assinatura HMAC-SHA256 da Meta (X-Hub-Signature-256)
        const appSecret = process.env.WHATSAPP_APP_SECRET;
        if (!appSecret) {
          console.error("WHATSAPP_APP_SECRET não configurado - webhook rejeitado");
          return new Response("Server not configured", { status: 503 });
        }

        const signatureHeader = request.headers.get("x-hub-signature-256");
        if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
          return new Response("Missing signature", { status: 401 });
        }

        const rawBody = await request.text();
        const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
        const provided = signatureHeader.slice("sha256=".length);

        let valid = false;
        try {
          const a = Buffer.from(provided, "hex");
          const b = Buffer.from(expected, "hex");
          valid = a.length === b.length && timingSafeEqual(a, b);
        } catch {
          valid = false;
        }
        if (!valid) return new Response("Invalid signature", { status: 403 });

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        try {
          await processWebhook(payload);
        } catch (err) {
          console.error("whatsapp webhook error:", err);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function processWebhook(payload: any) {
  if (payload?.object !== "whatsapp_business_account") return;
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change?.value;
      const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      if (!phoneNumberId || messages.length === 0) continue;

      const { data: cred } = await supabaseAdmin
        .from("whatsapp_credentials")
        .select("bot_id, user_id, access_token, phone_number_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (!cred?.access_token) continue;

      const { data: bot } = await supabaseAdmin
        .from("bots")
        .select("id, name, tone, is_active, greeting_morning, greeting_afternoon, greeting_evening, away_message, segment, menu_delivery")
        .eq("id", cred.bot_id)
        .maybeSingle();
      if (!bot || !bot.is_active) continue;

      for (const msg of messages.slice(0, 5)) {
        if (msg.type !== "text") continue;
        const fromPhone = sanitizePhone(msg.from);
        const text = String(msg.text?.body ?? "").slice(0, 2000);
        const waProfileName = contacts.find((c: any) => c.wa_id === msg.from)?.profile?.name?.toString().slice(0, 100) ?? null;
        if (!fromPhone || !text) continue;

        // Rate limit
        const allowed = await checkRateLimit(cred.bot_id, fromPhone);
        if (!allowed) {
          console.warn("rate limited", cred.bot_id, fromPhone);
          continue;
        }

        // Marca como lida + "digitando..." imediatamente (UX humana, anti-banimento)
        if (msg.id) {
          markReadWithTyping(cred.phone_number_id!, cred.access_token, msg.id).catch((e) =>
            console.warn("typing indicator failed", e),
          );
        }

        const { data: conv } = await supabaseAdmin
          .from("conversations")
          .upsert(
            {
              bot_id: cred.bot_id,
              user_id: cred.user_id,
              customer_phone: fromPhone,
              customer_name: waProfileName,
              last_message_at: new Date().toISOString(),
            },
            { onConflict: "bot_id,customer_phone" },
          )
          .select("id, state, customer_name")
          .maybeSingle();
        if (!conv) continue;

        // Nome conhecido = nome salvo OU nome do perfil do WhatsApp OU nome extraído desta mensagem
        const extractedName = extractNameFromText(text);
        const knownName =
          (conv as any).customer_name ||
          (conv.state as any)?.confirmed_name ||
          waProfileName ||
          extractedName;

        // Se acabamos de descobrir o nome agora, persiste
        if (extractedName && !((conv as any).customer_name) && !(conv.state as any)?.confirmed_name) {
          await supabaseAdmin
            .from("conversations")
            .update({
              customer_name: extractedName,
              state: { ...(conv.state as any), confirmed_name: extractedName },
            })
            .eq("id", conv.id);
        }

        await supabaseAdmin.from("messages").insert({
          conversation_id: conv.id,
          bot_id: cred.bot_id,
          user_id: cred.user_id,
          direction: "inbound",
          content: text,
          wa_message_id: msg.id ?? null,
        });

        const { data: history } = await supabaseAdmin
          .from("messages")
          .select("direction, content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(20);
        const recent = (history ?? []).reverse();

        const [{ data: products }, { data: payment }, { data: flowRow }, { data: menuRow }] = await Promise.all([
          supabaseAdmin
            .from("products")
            .select("name, description, price_cents, image_url, track_stock, stock_quantity")
            .eq("bot_id", cred.bot_id)
            .eq("is_active", true)
            .order("sort_order")
            .limit(30),
          supabaseAdmin
            .from("payment_settings")
            .select(
              "provider, pix_key, beneficiary_name, beneficiary_city, is_enabled, mp_access_token, asaas_api_key",
            )
            .eq("bot_id", cred.bot_id)
            .maybeSingle(),
          supabaseAdmin
            .from("bot_flows")
            .select("blocks")
            .eq("bot_id", cred.bot_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabaseAdmin
            .from("menus")
            .select("name, cover_image_url")
            .eq("bot_id", cred.bot_id)
            .eq("is_active", true)
            .not("cover_image_url", "is", null)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const { loadPlatformSettings, createOrderWithFee } = await import(
          "@/server/monetization.server"
        );
        const platform = await loadPlatformSettings();

        const { replies, order } = await generateReply({
          bot,
          customerName: knownName,
          history: recent,
          products: products ?? [],
          payment: payment ?? null,
          flow: Array.isArray(flowRow?.blocks) ? (flowRow!.blocks as any[]) : null,
          menuImageUrl: (menuRow as { cover_image_url?: string | null } | null)?.cover_image_url ?? null,
          menuName: (menuRow as { name?: string | null } | null)?.name ?? null,
          menuDelivery: ((bot as any)?.menu_delivery ?? "auto") as "auto" | "image" | "list",
          feePercent: platform.fee_percent,
          customerPhone: fromPhone,
          platformSplit: {
            asaasWalletId: platform.platform_asaas_wallet_id,
            mpUserId: platform.platform_mp_user_id,
          },
        });



        for (const r of replies) {
          const { sentId, savedContent } = await sendReply(cred.phone_number_id!, cred.access_token, fromPhone, r);
          if (savedContent) {
            await supabaseAdmin.from("messages").insert({
              conversation_id: conv.id,
              bot_id: cred.bot_id,
              user_id: cred.user_id,
              direction: "outbound",
              content: savedContent,
              wa_message_id: sentId,
            });
          }
          // pequeno gap entre mensagens (parecer humano, sem prender o webhook)
          await sleep(400);
        }

        // Registra o pedido detectado pela IA (se houver), com a taxa da plataforma
        if (order && order.items.length > 0) {
          await createOrderWithFee({
            userId: cred.user_id,
            botId: cred.bot_id,
            conversationId: conv.id,
            customerPhone: fromPhone,
            customerName: knownName,
            items: order.items,
            subtotalCents: order.total_cents,
            channel: "whatsapp",
            officialPayment: order.official_payment,
            provider: order.payment_provider ?? payment?.provider ?? "manual_pix",
            providerChargeId: order.provider_charge_id ?? null,
            pixQrCode: order.pix_qr_code ?? null,
            pixQrCodeText: order.pix_qr_code_text ?? null,
            pixExpiresAt: order.pix_expires_at ?? null,
          });
        }


        await supabaseAdmin
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conv.id);
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, Math.min(ms, 1500)));
}

/**
 * Heurística simples pra extrair nome quando o cliente responde "meu nome é X" / "sou o X" / "X" sozinho.
 * Não invasiva: ignora frases longas ou que parecem pedido.
 */
function extractNameFromText(text: string): string | null {
  const t = text.trim();
  if (t.length > 60) return null;
  const patterns = [
    /(?:me chamo|meu nome[ée]?|sou(?:\s+o|\s+a)?|aqui[ée]?(?:\s+o|\s+a)?)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s'-]{1,30})/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && m[1]) return cleanName(m[1]);
  }
  // mensagem curtinha só com o nome (1-3 palavras, letras)
  if (/^[A-Za-zÀ-ú][A-Za-zÀ-ú\s'-]{1,30}$/.test(t) && t.split(/\s+/).length <= 3) {
    // ignora palavras óbvias de não-nome
    const bad = /^(oi|ola|olá|bom dia|boa tarde|boa noite|cardapio|cardápio|menu|preço|preco|pix|sim|nao|não|ok|obrigado|obrigada|valeu)$/i;
    if (!bad.test(t)) return cleanName(t);
  }
  return null;
}

function cleanName(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 60);
}

async function markReadWithTyping(phoneNumberId: string, accessToken: string, messageId: string) {
  // API Meta v21+: marca como lida + mostra "digitando..." por até 25s ou até a próxima mensagem
  await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    }),
  });
}

async function sendReply(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  reply: ReplyMessage,
): Promise<{ sentId: string | null; savedContent: string }> {
  if (reply.type === "text") {
    const id = await sendText(phoneNumberId, accessToken, to, reply.content);
    return { sentId: id, savedContent: reply.content };
  }
  if (reply.type === "image") {
    const id = await sendImage(phoneNumberId, accessToken, to, reply.url, reply.caption);
    return { sentId: id, savedContent: `[imagem] ${reply.url}${reply.caption ? `\n${reply.caption}` : ""}` };
  }
  // pix: 1) imagem do QR (com legenda completa) 2) copia-e-cola isolado pra app de banco copiar
  if (reply.qrUrl) {
    await sendImage(phoneNumberId, accessToken, to, reply.qrUrl, reply.content);
  } else {
    await sendText(phoneNumberId, accessToken, to, reply.content);
  }
  let lastId: string | null = null;
  if (reply.payload) {
    lastId = await sendText(phoneNumberId, accessToken, to, reply.payload);
  }
  return {
    sentId: lastId,
    savedContent: reply.content + (reply.payload ? `\n\n${reply.payload}` : ""),
  };
}

async function sendText(phoneNumberId: string, accessToken: string, to: string, text: string): Promise<string | null> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text.slice(0, 4000), preview_url: true },
    }),
  });
  if (!res.ok) {
    console.error("WA send text error", res.status, await res.text());
    return null;
  }
  const data: any = await res.json();
  return data?.messages?.[0]?.id ?? null;
}

async function sendImage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  imageUrl: string,
  caption?: string,
): Promise<string | null> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "image",
      image: { link: imageUrl, caption: caption?.slice(0, 1024) },
    }),
  });
  if (!res.ok) {
    // Se a Meta não conseguir baixar a imagem (link inválido), manda só o caption como fallback
    const errTxt = await res.text();
    console.error("WA send image error", res.status, errTxt);
    if (caption) return await sendText(phoneNumberId, accessToken, to, caption);
    return null;
  }
  const data: any = await res.json();
  return data?.messages?.[0]?.id ?? null;
}

function sanitizePhone(p: string | undefined | null): string {
  if (!p) return "";
  const digits = String(p).replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 20 ? digits : "";
}

async function checkRateLimit(botId: string, phone: string): Promise<boolean> {
  const now = new Date();
  const { data } = await supabaseAdmin
    .from("wa_rate_limits")
    .select("count, window_start")
    .eq("bot_id", botId)
    .eq("customer_phone", phone)
    .maybeSingle();

  if (!data) {
    await supabaseAdmin.from("wa_rate_limits").upsert(
      { bot_id: botId, customer_phone: phone, window_start: now.toISOString(), count: 1 },
      { onConflict: "bot_id,customer_phone" },
    );
    return true;
  }

  const windowAge = now.getTime() - new Date(data.window_start).getTime();
  if (windowAge > RATE_LIMIT_WINDOW_MS) {
    await supabaseAdmin
      .from("wa_rate_limits")
      .update({ window_start: now.toISOString(), count: 1 })
      .eq("bot_id", botId)
      .eq("customer_phone", phone);
    return true;
  }
  if (data.count >= RATE_LIMIT_MAX) return false;
  await supabaseAdmin
    .from("wa_rate_limits")
    .update({ count: data.count + 1 })
    .eq("bot_id", botId)
    .eq("customer_phone", phone);
  return true;
}
