import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateBot } from "@/lib/generate-bot.functions";
import {
  Sparkles, ArrowRight, Bot, RefreshCw, Send,
  Zap, Shield, TrendingUp, MessageSquare, Package, Megaphone, Quote, Target,
} from "lucide-react";

export const Route = createFileRoute("/ai-builder")({
  component: () => (
    <AppShell>
      <AIBuilder />
    </AppShell>
  ),
});

interface ObjectionHandler { objection: string; response: string; }
interface SuggestedProduct { name: string; description: string; price_brl: number; }
interface GeneratedBot {
  bot_name: string;
  tagline: string;
  persona: string;
  tone: string;
  value_props: string[];
  opening_hooks: string[];
  objection_handlers: ObjectionHandler[];
  flow: Array<{ type: string; text?: string; options?: string[]; field?: string; methods?: string[]; delay_hours?: number }>;
  suggested_products: SuggestedProduct[];
  promotional_messages: string[];
  kpis: string[];
}

type StepKey = "description" | "ticket" | "tone" | "ready";

interface Step {
  key: StepKey;
  question: string;
  helper?: string;
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean;
  minLength?: number;
  quickOptions?: string[];
}

const STEPS: Step[] = [
  {
    key: "description",
    question: "O que sua loja vende?",
    helper: "Produtos, preços médios, diferenciais, prazos de entrega. Quanto mais detalhe, melhor o bot fica.",
    placeholder: "Ex: vendo roupas femininas casuais R$80–R$200, entrego pra todo Brasil via Correios, aceito PIX e cartão...",
    multiline: true,
    minLength: 20,
  },
  {
    key: "ticket",
    question: "Qual seu ticket médio? (opcional)",
    helper: "Ajuda a IA a calibrar o tom e o nível de objeções esperadas.",
    placeholder: "Ex: R$ 120",
    optional: true,
  },
  {
    key: "tone",
    question: "Como o bot deve falar?",
    helper: "Escolha um tom — ou deixe a IA decidir.",
    optional: true,
    quickOptions: ["A IA escolhe", "consultivo", "vendedor", "casual", "premium", "amigável", "engraçado"],
  },
];

interface ChatItem {
  role: "bot" | "user";
  text: string;
}

function AIBuilder() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [chat, setChat] = useState<ChatItem[]>([{ role: "bot", text: STEPS[0].question }]);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<StepKey, string>>({
    description: "", ticket: "", tone: "", ready: "",
  });
  const [input, setInput] = useState("");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GeneratedBot | null>(null);
  const [createProducts, setCreateProducts] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, generating]);

  const currentStep = stepIdx < STEPS.length ? STEPS[stepIdx] : null;

  const submitAnswer = (value: string) => {
    if (!currentStep) return;
    const trimmed = value.trim();
    if (currentStep.minLength && trimmed.length < currentStep.minLength) {
      toast.error(`Conta um pouco mais (mínimo ${currentStep.minLength} caracteres)`);
      return;
    }
    const display = trimmed || "—";
    setAnswers((a) => ({ ...a, [currentStep.key]: trimmed }));
    setChat((c) => [...c, { role: "user", text: display }]);
    setInput("");

    const next = stepIdx + 1;
    setTimeout(() => {
      if (next < STEPS.length) {
        setChat((c) => [...c, { role: "bot", text: STEPS[next].question }]);
        setStepIdx(next);
      } else {
        setChat((c) => [...c, { role: "bot", text: "Perfeito! Já tenho o que preciso. Vou montar tudo agora..." }]);
        setStepIdx(STEPS.length);
        setTimeout(() => generate(), 600);
      }
    }, 280);
  };

  const skip = () => {
    if (!currentStep?.optional) return;
    submitAnswer("");
  };

  const generate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const tone = answers.tone && answers.tone !== "A IA escolhe" ? answers.tone : "";
      const data: any = await generateBot({
        data: {
          description: answers.description,
          segment: profile?.segment ?? "",
          audience: "",
          goal: "vendas",
          tone_preference: tone,
          ticket: answers.ticket,
        },
      });
      setResult(data as GeneratedBot);
      setChat((c) => [...c, { role: "bot", text: `Pronto! Criei "${data.bot_name}" — dá uma olhada abaixo.` }]);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar bot");
      setChat((c) => [...c, { role: "bot", text: "Ops, deu erro ao gerar. Quer tentar de novo?" }]);
    } finally {
      setGenerating(false);
    }
  };

  const restart = () => {
    setChat([{ role: "bot", text: STEPS[0].question }]);
    setStepIdx(0);
    setAnswers({ description: "", ticket: "", tone: "", ready: "" });
    setInput("");
    setResult(null);
  };

  const saveBot = async () => {
    if (!user || !result) return;
    const [{ count }, { data: prof }] = await Promise.all([
      supabase.from("bots").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    ]);
    const { getPlan } = await import("@/lib/plans");
    const limit = getPlan((prof as any)?.plan).botLimit;
    if ((count ?? 0) >= limit) {
      toast.error("Limite do plano atingido.");
      navigate({ to: "/plans" });
      return;
    }
    setSaving(true);
    const { data: bot, error } = await supabase
      .from("bots")
      .insert({
        user_id: user.id,
        name: result.bot_name,
        bot_type: "sales",
        segment: profile?.segment ?? null,
        tone: result.tone,
      })
      .select()
      .single();

    if (error || !bot) {
      toast.error(error?.message ?? "Erro");
      setSaving(false);
      return;
    }

    await supabase.from("bot_flows").insert({
      bot_id: bot.id, user_id: user.id, blocks: result.flow,
    });

    if (createProducts && result.suggested_products?.length) {
      const rows = result.suggested_products.map((p, i) => ({
        user_id: user.id, bot_id: bot.id,
        name: p.name, description: p.description,
        price_cents: Math.round((p.price_brl || 0) * 100),
        sort_order: i, is_active: true,
      }));
      await supabase.from("products").insert(rows);
    }

    toast.success("Bot salvo! Abrindo editor...");
    setSaving(false);
    navigate({ to: "/bots/$botId/edit", params: { botId: bot.id } });
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Assistente de criação</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Vamos criar seu bot juntos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Respondendo umas perguntas rápidas, eu monto todo o funil — persona, mensagens, objeções e catálogo.
        </p>
      </div>

      {/* Chat */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden flex flex-col" style={{ minHeight: "26rem" }}>
        <div ref={scrollRef} className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[28rem]">
          {chat.map((m, i) => (
            <ChatLine key={i} role={m.role} text={m.text} />
          ))}
          {generating && (
            <div className="flex gap-2 items-center text-sm text-muted-foreground animate-fade-in">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "240ms" }} />
              </div>
              Construindo sua estratégia...
            </div>
          )}
        </div>

        {/* Input area */}
        {currentStep && !generating && !result && (
          <div className="border-t border-border p-3 bg-background/50">
            {currentStep.helper && (
              <p className="text-xs text-muted-foreground mb-2 px-1">{currentStep.helper}</p>
            )}

            {currentStep.quickOptions ? (
              <div className="flex flex-wrap gap-1.5">
                {currentStep.quickOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => submitAnswer(opt)}
                    className="text-sm px-3 py-1.5 rounded-full bg-surface border border-border hover:border-primary/40 hover:bg-primary/5 transition"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : currentStep.multiline ? (
              <div className="space-y-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentStep.placeholder}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex justify-between items-center gap-2">
                  {currentStep.optional ? (
                    <Button variant="ghost" size="sm" onClick={skip}>Pular</Button>
                  ) : <span />}
                  <Button
                    onClick={() => submitAnswer(input)}
                    className="bg-gradient-primary text-primary-foreground"
                  >
                    <Send className="h-4 w-4 mr-2" /> Enviar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentStep.placeholder}
                  onKeyDown={(e) => e.key === "Enter" && submitAnswer(input)}
                />
                {currentStep.optional && (
                  <Button variant="ghost" onClick={skip}>Pular</Button>
                )}
                <Button onClick={() => submitAnswer(input)} className="bg-gradient-primary text-primary-foreground">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="mt-8 space-y-5 animate-page-in">
          <div className="rounded-2xl bg-surface border border-primary/30 p-6 shadow-card">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
                <Bot className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-display font-bold">{result.bot_name}</h2>
                {result.tagline && <p className="text-sm text-primary mt-0.5">{result.tagline}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="capitalize">{result.tone}</Badge>
                  <Badge variant="outline">{result.flow.length} blocos</Badge>
                  <Badge variant="outline">{result.suggested_products?.length ?? 0} produtos</Badge>
                </div>
                {result.persona && (
                  <p className="text-sm text-muted-foreground mt-3 italic">"{result.persona}"</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Section icon={Zap} title="Propostas de valor">
              <ul className="space-y-2">
                {result.value_props?.map((v, i) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="text-primary">→</span><span>{v}</span></li>
                ))}
              </ul>
            </Section>
            <Section icon={TrendingUp} title="KPIs">
              <ul className="space-y-2">
                {result.kpis?.map((k, i) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="text-primary">•</span><span>{k}</span></li>
                ))}
              </ul>
            </Section>
          </div>

          {result.opening_hooks?.length > 0 && (
            <Section icon={Target} title="Ganchos de abertura">
              <div className="grid md:grid-cols-3 gap-2">
                {result.opening_hooks.map((h, i) => (
                  <div key={i} className="p-3 rounded-lg bg-background border border-border text-sm">{h}</div>
                ))}
              </div>
            </Section>
          )}

          <Section icon={MessageSquare} title="Pré-visualização do fluxo">
            <div className="rounded-xl bg-background border border-border p-4 space-y-3 max-h-[28rem] overflow-y-auto">
              {result.flow.map((block, i) => <ChatBubble key={i} block={block} index={i} />)}
            </div>
          </Section>

          {result.objection_handlers?.length > 0 && (
            <Section icon={Shield} title="Quebras de objeção">
              <div className="grid md:grid-cols-2 gap-3">
                {result.objection_handlers.map((o, i) => (
                  <div key={i} className="p-3 rounded-lg bg-background border border-border">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Objeção</div>
                    <div className="text-sm font-medium mb-2">{o.objection}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Resposta</div>
                    <div className="text-sm text-muted-foreground">{o.response}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {result.suggested_products?.length > 0 && (
            <Section icon={Package} title="Catálogo sugerido">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.suggested_products.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg bg-background border border-border">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</div>
                    <div className="text-sm font-semibold text-primary mt-2">
                      R$ {p.price_brl.toFixed(2).replace(".", ",")}
                    </div>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-4 text-sm cursor-pointer">
                <Checkbox checked={createProducts} onCheckedChange={(v) => setCreateProducts(!!v)} />
                Criar esses produtos automaticamente
              </label>
            </Section>
          )}

          {result.promotional_messages?.length > 0 && (
            <Section icon={Megaphone} title="Mensagens promocionais">
              <div className="space-y-2">
                {result.promotional_messages.map((m, i) => (
                  <div key={i} className="p-3 rounded-lg bg-background border border-border text-sm flex gap-2">
                    <Quote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sticky bottom-4">
            <Button variant="outline" onClick={restart} className="bg-surface">
              <RefreshCw className="h-4 w-4 mr-2" /> Recomeçar
            </Button>
            <LoadingButton
              onClick={saveBot}
              loading={saving}
              loadingText="Salvando..."
              className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow h-11"
            >
              Salvar este bot <ArrowRight className="ml-2 h-4 w-4" />
            </LoadingButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatLine({ role, text }: { role: "bot" | "user"; text: string }) {
  const isBot = role === "bot";
  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} animate-fade-in`}>
      {isBot && (
        <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center mr-2 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
      <div
        className={`max-w-[80%] px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
          isBot
            ? "bg-muted text-foreground rounded-2xl rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ChatBubble({ block, index }: { block: { type: string; text?: string; options?: string[] }; index: number }) {
  const isBot = !["input", "user"].includes(block.type);
  return (
    <div
      className={`flex ${isBot ? "justify-start" : "justify-end"} animate-fade-in`}
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
          isBot ? "bg-muted text-foreground rounded-bl-sm" : "bg-primary text-primary-foreground rounded-br-sm"
        }`}
      >
        <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{block.type}</div>
        {block.text && <div className="whitespace-pre-wrap">{block.text}</div>}
        {block.options && (
          <div className="flex flex-wrap gap-1 mt-2">
            {block.options.map((o, j) => (
              <span
                key={j}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isBot ? "bg-background/60" : "bg-primary-foreground/15"
                }`}
              >
                {o}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
