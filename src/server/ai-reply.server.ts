/**
 * Geração de resposta da IA — compartilhado entre o webhook do WhatsApp
 * e o simulador de teste no painel.
 *
 * Retorna uma SEQUÊNCIA de mensagens (texto, imagem ou pix). Assim o bot
 * consegue mostrar fotos do cardápio e enviar a chave PIX automaticamente.
 */

import { buildPixPayload } from "@/lib/pix";
import { chatCompletion, isAiConfigured } from "@/server/ai.server";
import { computePlatformFee } from "@/lib/platform-fee";

import { normalizeImageUrl, isLikelyImageUrl } from "@/lib/image-url";

export type ReplyMessage =
  | { type: "text"; content: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "pix"; content: string; payload?: string; qrUrl?: string };

export interface DetectedOrderItem {
  note?: string | null;
  product_index: number; // 1-based no catálogo
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface DetectedOrder {
  items: DetectedOrderItem[];
  /** subtotal dos produtos, SEM a taxa da plataforma */
  total_cents: number;
  /** true quando o PIX oficial da plataforma foi gerado nesta resposta */
  official_payment: boolean;
  /** dados da cobrança quando gerada por gateway (Mercado Pago / Asaas) */
  payment_provider?: string | null;
  provider_charge_id?: string | null;
  pix_qr_code?: string | null;
  pix_qr_code_text?: string | null;
  pix_expires_at?: string | null;
}



export interface GenerateReplyResult {
  replies: ReplyMessage[];
  order: DetectedOrder | null;
}

export interface GenerateReplyOpts {
  bot: {
    name: string;
    tone: string;
    segment?: string | null;
    away_message?: string | null;
  };
  customerName?: string | null;
  history: { direction: string; content: string }[];
  products: {
    name: string;
    description: string | null;
    price_cents: number;
    image_url?: string | null;
    track_stock?: boolean | null;
    stock_quantity?: number | null;
  }[];
  payment:
    | {
        provider: string;
        pix_key: string | null;
        beneficiary_name: string | null;
        beneficiary_city?: string | null;
        is_enabled: boolean;
        mp_access_token?: string | null;
        asaas_api_key?: string | null;
      }
    | null;
  /** config de split da plataforma (Asaas walletId / Mercado Pago) */
  platformSplit?: { asaasWalletId?: string | null; mpUserId?: string | null } | null;
  flow?: Array<{ type?: string; text?: string; options?: string[]; field?: string; methods?: string[]; delay_hours?: number }> | null;
  menuImageUrl?: string | null;
  menuName?: string | null;
  menuDelivery?: "auto" | "image" | "list" | null;
  /** taxa da plataforma (%) — sempre vem do banco, nunca do frontend */
  feePercent?: number;
  /** telefone do cliente (usado nas cobranças de gateway) */
  customerPhone?: string | null;
}




const TONE_MAP: Record<string, string> = {
  casual: "casual e amigável, com emojis moderados",
  formal: "formal e profissional, sem gírias",
  empolgado: "empolgado, divertido, com bastante energia e emojis",
  direto: "direto e objetivo, sem enrolação",
};

export async function generateReply(opts: GenerateReplyOpts): Promise<GenerateReplyResult> {
  if (!isAiConfigured()) {
    return {
      replies: [{ type: "text", content: "Olá! No momento não consigo responder. Em breve um atendente entra em contato. 🙏" }],
      order: null,
    };
  }

  const toneDesc = TONE_MAP[opts.bot.tone] ?? TONE_MAP.casual;

  // Filtra produtos sem estoque (quando o dono ativou controle de estoque)
  const availableProducts = opts.products.filter(
    (p) => !(p.track_stock === true && (p.stock_quantity ?? 0) <= 0)
  );
  // Reindexa em opts para que show_product use a lista filtrada
  opts.products = availableProducts;

  const catalogStr = availableProducts.length
    ? availableProducts
        .map((p, i) => {
          const price = `R$ ${(p.price_cents / 100).toFixed(2).replace(".", ",")}`;
          const desc = p.description ? ` — ${p.description}` : "";
          const img = p.image_url ? " [tem foto]" : "";
          const stock = p.track_stock ? ` [estoque: ${p.stock_quantity}]` : "";
          return `[#${i + 1}] ${p.name} — ${price}${desc}${img}${stock}`;
        })
        .join("\n")
    : "(catálogo vazio)";

  const pixEnabled = !!(opts.payment?.is_enabled && opts.payment.pix_key);
  const paymentStr = pixEnabled
    ? `Aceita PIX. Chave: ${opts.payment!.pix_key}${opts.payment!.beneficiary_name ? ` (${opts.payment!.beneficiary_name})` : ""}.`
    : opts.payment?.is_enabled
      ? "Aceita PIX (chave gerada na hora)."
      : "Pagamento a combinar.";

  // Funil sugerido pela IA (bot_flows) — usado como roteiro de referência
  const flowStr = Array.isArray(opts.flow) && opts.flow.length > 0
    ? opts.flow
        .slice(0, 20)
        .map((b, i) => {
          const t = (b?.type ?? "message").toString();
          const text = (b?.text ?? "").toString().slice(0, 240);
          const extra = b?.options?.length ? ` [opções: ${b.options.slice(0, 6).join(" | ")}]` : "";
          return `${i + 1}. (${t}) ${text}${extra}`;
        })
        .join("\n")
    : "";

  // ----- System prompt: pedimos JSON estruturado -----
  const systemPrompt = `Você é "${opts.bot.name}", atendente de WhatsApp${opts.bot.segment ? ` do segmento ${opts.bot.segment}` : ""}.
Tom de voz: ${toneDesc}.
Responda SEMPRE em português brasileiro, mensagens curtas (1-3 frases por mensagem), naturais como WhatsApp.
Use o histórico para manter contexto. Nunca invente produto ou preço fora do catálogo.

Catálogo (use o NÚMERO entre [#] para mostrar fotos):
${catalogStr}

Pagamento: ${paymentStr}
${pixEnabled ? "" : "\n⚠️ ATENÇÃO: PIX NÃO está configurado neste bot. NÃO prometa enviar PIX, NÃO diga 'vou gerar o pix', NÃO emita o bloco send_pix. Quando o cliente quiser fechar, pergunte qual forma de pagamento ele prefere (PIX, dinheiro ou cartão na entrega) — vão combinar manualmente.\n"}
FLUXO DE ATENDIMENTO:
- NÃO peça o nome do cliente no início da conversa. Comece direto: cumprimente rapidinho e pergunte o que ele procura, ou já mostre produtos se ele pediu.
- ${opts.customerName ? `Use o nome "${opts.customerName}" nas mensagens.` : "Use o nome do cliente APENAS se ele já tiver dito espontaneamente no histórico. Não invente."}
- SÓ peça nome completo e endereço de entrega quando o cliente confirmar que quer FECHAR o pedido. Peça em UMA mensagem só: "Pra fechar, me passa seu nome completo e o endereço de entrega 🙂".
- ${pixEnabled ? "Só emita send_pix DEPOIS que tiver nome E endereço no histórico." : "NESTE BOT, NUNCA emita send_pix (PIX não está configurado)."}
${flowStr ? `\nROTEIRO DE FUNIL (siga a ordem como guia, adaptando ao que o cliente disser — não recite os textos literalmente):\n${flowStr}\n` : ""}

RESPONDA SEMPRE EM JSON VÁLIDO no formato:
{
  "messages": [
    { "type": "text", "content": "..." },
    { "type": "show_product", "index": 1 },
    { "type": "send_menu_image" },
    { "type": "send_pix", "amount_cents": 4990, "items": [ { "index": 1, "quantity": 2, "note": "sem milho" } ] }
  ]
}

Regras dos blocos:
- "text": mensagem normal de WhatsApp.
- "show_product": envia foto + nome + preço de UM produto específico. Use quando o cliente perguntar sobre um item, quiser ver a foto de algo específico, ou você quer sugerir um destaque. NÃO use em bloco para "mandar o cardápio".
- ${(() => {
    const mode = opts.menuDelivery ?? "auto";
    const hasImg = !!opts.menuImageUrl;
    if (mode === "list") {
      return "\"send_menu_image\": PROIBIDO. O dono do bot escolheu SEMPRE listar os produtos em texto. Quando o cliente pedir cardápio/menu/lista, mande UM \"text\" curto listando nome e preço dos itens (sem show_product em massa e sem send_menu_image).";
    }
    if (mode === "image") {
      return hasImg
        ? "\"send_menu_image\": OBRIGATÓRIO quando o cliente pedir cardápio/menu/lista/opções. O dono escolheu enviar SEMPRE a imagem do cardápio. Mande UMA frase curta de \"text\" (ex: \"Segue nosso cardápio! 📋\") e EM SEGUIDA o send_menu_image. NUNCA liste produtos em texto nem dispare show_product em massa."
        : "\"send_menu_image\": o dono pediu enviar a imagem do cardápio, mas ainda não há imagem gerada. Como fallback, mande um \"text\" curto listando nome e preço (sem show_product em massa).";
    }
    // auto
    return hasImg
      ? "\"send_menu_image\": USE ESTE BLOCO quando o cliente pedir cardápio/menu/lista/opções/o que vocês têm. É UMA imagem só do cardápio visual pronto — muito mais bonito que listar produtos. Mande UMA frase curta de \"text\" (ex: \"Segue nosso cardápio! 📋\") e EM SEGUIDA o send_menu_image. NÃO mande show_product em massa quando existe cardápio."
      : "\"send_menu_image\": NÃO disponível neste bot (nenhum cardápio visual foi gerado). Quando pedirem cardápio, mande um \"text\" curto listando os produtos por nome e preço (sem show_product em massa).";
  })()}

- "send_pix": ${pixEnabled ? "use SOMENTE quando já tiver nome E endereço do cliente no histórico E ele confirmou o pedido. Inclua \"items\" (index, quantity, note opcional) e \"amount_cents\" = soma dos preços × quantidades. Mande UMA frase curta de \"text\" antes (ex: \"Fechado, {nome}! Seu PIX:\") e EM SEGUIDA o send_pix." : "PROIBIDO neste bot — PIX não está configurado."}

REGRAS PROIBIDAS:
- NUNCA escreva "aguarde", "um momento", "já te envio o pix", "vou gerar", "estou processando".
- ${pixEnabled ? "Se já prometeu PIX no histórico, emita send_pix agora (com nome+endereço coletados)." : "Se prometeu PIX antes por engano, peça desculpa e diga que vai combinar a forma de pagamento por aqui."}
- Não use markdown (sem ** ou #).
- Sequência total: no máximo 8 blocos.

Devolva SOMENTE o JSON, sem texto extra ao redor.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...opts.history.map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  let raw = "";
  try {
    raw = await chatCompletion({ messages, json: true });
  } catch (e) {
    console.error("AI error", e);
    return {
      replies: [{ type: "text", content: opts.bot.away_message ?? "Recebi sua mensagem! Em breve te respondo." }],
      order: null,
    };
  }

  return await parseAndExpand(raw, opts);
}

/* ----------------- helpers ----------------- */

async function parseAndExpand(raw: string, opts: GenerateReplyOpts): Promise<GenerateReplyResult> {
  // limpa possíveis cercas markdown
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/g, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // fallback: trata tudo como texto
    return {
      replies: cleaned ? [{ type: "text", content: cleaned }] : [],
      order: null,
    };
  }

  const blocks = Array.isArray(parsed?.messages) ? parsed.messages : [];
  const out: ReplyMessage[] = [];
  let detectedOrder: DetectedOrder | null = null;

  for (const b of blocks.slice(0, 8)) {
    if (!b || typeof b !== "object") continue;

    if (b.type === "text" && typeof b.content === "string") {
      const t = b.content.trim().slice(0, 1000);
      if (t) out.push({ type: "text", content: t });
      continue;
    }

    if (b.type === "show_product") {
      const idx = Number(b.index) - 1;
      const p = opts.products[idx];
      if (!p) continue;
      const price = `R$ ${(p.price_cents / 100).toFixed(2).replace(".", ",")}`;
      const caption = `*${p.name}* — ${price}${p.description ? `\n${p.description}` : ""}`;
      const url = normalizeImageUrl(p.image_url ?? "");
      if (url && isLikelyImageUrl(url)) {
        out.push({ type: "image", url, caption });
      } else {
        out.push({ type: "text", content: caption });
      }
      continue;
    }

    if (b.type === "send_menu_image") {
      if ((opts.menuDelivery ?? "auto") === "list") continue;
      const url = opts.menuImageUrl ? normalizeImageUrl(opts.menuImageUrl) : "";
      if (url && isLikelyImageUrl(url)) {
        out.push({ type: "image", url });
      }
      continue;
    }


    if (b.type === "send_pix") {
      // Extrai itens do pedido (se houver) usando preços REAIS do catálogo
      const items: DetectedOrderItem[] = [];
      const rawItems = Array.isArray(b.items) ? b.items : [];
      for (const ri of rawItems.slice(0, 20)) {
        const idx = Number(ri?.index) - 1;
        const qty = Math.max(1, Math.min(99, Number(ri?.quantity) || 1));
        const note = typeof ri?.note === "string" ? ri.note.trim().slice(0, 120) || null : null;
        const p = opts.products[idx];
        if (!p) continue;
        items.push({
          product_index: idx + 1,
          name: p.name,
          quantity: qty,
          note,
          unit_price_cents: p.price_cents,
          line_total_cents: p.price_cents * qty,
        });
      }
      const computedTotal = items.reduce((s, it) => s + it.line_total_cents, 0);
      const aiAmount = Number(b.amount_cents) > 0 ? Number(b.amount_cents) : 0;
      const amount = computedTotal > 0 ? computedTotal : aiAmount > 0 ? aiAmount : undefined;

      if (items.length > 0 && amount) {
        detectedOrder = { items, total_cents: amount, official_payment: false };
      }

      const pix = opts.payment;
      const gatewayProvider =
        pix?.provider === "mercadopago" || pix?.provider === "asaas" ? pix.provider : null;
      const hasGatewayCreds =
        gatewayProvider === "mercadopago"
          ? !!pix?.mp_access_token
          : gatewayProvider === "asaas"
            ? !!pix?.asaas_api_key
            : false;

      if (!pix?.is_enabled || (!pix.pix_key && !hasGatewayCreds)) {
        out.push({ type: "text", content: "Como prefere pagar? PIX, dinheiro ou cartão na entrega? 💳" });
        continue;
      }

      // Taxa da plataforma: calculada aqui (servidor), somada ao valor cobrado.
      const fee = computePlatformFee(amount ?? 0, opts.feePercent ?? 0);
      const chargeCents = amount ? fee.grossCents : undefined;

      let payload: string | undefined;
      let qrUrl: string | undefined;
      let gatewayCharge: Awaited<ReturnType<typeof import("@/server/pix-gateways.server").createGatewayPixCharge>> | null =
        null;

      // 1) Cobrança dinâmica com split automático (Mercado Pago / Asaas)
      if (gatewayProvider && hasGatewayCreds && chargeCents) {
        try {
          const { createGatewayPixCharge } = await import("@/server/pix-gateways.server");
          gatewayCharge = await createGatewayPixCharge({
            provider: gatewayProvider,
            credentials: {
              mpAccessToken: pix.mp_access_token ?? null,
              asaasApiKey: pix.asaas_api_key ?? null,
            },
            platform: {
              asaasWalletId: opts.platformSplit?.asaasWalletId ?? null,
              mpUserId: opts.platformSplit?.mpUserId ?? null,
            },
            grossCents: chargeCents,
            feeCents: fee.feeCents,
            description: `Pedido ${opts.bot.name}`.slice(0, 120),
            customerName: opts.customerName ?? null,
            customerPhone: opts.customerPhone ?? null,
          });
          payload = gatewayCharge.payload;
          qrUrl = gatewayCharge.qrUrl;
        } catch (e) {
          console.error("[pix] gateway falhou, usando PIX manual", e);
        }
      }

      // 2) Fallback: PIX manual (chave do lojista)
      if (!payload && pix.pix_key && pix.beneficiary_name) {
        try {
          payload = buildPixPayload({
            pixKey: pix.pix_key,
            merchantName: pix.beneficiary_name,
            merchantCity: pix.beneficiary_city || "BRASIL",
            amountCents: chargeCents,
          });
          qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=10&data=${encodeURIComponent(payload)}`;
        } catch (e) {
          console.error("pix payload error", e);
        }
      }

      if (!payload) {
        out.push({ type: "text", content: "Como prefere pagar? PIX, dinheiro ou cartão na entrega? 💳" });
        continue;
      }

      const lines: string[] = [];
      lines.push("✅ Aqui está o PIX:");
      if (items.length > 0) {
        lines.push("");
        lines.push("📦 *Resumo do pedido*");
        for (const it of items) {
          const lineNote = it.note ? ` _(${it.note})_` : "";
          lines.push(`• ${it.quantity}x ${it.name}${lineNote}`);
        }
        lines.push("");
      }
      if (amount) {
        // A taxa da plataforma está embutida no total e NÃO é exibida ao cliente.
        lines.push(`💰 *Total a pagar: R$ ${((chargeCents ?? amount) / 100).toFixed(2).replace(".", ",")}*`);
      }

      if (gatewayCharge) {
        lines.push("");
        lines.push("📲 Escaneie o QR ou use o código copia e cola abaixo. A confirmação é automática ✅");
      } else {
        lines.push(`🔑 Chave: ${pix.pix_key}`);
        if (pix.beneficiary_name) lines.push(`👤 Em nome de: ${pix.beneficiary_name}`);
        lines.push("");
        lines.push("📲 Escaneie o QR ou use o código copia e cola abaixo. Depois é só mandar o comprovante por aqui 🙏");
      }

      // O pedido só conta como "pagamento oficial" se o QR/copia-e-cola foi gerado.
      if (detectedOrder) {
        detectedOrder.official_payment = true;
        detectedOrder.payment_provider = gatewayCharge ? gatewayCharge.provider : "manual_pix";
        detectedOrder.provider_charge_id = gatewayCharge?.chargeId ?? null;
        detectedOrder.pix_qr_code = qrUrl ?? null;
        detectedOrder.pix_qr_code_text = payload ?? null;
        detectedOrder.pix_expires_at = gatewayCharge?.expiresAt ?? null;
      }

      out.push({ type: "pix", content: lines.join("\n"), payload, qrUrl });
      continue;


    }
  }

  if (out.length === 0) {
    return {
      replies: [{ type: "text", content: opts.bot.away_message ?? "Recebi sua mensagem! Em breve te respondo." }],
      order: detectedOrder,
    };
  }
  return { replies: out, order: detectedOrder };
}
