/**
 * Camada de monetização — só roda no servidor (service role).
 * Toda validação de valores/taxa acontece aqui; o frontend nunca decide a taxa.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_ADS_THRESHOLD,
  DEFAULT_FEE_PERCENT,
  computePlatformFee,
  type FeeBreakdown,
} from "@/lib/platform-fee";

export interface PlatformSettings {
  fee_percent: number;
  ads_threshold: number;
  platform_pix_key: string | null;
  platform_pix_name: string | null;
  platform_pix_city: string | null;
  split_provider: string;
  platform_asaas_wallet_id: string | null;
  platform_mp_user_id: string | null;
}

export async function loadPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select(
      "fee_percent, ads_threshold, platform_pix_key, platform_pix_name, platform_pix_city, split_provider, platform_asaas_wallet_id, platform_mp_user_id",
    )
    .limit(1)
    .maybeSingle();

  if (error) console.error("platform_settings load error", error);

  return {
    fee_percent: Number(data?.fee_percent ?? DEFAULT_FEE_PERCENT),
    ads_threshold: Number(data?.ads_threshold ?? DEFAULT_ADS_THRESHOLD),
    platform_pix_key: data?.platform_pix_key ?? null,
    platform_pix_name: data?.platform_pix_name ?? null,
    platform_pix_city: data?.platform_pix_city ?? null,
    split_provider: data?.split_provider ?? "manual",
    platform_asaas_wallet_id: data?.platform_asaas_wallet_id ?? null,
    platform_mp_user_id: data?.platform_mp_user_id ?? null,
  };
}


/**
 * Registra a taxa no livro-caixa da plataforma (log de todas as transações).
 * `status = pending` até o webhook do provedor confirmar o pagamento.
 */
export async function recordFeeLedger(args: {
  orderId: string | null;
  userId: string;
  botId: string | null;
  breakdown: FeeBreakdown;
  provider: string;
  status?: "pending" | "collected" | "failed" | "waived";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("platform_fee_ledger").insert({
    order_id: args.orderId,
    user_id: args.userId,
    bot_id: args.botId,
    gross_cents: args.breakdown.grossCents,
    fee_cents: args.breakdown.feeCents,
    net_cents: args.breakdown.netCents,
    fee_percent: args.breakdown.feePercent,
    provider: args.provider,
    status: args.status ?? "pending",
    metadata: (args.metadata ?? {}) as never,
  });
  if (error) console.error("fee ledger insert error", error);
}

/**
 * Cria o pedido já com a taxa calculada NO SERVIDOR e registra o log da taxa
 * quando o pagamento passou pelo sistema oficial da plataforma.
 */
export async function createOrderWithFee(args: {
  userId: string;
  botId: string;
  conversationId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  items: unknown[];
  subtotalCents: number;
  channel: string;
  officialPayment: boolean;
  provider?: string | null;
  feePercent?: number;
  /** dados da cobrança quando gerada por gateway com split (MP/Asaas) */
  providerChargeId?: string | null;
  pixQrCode?: string | null;
  pixQrCodeText?: string | null;
  pixExpiresAt?: string | null;
}): Promise<{ orderId: string | null; breakdown: FeeBreakdown }> {
  const settings = await loadPlatformSettings();
  const feePercent = args.officialPayment
    ? (args.feePercent ?? settings.fee_percent)
    : 0;
  const breakdown = computePlatformFee(args.subtotalCents, feePercent);
  const gatewayProvider = args.provider === "mercadopago" || args.provider === "asaas";

  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: args.userId,
      bot_id: args.botId,
      conversation_id: args.conversationId ?? null,
      customer_phone: args.customerPhone ?? null,
      customer_name: args.customerName ?? null,
      items: args.items as never,
      total_cents: args.officialPayment ? breakdown.grossCents : breakdown.netCents,
      status: "pending",
      channel: args.channel,
      official_payment: args.officialPayment,
      fee_percent: breakdown.feePercent,
      platform_fee_cents: breakdown.feeCents,
      net_amount_cents: breakdown.netCents,
      payment_provider: args.officialPayment ? (args.provider ?? "manual_pix") : null,
      provider_charge_id: args.providerChargeId ?? null,
      pix_qr_code: args.pixQrCode ?? null,
      pix_qr_code_text: args.pixQrCodeText ?? null,
      pix_expires_at: args.pixExpiresAt ?? null,
      split_status: gatewayProvider && breakdown.feeCents > 0 ? "automatic" : "manual",
    })
    .select("id")
    .maybeSingle();


  if (error) {
    console.error("order insert error", error);
    return { orderId: null, breakdown };
  }

  if (args.officialPayment && breakdown.feeCents > 0 && args.channel !== "test") {
    await recordFeeLedger({
      orderId: data?.id ?? null,
      userId: args.userId,
      botId: args.botId,
      breakdown,
      provider: args.provider ?? "manual_pix",
      status: "pending",
      metadata: { channel: args.channel, split_provider: settings.split_provider },
    });
  }

  return { orderId: data?.id ?? null, breakdown };
}
