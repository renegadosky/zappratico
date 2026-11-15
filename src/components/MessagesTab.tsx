import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { setCached } from "@/lib/data-cache";
import { rewriteMessages } from "@/lib/ai-tone.functions";

interface Bot {
  id: string; name: string; bot_type: string; segment: string | null;
  tone: string; is_active: boolean;
  greeting_morning: string | null; greeting_afternoon: string | null;
  greeting_evening: string | null; away_message: string | null;
}

interface ExtraSettings {
  id?: string;
  bot_id: string;
  user_id: string;
  welcome_first_contact: string | null;
  fallback_message: string | null;
  order_confirmation: string | null;
  post_sale_thanks: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const VARIABLES = [
  { key: "{nome}", label: "Nome do cliente" },
  { key: "{loja}", label: "Nome da loja" },
  { key: "{produto}", label: "Produto" },
  { key: "{preco}", label: "Preço" },
  { key: "{pedido}", label: "Número do pedido" },
];

const FIELDS: { key: keyof FormState; label: string; help: string; rows: number }[] = [
  { key: "welcome_first_contact", label: "Boas-vindas (primeiro contato)", help: "Primeira mensagem para quem nunca falou com o bot.", rows: 2 },
  { key: "greeting_morning", label: "Saudação manhã (5h–12h)", help: "Quando o cliente manda \"oi\" pela manhã.", rows: 2 },
  { key: "greeting_afternoon", label: "Saudação tarde (12h–18h)", help: "Quando o cliente manda \"oi\" à tarde.", rows: 2 },
  { key: "greeting_evening", label: "Saudação noite (18h–5h)", help: "Quando o cliente manda \"oi\" à noite.", rows: 2 },
  { key: "fallback_message", label: "Não entendi", help: "Quando o bot não reconhece o que o cliente disse.", rows: 2 },
  { key: "order_confirmation", label: "Pedido recebido", help: "Confirmação enviada quando o pedido é fechado.", rows: 2 },
  { key: "post_sale_thanks", label: "Agradecimento pós-venda", help: "Mensagem enviada após o pagamento confirmado.", rows: 2 },
  { key: "away_message", label: "Fora de horário", help: "Para quando o atendimento estiver pausado.", rows: 2 },
];

interface FormState {
  name: string;
  tone: string;
  is_active: boolean;
  welcome_first_contact: string;
  greeting_morning: string;
  greeting_afternoon: string;
  greeting_evening: string;
  fallback_message: string;
  order_confirmation: string;
  post_sale_thanks: string;
  away_message: string;
}

const DEFAULTS: Omit<FormState, "name" | "tone" | "is_active"> = {
  welcome_first_contact: "Olá! 👋 Seja bem-vindo(a). Como posso te ajudar hoje?",
  greeting_morning: "Bom dia! 👋 Como posso ajudar?",
  greeting_afternoon: "Boa tarde! 👋 Como posso ajudar?",
  greeting_evening: "Boa noite! 👋 Como posso ajudar?",
  fallback_message: "Desculpe, não entendi. Pode reformular ou digitar *menu* para ver as opções? 🙂",
  order_confirmation: "Pedido recebido! ✅ Em instantes te envio os detalhes do pagamento.",
  post_sale_thanks: "Obrigado pela compra! 💚 Qualquer dúvida estamos por aqui.",
  away_message: "No momento estamos fora do horário de atendimento. Retornaremos em breve!",
};

export function MessagesTab({ bot, userId, onChange }: { bot: Bot; userId: string; onChange: (b: Bot) => void }) {
  const rewriteFn = useServerFn(rewriteMessages);
  const [extras, setExtras] = useState<ExtraSettings | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [form, setForm] = useState<FormState>({
    name: bot.name,
    tone: bot.tone,
    is_active: bot.is_active,
    welcome_first_contact: DEFAULTS.welcome_first_contact,
    greeting_morning: bot.greeting_morning ?? DEFAULTS.greeting_morning,
    greeting_afternoon: bot.greeting_afternoon ?? DEFAULTS.greeting_afternoon,
    greeting_evening: bot.greeting_evening ?? DEFAULTS.greeting_evening,
    fallback_message: DEFAULTS.fallback_message,
    order_confirmation: DEFAULTS.order_confirmation,
    post_sale_thanks: DEFAULTS.post_sale_thanks,
    away_message: bot.away_message ?? DEFAULTS.away_message,
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<keyof FormState | null>(null);
  const refs = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({});
  const firstLoad = useRef(true);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_settings")
        .select("id, bot_id, user_id, welcome_first_contact, fallback_message, order_confirmation, post_sale_thanks")
        .eq("bot_id", bot.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setExtras(data as ExtraSettings);
        setForm((f) => ({
          ...f,
          welcome_first_contact: (data as ExtraSettings).welcome_first_contact ?? f.welcome_first_contact,
          fallback_message: (data as ExtraSettings).fallback_message ?? f.fallback_message,
          order_confirmation: (data as ExtraSettings).order_confirmation ?? f.order_confirmation,
          post_sale_thanks: (data as ExtraSettings).post_sale_thanks ?? f.post_sale_thanks,
        }));
      }
      setLoadingExtras(false);
      firstLoad.current = false;
    })();
    return () => { cancelled = true; };
  }, [bot.id]);

  // Auto-save com debounce
  useEffect(() => {
    if (firstLoad.current || loadingExtras) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = window.setTimeout(() => { void doSave(); }, 800);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, loadingExtras]);

  const doSave = async () => {
    const botPatch = {
      name: form.name,
      tone: form.tone,
      is_active: form.is_active,
      greeting_morning: form.greeting_morning,
      greeting_afternoon: form.greeting_afternoon,
      greeting_evening: form.greeting_evening,
      away_message: form.away_message,
    };
    const extrasPayload = {
      bot_id: bot.id,
      user_id: userId,
      welcome_first_contact: form.welcome_first_contact,
      fallback_message: form.fallback_message,
      order_confirmation: form.order_confirmation,
      post_sale_thanks: form.post_sale_thanks,
    };

    const [botRes, extrasRes] = await Promise.all([
      supabase.from("bots").update(botPatch).eq("id", bot.id),
      supabase
        .from("whatsapp_settings")
        .upsert(extrasPayload, { onConflict: "bot_id" })
        .select()
        .maybeSingle(),
    ]);

    if (botRes.error || extrasRes.error) {
      setSaveState("error");
      return;
    }
    setSaveState("saved");
    setSavedAt(new Date());
    const next = { ...bot, ...botPatch };
    onChange(next);
    setCached(`bot:${bot.id}`, next);
    if (extrasRes.data) setExtras(extrasRes.data as ExtraSettings);
  };

  const insertVariable = (field: keyof FormState, variable: string) => {
    const el = refs.current[field];
    if (!el) {
      setForm((f) => ({ ...f, [field]: (f[field] as string) + variable }));
      return;
    }
    const start = el.selectionStart ?? (el.value?.length ?? 0);
    const end = el.selectionEnd ?? start;
    const value = (form[field] as string) ?? "";
    const next = value.slice(0, start) + variable + value.slice(end);
    setForm((f) => ({ ...f, [field]: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + variable.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleRewrite = async (tone: "formal" | "casual" | "descontraido") => {
    setRewriting(tone);
    try {
      const messages: Record<string, string> = {};
      for (const f of FIELDS) messages[f.key] = (form[f.key] as string) || "";
      const result = await rewriteFn({ data: { tone, messages } });
      setForm((f) => ({ ...f, ...result }));
      toast.success("Mensagens reescritas no novo tom");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao reescrever");
    } finally {
      setRewriting(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="bg-surface border border-border rounded-2xl p-5 md:p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do bot</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tom de voz</Label>
            <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual e amigável</SelectItem>
                <SelectItem value="formal">Formal e profissional</SelectItem>
                <SelectItem value="empolgado">Empolgado e divertido</SelectItem>
                <SelectItem value="direto">Direto e objetivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
          <div>
            <Label>Bot ativo</Label>
            <p className="text-xs text-muted-foreground">Quando desativado, o bot não responde mensagens</p>
          </div>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        </div>

        {/* Reescrita por IA */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 md:p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Wand2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Reescrever tudo num só clique</div>
              <p className="text-xs text-muted-foreground mb-2">A IA reescreve todas as mensagens abaixo no tom escolhido, mantendo o sentido.</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" disabled={rewriting !== null} onClick={() => handleRewrite("formal")}>
                  {rewriting === "formal" ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />} Formal
                </Button>
                <Button size="sm" variant="outline" disabled={rewriting !== null} onClick={() => handleRewrite("casual")}>
                  {rewriting === "casual" ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />} Casual
                </Button>
                <Button size="sm" variant="outline" disabled={rewriting !== null} onClick={() => handleRewrite("descontraido")}>
                  {rewriting === "descontraido" ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />} Descontraído
                </Button>
              </div>
            </div>
          </div>
        </div>

        <SaveIndicator state={saveState} savedAt={savedAt} />
      </div>

      {/* Mensagens com preview */}
      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="bg-surface border border-border rounded-2xl p-4 md:p-5">
            <div className="grid md:grid-cols-[1fr_280px] gap-4 md:gap-5">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label>{f.label}</Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">{f.help}</p>
                <Textarea
                  ref={(el) => { refs.current[f.key as string] = el; }}
                  rows={f.rows}
                  value={form[f.key] as string}
                  onFocus={() => setFocusField(f.key)}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="resize-none"
                />
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(f.key, v.key)}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                      title={v.label}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
              <WhatsAppPreview text={renderPreview(form[f.key] as string, form.name)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  if (state === "saving") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
      </div>
    );
  }
  if (state === "error") {
    return <Badge variant="destructive" className="text-xs">Erro ao salvar</Badge>;
  }
  if (state === "saved" && savedAt) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3 w-3 text-primary" />
        Salvo às {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </div>
    );
  }
  return <div className="text-xs text-muted-foreground">Alterações são salvas automaticamente</div>;
}

function renderPreview(text: string, botName: string): string {
  return (text || "")
    .replace(/\{nome\}/g, "Ana")
    .replace(/\{loja\}/g, botName || "sua loja")
    .replace(/\{produto\}/g, "Combo Especial")
    .replace(/\{preco\}/g, "R$ 39,90")
    .replace(/\{pedido\}/g, "#1234");
}

function WhatsAppPreview({ text }: { text: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-[#0a1014]">
      <div className="px-3 py-2 bg-[#202c33] border-b border-black/30 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-[#00a884] flex items-center justify-center text-[10px] font-bold text-white">B</div>
        <div className="text-xs text-white/90 font-medium">Bot</div>
      </div>
      <div className="p-3 min-h-[110px] relative bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><circle cx=%2230%22 cy=%2230%22 r=%221%22 fill=%22%23ffffff%22 fill-opacity=%220.04%22/></svg>')]">
        <div className="max-w-[85%] bg-[#202c33] text-white text-[13px] leading-snug rounded-lg rounded-tl-sm px-3 py-2 shadow whitespace-pre-wrap break-words">
          {text || <span className="text-white/40">…</span>}
          <div className="text-[10px] text-white/40 text-right mt-1">14:32</div>
        </div>
      </div>
    </div>
  );
}
