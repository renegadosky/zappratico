import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiError, chatCompletion, isAiConfigured } from "@/server/ai.server";

const InputSchema = z.object({
  description: z.string().min(1).max(4000),
  segment: z.string().max(200).optional().default(""),
  audience: z.string().max(500).optional().default(""),
  goal: z.string().max(200).optional().default("vendas"),
  tone_preference: z.string().max(200).optional().default(""),
  ticket: z.string().max(200).optional().default(""),
});

/** Gera um bot de vendas completo (persona, fluxo, produtos...) via IA. */
export const generateBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { description, segment, audience, goal, tone_preference, ticket } = data;
    if (!isAiConfigured()) throw new Error("IA não configurada (defina AI_API_KEY no servidor).");

    const systemPrompt = `Você é uma estrategista sênior de bots de vendas no WhatsApp para pequenos e médios negócios brasileiros.
Sua tarefa é projetar um bot COMPLETO, PROFISSIONAL e PRONTO PARA USO — não um esqueleto genérico.

Princípios obrigatórios:
1. PERSONA com nome próprio, voz consistente e papel claro (ex: "Lia, consultora de estilo").
2. COPYWRITING persuasivo: gatilhos (escassez, prova social, autoridade, reciprocidade) usados com bom senso.
3. ESTRUTURA de funil: abertura → qualificação → apresentação de valor → catálogo → quebra de objeção → fechamento → pós-venda.
4. PORTUGUÊS BRASILEIRO natural, com emojis pontuais (1–2 por mensagem, nunca demais).
5. NUNCA pedir nome ou endereço logo de cara. Só na hora de fechar o pedido.
6. Tom adequado ao segmento (luxo ≠ delivery ≠ infoproduto).
7. Quebras de objeção específicas do nicho (preço, prazo, confiança, dúvida técnica).
8. CTAs claros em todo bloco de venda.

Tipos de bloco permitidos no flow:
- message: { type, text }
- menu: { type, text, options[] }
- question: { type, text, field }   // field em snake_case
- catalog: { type, text }
- address: { type, text }
- payment: { type, text, methods[] }
- upsell: { type, text }
- cross_sell: { type, text }
- objection: { type, text }         // resposta pronta a objeção comum
- social_proof: { type, text }      // depoimento/case
- urgency: { type, text }           // escassez/tempo limitado
- human_handoff: { type, text }
- post_sale: { type, text }
- followup: { type, text, delay_hours }  // mensagem de recuperação

Use 10 a 14 blocos. Cada texto deve parecer escrito por um humano vendedor experiente do nicho.`;

    const userPrompt = `Segmento: ${segment || "geral"}
Público-alvo: ${audience || "não especificado"}
Objetivo principal: ${goal}
Tom desejado: ${tone_preference || "decidir conforme o segmento"}
Ticket médio: ${ticket || "não informado"}

Descrição do negócio:
${description}

Gere:
- nome do bot (com personalidade)
- tagline curta
- tom de voz
- persona (1 frase descrevendo quem é o bot)
- 3 a 5 propostas de valor curtas (value_props)
- 3 ganchos de abertura distintos (opening_hooks) — frases para iniciar conversa
- 3 a 5 objeções comuns com resposta pronta (objection_handlers)
- fluxo completo de 10 a 14 blocos (flow)
- 3 a 5 sugestões de produtos com nome, descrição curta e preço em reais (suggested_products)
- 3 mensagens promocionais prontas (promotional_messages)
- 3 KPIs que o lojista deve acompanhar (kpis)`;

    let raw = "";
    try {
      raw = await chatCompletion({
        json: true,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              userPrompt +
              `\n\nResponda SOMENTE com JSON válido (sem markdown, sem texto extra) no formato exato:\n{\n  "bot_name": "string",\n  "tagline": "string",\n  "persona": "string",\n  "tone": "formal|casual|engraçado|vendedor|premium|neutro|consultivo|amigável",\n  "value_props": ["3 a 5 strings"],\n  "opening_hooks": ["exatamente 3 strings"],\n  "objection_handlers": [{"objection":"string","response":"string"}],\n  "flow": [{"type":"string","text":"string","options":["opcional"],"field":"opcional","methods":["opcional"],"delay_hours":0}],\n  "suggested_products": [{"name":"string","description":"string","price_brl":0}],\n  "promotional_messages": ["exatamente 3 strings"],\n  "kpis": ["exatamente 3 strings"]\n}`,
          },
        ],
      });
    } catch (e) {
      if (e instanceof AiError) throw new Error(e.message);
      throw e;
    }
    if (!raw) throw new Error("Nenhuma resposta da IA");

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/g, "")
      .trim();

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const start = cleaned.search(/[\{\[]/);
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Resposta da IA não é JSON válido");
      result = JSON.parse(cleaned.substring(start, end + 1));
    }

    return result as Record<string, unknown>;
  });
