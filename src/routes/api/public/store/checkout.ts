/**
 * Checkout público da mini-loja.
 *
 * POST /api/public/store/checkout  -> cria o pedido e devolve o PIX
 * GET  /api/public/store/checkout?id=<orderId>&code=<code> -> consulta o status
 *
 * Segurança: o corpo NUNCA define preço. Todos os valores vêm do catálogo
 * no banco; a taxa da plataforma é calculada no servidor.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CheckoutSchema = z.object({
  slug: z.string().min(1).max(80),
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().trim().min(8).max(25),
  address: z.string().trim().max(200).optional(),
  note: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
        note: z.string().trim().max(120).optional(),
        option_ids: z.array(z.string().uuid()).max(20).optional(),
      }),
    )
    .min(1)
    .max(30),
});

async function createCheckout(request: Request): Promise<Response> {
  const parsed = CheckoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados do pedido inválidos." }, { status: 400 });
  }
  const body = parsed.data;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: store } = await supabaseAdmin
    .from("whatsapp_settings")
    .select("bot_id, user_id, phone_number, store_title, accept_orders, require_address")
    .eq("store_slug", body.slug)
    .eq("store_enabled", true)
    .maybeSingle();

  if (!store) return Response.json({ error: "Loja não encontrada." }, { status: 404 });
  if (store.accept_orders === false) {
    return Response.json({ error: "A loja está com os pedidos pausados." }, { status: 409 });
  }
  if (store.require_address && (body.address ?? "").trim().length < 5) {
    return Response.json({ error: "Informe o endereço de entrega." }, { status: 400 });
  }

  const ids = [...new Set(body.items.map((i) => i.product_id))];
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, price_cents, track_stock, stock_quantity")
    .eq("bot_id", store.bot_id)
    .eq("is_active", true)
    .in("id", ids);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  // Vitrine da mini-loja: quando existe curadoria, só ela vale (com preço próprio).
  const { data: showcase } = await supabaseAdmin
    .from("store_products")
    .select("product_id, price_override_cents, is_available")
    .eq("bot_id", store.bot_id);
  const showcaseAll = showcase ?? [];
  const showcaseById = new Map(showcaseAll.map((s) => [s.product_id, s]));

  // Opções escolhidas: preço e vínculo sempre vêm do banco.
  const optionIds = [...new Set(body.items.flatMap((i) => i.option_ids ?? []))];
  const optionMap = new Map<string, { id: string; name: string; price_cents: number; product_id: string }>();
  if (optionIds.length > 0) {
    const { data: opts } = await supabaseAdmin
      .from("product_options")
      .select("id, name, price_cents, is_available, group_id, product_option_groups!inner(product_id)")
      .in("id", optionIds)
      .eq("is_available", true);
    for (const o of (opts ?? []) as any[]) {
      optionMap.set(o.id, {
        id: o.id,
        name: o.name,
        price_cents: Number(o.price_cents) || 0,
        product_id: o.product_option_groups?.product_id ?? "",
      });
    }
  }

  const items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    note: string | null;
    options: Array<{ id: string; name: string; price_cents: number }>;
    unit_price_cents: number;
    line_total_cents: number;
  }> = [];

  for (const it of body.items) {
    const p = byId.get(it.product_id);
    if (!p) continue;
    if (showcaseAll.length > 0) {
      const entry = showcaseById.get(p.id);
      if (!entry || entry.is_available === false) continue;
    }
    if (p.track_stock && p.stock_quantity < it.quantity) {
      return Response.json({ error: `Sem estoque suficiente de ${p.name}.` }, { status: 409 });
    }
    const chosen = (it.option_ids ?? [])
      .map((id) => optionMap.get(id))
      .filter((o): o is NonNullable<typeof o> => !!o && o.product_id === p.id)
      .map((o) => ({ id: o.id, name: o.name, price_cents: o.price_cents }));
    const base = showcaseById.get(p.id)?.price_override_cents ?? p.price_cents;
    const unit = base + chosen.reduce((s, o) => s + o.price_cents, 0);
    items.push({
      product_id: p.id,
      name: chosen.length > 0 ? `${p.name} (${chosen.map((o) => o.name).join(", ")})` : p.name,
      quantity: it.quantity,
      note: it.note?.trim() || null,
      options: chosen,
      unit_price_cents: unit,
      line_total_cents: unit * it.quantity,
    });
  }
  if (items.length === 0) {
    return Response.json({ error: "Nenhum produto válido no carrinho." }, { status: 400 });
  }


  const subtotal = items.reduce((s, i) => s + i.line_total_cents, 0);

  const { data: pay } = await supabaseAdmin
    .from("payment_settings")
    .select("provider, is_enabled, pix_key, beneficiary_name, beneficiary_city, mp_access_token, asaas_api_key")
    .eq("bot_id", store.bot_id)
    .maybeSingle();

  const gatewayProvider =
    pay?.provider === "mercadopago" || pay?.provider === "asaas" ? pay.provider : null;
  const hasGatewayCreds =
    gatewayProvider === "mercadopago" ? !!pay?.mp_access_token
    : gatewayProvider === "asaas" ? !!pay?.asaas_api_key
    : false;
  const hasManualPix = !!(pay?.pix_key && pay?.beneficiary_name);
  const canPay = !!pay?.is_enabled && (hasGatewayCreds || hasManualPix);

  const { loadPlatformSettings, createOrderWithFee } = await import("@/server/monetization.server");
  const { computePlatformFee } = await import("@/lib/platform-fee");
  const settings = await loadPlatformSettings();
  const feePercent = canPay ? settings.fee_percent : 0;
  const fee = computePlatformFee(subtotal, feePercent);
  const chargeCents = canPay ? fee.grossCents : subtotal;

  let payload: string | null = null;
  let qrUrl: string | null = null;
  let providerChargeId: string | null = null;
  let usedProvider: string | null = null;

  if (canPay && gatewayProvider && hasGatewayCreds) {
    try {
      const { createGatewayPixCharge } = await import("@/server/pix-gateways.server");
      const charge = await createGatewayPixCharge({
        provider: gatewayProvider,
        credentials: {
          mpAccessToken: pay?.mp_access_token ?? null,
          asaasApiKey: pay?.asaas_api_key ?? null,
        },
        platform: {
          asaasWalletId: settings.platform_asaas_wallet_id,
          mpUserId: settings.platform_mp_user_id,
        },
        grossCents: chargeCents,
        feeCents: fee.feeCents,
        description: `Pedido ${store.store_title ?? "loja"}`.slice(0, 120),
        customerName: body.customer_name,
        customerPhone: body.customer_phone,
      });
      payload = charge.payload ?? null;
      qrUrl = charge.qrUrl ?? null;
      providerChargeId = charge.chargeId ?? null;
      usedProvider = gatewayProvider;
    } catch (e) {
      console.error("[store-checkout] gateway falhou", e);
    }
  }

  if (canPay && !payload && hasManualPix) {
    try {
      const { buildPixPayload } = await import("@/lib/pix");
      payload = buildPixPayload({
        pixKey: pay!.pix_key!,
        merchantName: pay!.beneficiary_name!,
        merchantCity: pay!.beneficiary_city || "BRASIL",
        amountCents: chargeCents,
      });
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=10&data=${encodeURIComponent(payload)}`;
      usedProvider = "manual_pix";
    } catch (e) {
      console.error("[store-checkout] pix manual falhou", e);
    }
  }

  const official = !!payload;

  const { orderId } = await createOrderWithFee({
    userId: store.user_id,
    botId: store.bot_id,
    customerPhone: body.customer_phone,
    customerName: body.customer_name,
    items,
    subtotalCents: subtotal,
    channel: "minisite",
    officialPayment: official,
    provider: usedProvider,
    providerChargeId,
    pixQrCode: qrUrl,
    pixQrCodeText: payload,
  });

  if (!orderId) return Response.json({ error: "Não foi possível criar o pedido." }, { status: 500 });

  const notes = [body.address ? `Entrega: ${body.address}` : null, body.note || null]
    .filter(Boolean)
    .join(" • ");
  if (notes) {
    await supabaseAdmin.from("orders").update({ notes }).eq("id", orderId);
  }

  const { data: created } = await supabaseAdmin
    .from("orders")
    .select("code, total_cents, status")
    .eq("id", orderId)
    .maybeSingle();

  return Response.json({
    order_id: orderId,
    code: created?.code ?? null,
    total_cents: created?.total_cents ?? chargeCents,
    status: created?.status ?? "pending",
    pix: payload
      ? { payload, qr_url: qrUrl, holder: usedProvider === "manual_pix" ? pay?.beneficiary_name ?? null : null }
      : null,
    whatsapp: store.phone_number ? String(store.phone_number).replace(/\D/g, "") : null,
  });
}


async function readStatus(url: URL): Promise<Response> {
  const id = url.searchParams.get("id") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !code) {
    return Response.json({ error: "Consulta inválida." }, { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, code, status, total_cents, bot_id, payment_provider, provider_charge_id, provider_payment_status")
    .eq("id", id)
    .eq("code", code)
    .maybeSingle();

  if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });

  let status = order.status;

  if (
    status === "pending" &&
    order.provider_charge_id &&
    (order.payment_provider === "mercadopago" || order.payment_provider === "asaas")
  ) {
    try {
      const { data: pay } = await supabaseAdmin
        .from("payment_settings")
        .select("mp_access_token, asaas_api_key")
        .eq("bot_id", order.bot_id)
        .maybeSingle();
      const { fetchGatewayPaymentStatus } = await import("@/server/pix-gateways.server");
      const result = await fetchGatewayPaymentStatus({
        provider: order.payment_provider,
        credentials: {
          mpAccessToken: pay?.mp_access_token ?? null,
          asaasApiKey: pay?.asaas_api_key ?? null,
        },
        chargeId: order.provider_charge_id,
      });
      await supabaseAdmin
        .from("orders")
        .update({
          provider_payment_status: result.status,
          last_reconciled_at: new Date().toISOString(),
          ...(result.paid ? { status: "paid" } : {}),
        })
        .eq("id", order.id);
      if (result.paid) {
        status = "paid";
        await supabaseAdmin
          .from("platform_fee_ledger")
          .update({ status: "collected" })
          .eq("order_id", order.id)
          .eq("status", "pending");
      }
    } catch (e) {
      console.error("[store-checkout] status error", e);
    }
  }

  return Response.json({ code: order.code, status, total_cents: order.total_cents });
}

export const Route = createFileRoute("/api/public/store/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await createCheckout(request);
        } catch (e) {
          console.error("[store-checkout] error", e);
          return Response.json({ error: "Erro ao processar o pedido." }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        try {
          return await readStatus(new URL(request.url));
        } catch (e) {
          console.error("[store-checkout] status error", e);
          return Response.json({ error: "Erro ao consultar o pedido." }, { status: 500 });
        }
      },
    },
  },
});
