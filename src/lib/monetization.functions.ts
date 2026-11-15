import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_ADS_THRESHOLD, DEFAULT_FEE_PERCENT, MAX_FEE_PERCENT } from "@/lib/platform-fee";

export interface MyMonetization {
  feePercent: number;
  adsThreshold: number;
  adsEnabled: boolean;
  unofficialStreak: number;
  officialOrders: number;
  unofficialOrders: number;
  totalOrders: number;
  feePaidCents: number;
}

/** Status de monetização do lojista logado (dados reais, sem mock). */
export const getMyMonetization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyMonetization> => {
    const { supabase, userId } = context;
    const { loadPlatformSettings } = await import("@/server/monetization.server");

    const [platform, profile, official, unofficial, ledger] = await Promise.all([
      loadPlatformSettings(),
      supabase
        .from("profiles")
        .select("ads_enabled, unofficial_streak")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .neq("channel", "test")
        .eq("official_payment", true),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .neq("channel", "test")
        .eq("official_payment", false),
      supabase.from("platform_fee_ledger").select("fee_cents").eq("user_id", userId),
    ]);

    const officialCount = official.count ?? 0;
    const unofficialCount = unofficial.count ?? 0;

    return {
      feePercent: Number(platform.fee_percent ?? DEFAULT_FEE_PERCENT),
      adsThreshold: Number(platform.ads_threshold ?? DEFAULT_ADS_THRESHOLD),
      adsEnabled: Boolean(profile.data?.ads_enabled),
      unofficialStreak: Number(profile.data?.unofficial_streak ?? 0),
      officialOrders: officialCount,
      unofficialOrders: unofficialCount,
      totalOrders: officialCount + unofficialCount,
      feePaidCents: (ledger.data ?? []).reduce((s, r) => s + Number(r.fee_cents ?? 0), 0),
    };
  });

export interface AdminMonetization {
  isAdmin: boolean;
  feePercent: number;
  adsThreshold: number;
  platformPixKey: string | null;
  platformPixName: string | null;
  platformPixCity: string | null;
  splitProvider: string;
  platformAsaasWalletId: string | null;
  platformMpUserId: string | null;
  totalOrders: number;
  officialOrders: number;
  unofficialOrders: number;
  feeCollectedCents: number;
  feePendingCents: number;
  storesOnAds: number;
  recent: {
    id: string;
    created_at: string;
    gross_cents: number;
    fee_cents: number;
    status: string;
    provider: string;
  }[];
}

/** Painel administrativo — só para quem tem o cargo de admin. */
export const getAdminMonetization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMonetization> => {
    const { supabase, userId } = context;
    const { data: adminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = Boolean(adminRow);


    const empty: AdminMonetization = {
      isAdmin: false,
      feePercent: DEFAULT_FEE_PERCENT,
      adsThreshold: DEFAULT_ADS_THRESHOLD,
      platformPixKey: null,
      platformPixName: null,
      platformPixCity: null,
      splitProvider: "manual",
      platformAsaasWalletId: null,
      platformMpUserId: null,
      totalOrders: 0,
      officialOrders: 0,
      unofficialOrders: 0,
      feeCollectedCents: 0,
      feePendingCents: 0,
      storesOnAds: 0,
      recent: [],
    };
    if (!isAdmin) return empty;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [settings, total, official, unofficial, ledger, ads, recent] = await Promise.all([
      supabaseAdmin
        .from("platform_settings")
        .select(
          "fee_percent, ads_threshold, platform_pix_key, platform_pix_name, platform_pix_city, split_provider, platform_asaas_wallet_id, platform_mp_user_id",
        )
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).neq("channel", "test"),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .neq("channel", "test")
        .eq("official_payment", true),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .neq("channel", "test")
        .eq("official_payment", false),
      supabaseAdmin.from("platform_fee_ledger").select("fee_cents, status"),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("ads_enabled", true),
      supabaseAdmin
        .from("platform_fee_ledger")
        .select("id, created_at, gross_cents, fee_cents, status, provider")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const rows = ledger.data ?? [];
    return {
      isAdmin: true,
      feePercent: Number(settings.data?.fee_percent ?? DEFAULT_FEE_PERCENT),
      adsThreshold: Number(settings.data?.ads_threshold ?? DEFAULT_ADS_THRESHOLD),
      platformPixKey: settings.data?.platform_pix_key ?? null,
      platformPixName: settings.data?.platform_pix_name ?? null,
      platformPixCity: settings.data?.platform_pix_city ?? null,
      splitProvider: settings.data?.split_provider ?? "manual",
      platformAsaasWalletId: settings.data?.platform_asaas_wallet_id ?? null,
      platformMpUserId: settings.data?.platform_mp_user_id ?? null,
      totalOrders: total.count ?? 0,
      officialOrders: official.count ?? 0,
      unofficialOrders: unofficial.count ?? 0,
      feeCollectedCents: rows
        .filter((r) => r.status === "collected")
        .reduce((s, r) => s + Number(r.fee_cents ?? 0), 0),
      feePendingCents: rows
        .filter((r) => r.status === "pending")
        .reduce((s, r) => s + Number(r.fee_cents ?? 0), 0),
      storesOnAds: ads.count ?? 0,
      recent: (recent.data ?? []) as AdminMonetization["recent"],
    };
  });

const SettingsSchema = z.object({
  feePercent: z.number().min(0).max(MAX_FEE_PERCENT),
  adsThreshold: z.number().int().min(1).max(1000),
  platformPixKey: z.string().trim().max(140).optional().nullable(),
  platformPixName: z.string().trim().max(60).optional().nullable(),
  platformPixCity: z.string().trim().max(60).optional().nullable(),
  splitProvider: z.enum(["manual", "mercadopago", "asaas", "efi", "pagarme"]),
  platformAsaasWalletId: z.string().trim().max(80).optional().nullable(),
  platformMpUserId: z.string().trim().max(40).optional().nullable(),
});

/** Atualiza a taxa/limite de anúncios — validado no servidor e restrito a admins. */
export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: adminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Apenas administradores da plataforma podem alterar a taxa.");

    const { error } = await supabase
      .from("platform_settings")
      .update({
        fee_percent: data.feePercent,
        ads_threshold: data.adsThreshold,
        platform_pix_key: data.platformPixKey || null,
        platform_pix_name: data.platformPixName || null,
        platform_pix_city: data.platformPixCity || null,
        split_provider: data.splitProvider,
        platform_asaas_wallet_id: data.platformAsaasWalletId || null,
        platform_mp_user_id: data.platformMpUserId || null,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
