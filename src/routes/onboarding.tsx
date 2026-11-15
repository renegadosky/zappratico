import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shirt, UtensilsCrossed, Truck, Sparkles, Cpu, Watch, Footprints,
  GraduationCap, Link as LinkIcon, Store, MoreHorizontal, MessageSquare,
  Instagram, Building2, Globe, ShoppingBag, TrendingUp, Bot, Clock,
  ListChecks, Heart, Loader2, ArrowRight, ArrowLeft, Check, Upload, Image as ImageIcon,
} from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const SEGMENTS = [
  { id: "Loja de roupas", icon: Shirt },
  { id: "Restaurante", icon: UtensilsCrossed },
  { id: "Delivery", icon: Truck },
  { id: "Cosméticos", icon: Sparkles },
  { id: "Eletrônicos", icon: Cpu },
  { id: "Loja de acessórios", icon: Watch },
  { id: "Loja de calçados", icon: Footprints },
  { id: "Infoprodutos", icon: GraduationCap },
  { id: "Afiliados", icon: LinkIcon },
  { id: "Loja genérica", icon: Store },
  { id: "Outro", icon: MoreHorizontal },
];

const CHANNELS = [
  { id: "WhatsApp manual", icon: MessageSquare, help: "Conectamos seu número para o bot atender direto no WhatsApp." },
  { id: "Instagram", icon: Instagram, help: "Resposta automática nos DMs do Instagram." },
  { id: "Loja física", icon: Building2, help: "Mini-loja online + bot para receber pedidos de longe." },
  { id: "Site próprio", icon: Globe, help: "Embed do bot no seu site para capturar e qualificar leads." },
  { id: "Marketplace", icon: ShoppingBag, help: "Centraliza vendas com o bot atendendo no WhatsApp." },
];

const GOALS = [
  { id: "Vender mais", icon: TrendingUp, desc: "Aumentar volume de vendas",
    benefit: "O bot sugere combos e produtos relacionados em cada conversa, aumentando o ticket médio." },
  { id: "Automatizar atendimento", icon: Bot, desc: "Responder clientes 24/7",
    benefit: "Seu bot atende sozinho de madrugada, fim de semana e feriado — sem perder venda." },
  { id: "Reduzir tempo de resposta", icon: Clock, desc: "Atender mais rápido",
    benefit: "Resposta instantânea. Cliente não fica esperando — converte 3x mais que respostas demoradas." },
  { id: "Organizar pedidos", icon: ListChecks, desc: "Centralizar gestão",
    benefit: "Painel único com status (pago, preparando, enviado), PIX e histórico de cada pedido." },
  { id: "Recuperar clientes", icon: Heart, desc: "Reengajar carrinhos abandonados",
    benefit: "Bot reabre conversa com quem desistiu e oferece desconto pra fechar o pedido." },
];

const COLOR_OPTIONS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f59e0b", "#ef4444", "#14b8a6", "#0ea5e9",
];

function Onboarding() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [businessName, setBusinessName] = useState("");
  const [segment, setSegment] = useState<string | null>(null);

  // Perfil da loja
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [storeColor, setStoreColor] = useState<string>("#10b981");
  const [storeDescription, setStoreDescription] = useState("");
  const [publicWhats, setPublicWhats] = useState("");
  const [publicInsta, setPublicInsta] = useState("");
  const [address, setAddress] = useState("");

  // Multi-select
  const [channels, setChannels] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) navigate({ to: "/auth" });
      else if (profile?.onboarding_completed) navigate({ to: "/dashboard" });
      else if (profile?.business_name) setBusinessName(profile.business_name);
    }
  }, [user, profile, authLoading, navigate]);

  const toggle = (list: string[], value: string, setter: (l: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const handleLogoUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("Logo até 3MB.");
    setUploadingLogo(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `logos/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) {
      setUploadingLogo(false);
      return toast.error("Falha ao enviar logo: " + error.message);
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploadingLogo(false);
  };

  const isPhysical = channels.includes("Loja física");

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    const primaryChannel = channels[0] ?? null;
    const primaryGoal = goals[0] ?? null;

    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        business_name: businessName,
        segment,
        current_channel: primaryChannel,
        main_goal: primaryGoal,
        channels,
        goals,
        logo_url: logoUrl,
        store_color: storeColor,
        store_description: storeDescription || null,
        public_whatsapp: publicWhats || null,
        public_instagram: publicInsta || null,
        address: isPhysical ? address || null : null,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    // cria a loja primária correspondente
    const { error: sErr } = await supabase.from("stores").insert({
      user_id: user.id,
      name: businessName,
      segment,
      logo_url: logoUrl,
      color: storeColor,
      description: storeDescription || null,
      public_whatsapp: publicWhats || null,
      public_instagram: publicInsta || null,
      address: isPhysical ? address || null : null,
      is_primary: true,
    });

    setSaving(false);
    if (pErr) return toast.error("Erro ao salvar perfil: " + pErr.message);
    if (sErr) console.warn("Erro ao criar loja:", sErr.message);
    await refreshProfile();
    toast.success("Tudo pronto! Bora criar seu primeiro bot.");
    navigate({ to: "/dashboard" });
  };

  const steps = [
    {
      title: "Como se chama sua loja?",
      subtitle: "Vamos personalizar sua experiência",
      canNext: businessName.trim().length > 1,
    },
    {
      title: "Qual o segmento da sua loja?",
      subtitle: "Isso ajuda a sugerir os melhores templates",
      canNext: !!segment,
    },
    {
      title: "Perfil da sua loja",
      subtitle: "Em 5 minutos sua loja já fica com cara profissional",
      canNext: true, // tudo opcional
    },
    {
      title: "Como você vende hoje?",
      subtitle: "Pode marcar quantos canais quiser",
      canNext: channels.length > 0,
    },
    {
      title: "Quais seus objetivos?",
      subtitle: "Pode marcar quantos quiser — vamos focar no que importa",
      canNext: goals.length > 0,
    },
  ];

  const current = steps[step];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[140px] pointer-events-none" />

      <div className="relative z-10 container mx-auto px-6 py-8">
        <div className="flex justify-center mb-12">
          <Logo />
        </div>

        <div className="max-w-2xl mx-auto mb-10">
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
            <span>Passo {step + 1} de {steps.length}</span>
            <span>{Math.round(((step + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all duration-500"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-center">{current.title}</h1>
          <p className="mt-2 text-center text-muted-foreground">{current.subtitle}</p>

          <div className="mt-10">
            {step === 0 && (
              <div className="space-y-3 max-w-md mx-auto">
                <Label htmlFor="biz">Nome da loja</Label>
                <Input id="biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ex: Loja da Maria" className="h-12" autoFocus />
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {SEGMENTS.map((s) => (
                  <SelectCard key={s.id} label={s.id} Icon={s.icon}
                    selected={segment === s.id} onClick={() => setSegment(s.id)} />
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="h-24 w-24 rounded-xl border-2 border-dashed border-border bg-surface hover:border-primary/60 transition-colors flex items-center justify-center overflow-hidden shrink-0"
                  >
                    {uploadingLogo ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      : logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                      : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                  <div className="flex-1">
                    <Label className="block mb-1">Logo da loja</Label>
                    <p className="text-xs text-muted-foreground mb-2">PNG, JPG ou SVG até 3MB. Aparece na sua mini-loja e nas mensagens do bot.</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" /> {logoUrl ? "Trocar" : "Enviar logo"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cor principal</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button key={c} type="button" onClick={() => setStoreColor(c)}
                        className={`h-9 w-9 rounded-full transition-transform ${storeColor === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-110"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                    <label className="h-9 w-9 rounded-full border border-border flex items-center justify-center cursor-pointer overflow-hidden relative">
                      <input type="color" value={storeColor} onChange={(e) => setStoreColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer" />
                      <div className="h-5 w-5 rounded-full" style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc">Descrição curta (opcional)</Label>
                  <Textarea id="desc" value={storeDescription} onChange={(e) => setStoreDescription(e.target.value)}
                    placeholder="Ex: Roupas femininas com entrega rápida na Zona Sul." maxLength={160} rows={2} />
                  <p className="text-xs text-muted-foreground text-right">{storeDescription.length}/160</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="wpp">WhatsApp público</Label>
                    <Input id="wpp" value={publicWhats} onChange={(e) => setPublicWhats(e.target.value)}
                      placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insta">Instagram</Label>
                    <Input id="insta" value={publicInsta} onChange={(e) => setPublicInsta(e.target.value)}
                      placeholder="@sualoja" />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Tudo opcional — você pode preencher depois nas configurações.</p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {CHANNELS.map((c) => (
                    <SelectCard key={c.id} label={c.id} Icon={c.icon}
                      selected={channels.includes(c.id)}
                      onClick={() => toggle(channels, c.id, setChannels)} multi />
                  ))}
                </div>
                {channels.length > 0 && (
                  <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                    {channels.map((id) => {
                      const c = CHANNELS.find((x) => x.id === id);
                      if (!c) return null;
                      return (
                        <div key={id} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div><span className="font-medium">{id}:</span> <span className="text-muted-foreground">{c.help}</span></div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isPhysical && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="addr">Endereço da loja física (opcional)</Label>
                    <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF" />
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-3">
                {GOALS.map((g) => {
                  const selected = goals.includes(g.id);
                  return (
                    <div key={g.id}>
                      <button
                        type="button"
                        onClick={() => toggle(goals, g.id, setGoals)}
                        className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                          selected ? "border-primary bg-primary/10 shadow-glow"
                          : "border-border bg-surface hover:border-primary/40"
                        }`}
                      >
                        <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${
                          selected ? "bg-primary/20" : "bg-muted"
                        }`}>
                          <g.icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{g.id}</div>
                          <div className="text-sm text-muted-foreground">{g.desc}</div>
                        </div>
                        {selected && <Check className="h-5 w-5 text-primary" />}
                      </button>
                      {selected && (
                        <div className="mt-2 ml-14 p-3 rounded-lg bg-primary/5 border-l-2 border-primary text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1">
                          <span className="text-primary font-medium">O que melhora: </span>
                          {g.benefit}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-10 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!current.canNext}
                className="bg-gradient-primary text-primary-foreground shadow-glow">
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={!current.canNext || saving}
                className="bg-gradient-primary text-primary-foreground shadow-glow">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finalizar configuração
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectCard({
  label, Icon, selected, onClick, multi = false,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  selected: boolean;
  onClick: () => void;
  multi?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-all relative ${
        selected ? "border-primary bg-primary/10 shadow-glow"
        : "border-border bg-surface hover:border-primary/40"
      }`}>
      <Icon className={`h-5 w-5 mb-3 ${selected ? "text-primary" : "text-muted-foreground"}`} />
      <div className="text-sm font-medium">{label}</div>
      {multi && selected && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
