import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateReply, type ReplyMessage } from "@/server/ai-reply.server";

const InputSchema = z.object({
  botId: z.string().uuid(),
  customerName: z.string().max(100).optional().nullable(),
  history: z
    .array(z.object({
      direction: z.enum(["inbound", "outbound"]),
      content: z.string().max(2000),
    }))
    .max(40)
    .default([]),
});

export const testChatReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ replies: ReplyMessage[] }> => {
    try {
      const userId = context.userId;

      const { data: bot, error } = await supabaseAdmin
        .from("bots")
        .select("id, name, tone, segment, away_message, user_id, is_active, menu_delivery")
        .eq("id", data.botId)
        .maybeSingle();

      if (error || !bot) {
        return { replies: [{ type: "text", content: "⚠️ Bot não encontrado." }] };
      }
      if (bot.user_id !== userId) {
        return { replies: [{ type: "text", content: "⚠️ Sem permissão para testar este bot." }] };
      }

      const [{ data: products }, { data: payment }, { data: flowRow }, { data: menuRow }] = await Promise.all([
        supabaseAdmin
          .from("products")
          .select("name, description, price_cents, image_url, track_stock, stock_quantity")
          .eq("bot_id", data.botId)
          .eq("is_active", true)
          .order("sort_order")
          .limit(30),
        supabaseAdmin
          .from("payment_settings")
          .select("provider, pix_key, beneficiary_name, beneficiary_city, is_enabled")
          .eq("bot_id", data.botId)
          .maybeSingle(),
        supabaseAdmin
          .from("bot_flows")
          .select("blocks")
          .eq("bot_id", data.botId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("menus")
          .select("name, cover_image_url")
          .eq("bot_id", data.botId)
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
        customerName: data.customerName ?? null,
        history: data.history,
        products: products ?? [],
        // Modo de teste: usa o PIX configurado para simular o fluxo real (QR + copia-e-cola).
        payment: payment ?? null,
        flow: Array.isArray(flowRow?.blocks) ? (flowRow!.blocks as any[]) : null,
        menuImageUrl: (menuRow as { cover_image_url?: string | null } | null)?.cover_image_url ?? null,
        menuName: (menuRow as { name?: string | null } | null)?.name ?? null,
        menuDelivery: ((bot as any)?.menu_delivery ?? "auto") as "auto" | "image" | "list",
        feePercent: platform.fee_percent,
      });


      if (order && order.items.length > 0) {
        await createOrderWithFee({
          userId,
          botId: data.botId,
          customerName: data.customerName ?? "Cliente de teste",
          items: order.items,
          subtotalCents: order.total_cents,
          channel: "test",
          officialPayment: order.official_payment,
          provider: payment?.provider ?? "manual_pix",
        });
      }


      return { replies };
    } catch (e) {
      console.error("testChatReply runtime error", e);
      const msg = e instanceof Error ? e.message : "Erro inesperado ao gerar resposta";
      return { replies: [{ type: "text", content: `⚠️ ${msg}` }] };
    }
  });
