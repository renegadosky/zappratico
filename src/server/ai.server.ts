/**
 * Cliente de IA compatível com a API "OpenAI Chat Completions".
 *
 * Funciona com qualquer provedor compatível — basta configurar 3 variáveis:
 *   AI_API_KEY   chave do provedor
 *   AI_BASE_URL  (opcional) padrão: Google Gemini (tem plano gratuito)
 *   AI_MODEL     (opcional) padrão: gemini-2.5-flash
 *
 * Exemplos de AI_BASE_URL:
 *   Gemini     https://generativelanguage.googleapis.com/v1beta/openai
 *   OpenAI     https://api.openai.com/v1
 *   Groq       https://api.groq.com/openai/v1
 *   OpenRouter https://openrouter.ai/api/v1
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function isAiConfigured(): boolean {
  return !!process.env.AI_API_KEY;
}

export async function chatCompletion(opts: {
  messages: ChatMessage[];
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new AiError("IA não configurada (defina AI_API_KEY).", 503);

  const baseUrl = (
    process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai"
  ).replace(/\/+$/, "");
  const model = process.env.AI_MODEL || "gemini-2.5-flash";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts.json && { response_format: { type: "json_object" } }),
    }),
  });

  if (res.status === 429) throw new AiError("Limite de requisições da IA atingido. Aguarde um momento.", 429);
  if (res.status === 402) throw new AiError("Créditos de IA esgotados no provedor.", 402);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[ai] provider error", res.status, body.slice(0, 500));
    throw new AiError("Falha ao consultar o provedor de IA.", res.status);
  }

  const json: any = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() ?? "";
}
