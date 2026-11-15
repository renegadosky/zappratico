import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AiError, chatCompletion, isAiConfigured } from "@/server/ai.server";

const InputSchema = z.object({
  tone: z.enum(["formal", "casual", "descontraido"]),
  messages: z.record(z.string().min(1).max(100), z.string().max(500)),
});

export const rewriteMessages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    if (!isAiConfigured()) throw new Error("IA não configurada (defina AI_API_KEY no servidor).");

    const toneInstruction = {
      formal: "tom formal, profissional, vocativo respeitoso (senhor/senhora). Sem gírias, sem emojis.",
      casual: "tom casual e amigável, voz próxima do cliente. Pode usar 1 emoji por mensagem.",
      descontraido: "tom super descontraído, divertido, próximo. 1–2 emojis por mensagem, expressões brasileiras leves.",
    }[data.tone];

    const sys = `Você reescreve mensagens de atendimento de bot do WhatsApp para o tom solicitado. 
Mantenha o mesmo significado/intenção de cada mensagem. 
Responda APENAS um JSON com as mesmas chaves recebidas e valores reescritos. Nada além do JSON.
Português brasileiro. ${toneInstruction}`;

    const userPrompt = `Mensagens originais:\n${JSON.stringify(data.messages, null, 2)}\n\nReescreva no tom solicitado.`;

    let content = "{}";
    try {
      content =
        (await chatCompletion({
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userPrompt },
          ],
          json: true,
        })) || "{}";
    } catch (e) {
      if (e instanceof AiError) throw new Error(e.message);
      throw e;
    }
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("IA retornou formato inválido. Tente novamente.");
    }
    // Manter apenas chaves originais
    const out: Record<string, string> = {};
    for (const k of Object.keys(data.messages)) {
      if (typeof parsed[k] === "string" && parsed[k].trim()) out[k] = parsed[k].trim();
      else out[k] = data.messages[k];
    }
    return out;
  });
