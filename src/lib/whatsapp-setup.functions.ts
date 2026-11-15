import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH_VERSION = "v22.0";

const BotInput = z.object({ botId: z.string().uuid() });

type VerifyResult =
  | { ok: true; displayPhoneNumber: string | null; verifiedName: string | null; qualityRating: string | null }
  | { ok: false; reason: string; metaCode?: number; metaSubcode?: number };

/** Traduz erros da Meta para PT-BR. */
function translateMetaError(err: any): { reason: string; metaCode?: number; metaSubcode?: number } {
  const code = err?.code as number | undefined;
  const subcode = err?.error_subcode as number | undefined;
  const message = String(err?.message ?? "Erro desconhecido da Meta");

  if (code === 190) return { reason: "Access Token expirou ou foi revogado. Gere um novo no painel da Meta.", metaCode: code, metaSubcode: subcode };
  if (code === 100 && subcode === 33) return { reason: "Phone Number ID não existe ou não pertence a este app.", metaCode: code, metaSubcode: subcode };
  if (code === 100) return { reason: `Parâmetro inválido: ${message}`, metaCode: code, metaSubcode: subcode };
  if (code === 200 || code === 10) return { reason: "App sem permissão whatsapp_business_messaging. Adicione o produto WhatsApp ao app.", metaCode: code, metaSubcode: subcode };
  if (code === 4 || code === 17 || code === 32) return { reason: "Limite de requisições da Meta atingido. Aguarde 1 minuto.", metaCode: code, metaSubcode: subcode };
  if (code === 368) return { reason: "Conta bloqueada temporariamente pela Meta.", metaCode: code, metaSubcode: subcode };
  return { reason: message, metaCode: code, metaSubcode: subcode };
}

/** Lê credenciais do bot do banco (com auth do user). */
async function loadCred(context: any, botId: string) {
  const { data, error } = await context.supabase
    .from("whatsapp_credentials")
    .select("id, bot_id, phone_number_id, business_account_id, access_token, verify_token, is_connected")
    .eq("bot_id", botId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Credenciais não encontradas. Salve primeiro.");
  return data;
}

/** Passo 2: GET /{phone_number_id} para confirmar token + phone id. */
export const verifyWhatsAppCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BotInput.parse(d))
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    const cred = await loadCred(context, data.botId);
    if (!cred.phone_number_id || !cred.access_token) {
      return { ok: false, reason: "Preencha Phone Number ID e Access Token antes de testar." };
    }
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${cred.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${cred.access_token}` } },
      );
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        const t = translateMetaError(json?.error ?? { message: `HTTP ${res.status}` });
        await context.supabase.from("whatsapp_credentials").update({ is_connected: false }).eq("id", cred.id);
        return { ok: false, ...t };
      }
      await context.supabase
        .from("whatsapp_credentials")
        .update({ display_phone_number: json.display_phone_number ?? null })
        .eq("id", cred.id);
      return {
        ok: true,
        displayPhoneNumber: json.display_phone_number ?? null,
        verifiedName: json.verified_name ?? null,
        qualityRating: json.quality_rating ?? null,
      };
    } catch (e: any) {
      return { ok: false, reason: `Erro de rede ao contatar a Meta: ${e?.message ?? "tente novamente"}` };
    }
  });

/** Passo 3: Self-check do webhook (simula o handshake da Meta). */
export const selfCheckWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ botId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason: string; status?: number }> => {
    const cred = await loadCred(context, data.botId);
    if (!cred.verify_token) return { ok: false, reason: "Verify Token vazio. Salve antes." };
    const challenge = `lov_${Math.random().toString(36).slice(2, 10)}`;
    const url = `${data.origin.replace(/\/$/, "")}/api/public/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(cred.verify_token)}&hub.challenge=${challenge}`;
    try {
      const res = await fetch(url, { method: "GET" });
      const txt = await res.text();
      if (res.status === 200 && txt.trim() === challenge) {
        return { ok: true, reason: "Webhook respondeu corretamente. Pode colar na Meta.", status: 200 };
      }
      if (res.status === 403) return { ok: false, reason: "Verify Token não bate. Confira o token salvo.", status: 403 };
      return { ok: false, reason: `Webhook respondeu ${res.status}. Verifique se o app está publicado.`, status: res.status };
    } catch (e: any) {
      return { ok: false, reason: `Não foi possível alcançar o webhook: ${e?.message ?? "rede falhou"}` };
    }
  });

/** Passo 4: subscribe app à WABA e marca conectado. */
export const subscribeWaba = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BotInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason: string }> => {
    const cred = await loadCred(context, data.botId);
    if (!cred.business_account_id) {
      return { ok: false, reason: "Preencha o WhatsApp Business Account ID no Passo 2." };
    }
    if (!cred.access_token) return { ok: false, reason: "Access Token vazio." };
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${cred.business_account_id}/subscribed_apps`,
        { method: "POST", headers: { Authorization: `Bearer ${cred.access_token}` } },
      );
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        const t = translateMetaError(json?.error ?? { message: `HTTP ${res.status}` });
        return { ok: false, reason: t.reason };
      }
      await context.supabase.from("whatsapp_credentials").update({ is_connected: true }).eq("id", cred.id);
      return { ok: true, reason: "App inscrito no canal 'messages'. Bot pronto para receber mensagens." };
    } catch (e: any) {
      return { ok: false, reason: `Erro de rede: ${e?.message ?? "tente novamente"}` };
    }
  });
