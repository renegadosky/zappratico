import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCached, setCached } from "@/lib/data-cache";
import { toast } from "sonner";
import { Loader2, Save, Copy, Check, ExternalLink, Smartphone, Monitor, Palette, MapPin, Clock, Instagram, Phone, ShoppingBag, Upload, Trash2, Image as ImageIcon, LayoutGrid, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PhoneInputBR } from "@/components/PhoneInputBR";
import { MessageTemplateBuilder } from "@/components/MessageTemplateBuilder";
import { StoreCatalogManager } from "@/components/StoreCatalogManager";
import { normalizeImageUrl } from "@/lib/image-url";
import {
  STORE_THEMES, parseLayout, buttonRadius, columnsClass, gapClass, imageAspectClass,
  type StoreLayout,
} from "@/lib/store-theme";

interface Settings {
  id?: string; bot_id: string; user_id: string;
  phone_number: string | null; store_slug: string | null;
  store_enabled: boolean; store_title: string | null; store_description: string | null;
  buy_message_template: string | null; use_native_catalog: boolean;
  logo_url: string | null; cover_url: string | null;
  theme_color: string | null; accent_color: string | null; font_family: string | null;
  secondary_color: string | null; text_color: string | null; button_style: string | null;
  layout_json: any; require_address: boolean; accept_orders: boolean;
  address: string | null; hours_json: any;
  instagram_url: string | null; tiktok_url: string | null;
  contact_buttons: any; template_slug: string | null;
}

const DAYS = [
  { key: "mon", label: "Seg" }, { key: "tue", label: "Ter" }, { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" }, { key: "fri", label: "Sex" }, { key: "sat", label: "Sáb" }, { key: "sun", label: "Dom" },
];


function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

async function uploadImage(file: File, userId: string, kind: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type,
  });
  if (error) throw error;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

function ImageUploader({ value, onChange, userId, kind, aspectClass, hint }: { value: string | null; onChange: (v: string | null) => void; userId: string; kind: string; aspectClass: string; hint: string; }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={`relative ${aspectClass} rounded-xl overflow-hidden border border-dashed border-border bg-background flex items-center justify-center group`}>
      {value ? (
        <img src={normalizeImageUrl(value) ?? value} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="text-center text-xs text-muted-foreground p-2">
          <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-50" />
          {hint}
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <label className="cursor-pointer inline-flex items-center gap-1 px-3 h-8 rounded-md bg-white text-black text-xs font-medium">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Trocar
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
            setBusy(true);
            try { const url = await uploadImage(f, userId, kind); onChange(url); toast.success("Imagem enviada"); }
            catch (err: any) { toast.error(err?.message ?? "Erro ao enviar"); }
            finally { setBusy(false); }
          }} />
        </label>
        {value && (
          <Button size="sm" variant="destructive" className="h-8" onClick={() => onChange(null)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function StoreSiteEditor({ botId, userId, botName }: { botId: string; userId: string; botName: string }) {
  const cacheKey = `whatsapp:${botId}`;
  const cached = getCached<Settings>(cacheKey);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [s, setS] = useState<Settings>(cached ?? {
    bot_id: botId, user_id: userId,
    phone_number: "", store_slug: slugify(botName),
    store_enabled: true, store_title: botName, store_description: "",
    buy_message_template: "Olá! Quero comprar: {produto} - {preco}",
    use_native_catalog: false,
    logo_url: null, cover_url: null,
    theme_color: "#10b981", accent_color: "#0f172a", font_family: "sans",
    secondary_color: "#1e293b", text_color: "#ffffff", button_style: "rounded",
    layout_json: {}, require_address: false, accept_orders: true,
    address: "", hours_json: null,
    instagram_url: "", tiktok_url: "",
    contact_buttons: { whatsapp: true, instagram: false, call: false },
    template_slug: "classic",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("whatsapp_settings").select("*").eq("bot_id", botId).maybeSingle();
      if (data) { setS({ ...s, ...(data as any) }); setCached(cacheKey, data); }
      setLoading(false);
    })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const setField = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  const layout: StoreLayout = parseLayout(s.layout_json);
  const setLayout = (patch: Partial<StoreLayout>) => setField("layout_json", { ...layout, ...patch });

  const applyTemplate = (slug: string) => {
    const t = STORE_THEMES.find((x) => x.slug === slug); if (!t) return;
    setS((prev) => ({
      ...prev, template_slug: slug,
      theme_color: t.theme, accent_color: t.accent, secondary_color: t.secondary,
      text_color: t.text, font_family: t.font, button_style: t.button, layout_json: t.layout,
    }));
  };


  const save = async () => {
    if (!s.store_slug?.trim()) { toast.error("Defina um link da loja"); return; }
    setSaving(true);
    const payload = { ...s, bot_id: botId, store_slug: slugify(s.store_slug) };
    // Remove id para deixar o upsert decidir por bot_id (unique)
    delete (payload as any).id;
    const { data, error } = await supabase
      .from("whatsapp_settings")
      .upsert(payload, { onConflict: "bot_id" })
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) {
      if (error.message.toLowerCase().includes("store_slug")) toast.error("Esse link já está em uso. Escolha outro.");
      else toast.error(error.message);
    } else {
      toast.success("Loja salva");
      if (data) { setS({ ...s, ...(data as any) }); setCached(cacheKey, data); }
    }
  };

  const storeUrl = s.store_slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/loja/${s.store_slug}` : "";
  const copy = async () => { await navigator.clipboard.writeText(storeUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const hours = (s.hours_json ?? {}) as Record<string, { open: string; close: string; closed?: boolean } | undefined>;
  const setDay = (key: string, patch: any) => setField("hours_json", { ...hours, [key]: { ...(hours[key] ?? { open: "09:00", close: "18:00" }), ...patch } });

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-5">
      {/* EDITOR */}
      <div className="space-y-5 min-w-0">
        {/* Ativar */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold">Mini-loja ativa</h3>
            <p className="text-xs text-muted-foreground">Publica sua página em <code className="px-1 bg-background rounded">/loja/{s.store_slug || "..."}</code></p>
          </div>
          <Switch checked={s.store_enabled} onCheckedChange={(v) => setField("store_enabled", v)} />
        </div>

        {/* Link */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <Label>Link público da sua loja</Label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1 px-3 rounded-md border border-input bg-background text-sm min-w-0">
              <span className="text-muted-foreground shrink-0">/loja/</span>
              <input className="flex-1 bg-transparent py-2 outline-none min-w-0" value={s.store_slug ?? ""} onChange={(e) => setField("store_slug", slugify(e.target.value))} placeholder="minha-loja" />
            </div>
            <Button variant="outline" size="icon" onClick={copy} title="Copiar"><>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</></Button>
            {s.id && <a href={`/loja/${s.store_slug}`} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button></a>}
          </div>
          <p className="text-xs text-muted-foreground">Esse link você compartilha no Instagram, TikTok, cartão de visita, no status do Zap...</p>
        </div>

        {/* Pedidos na loja */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Pedidos e pagamento</h3></div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border border-border">
            <div>
              <div className="text-sm font-medium">Aceitar pedidos na loja</div>
              <p className="text-xs text-muted-foreground">O cliente monta o carrinho e paga no PIX sem sair da página.</p>
            </div>
            <Switch checked={s.accept_orders !== false} onCheckedChange={(v) => setField("accept_orders", v)} />
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border border-border">
            <div>
              <div className="text-sm font-medium">Pedir endereço de entrega</div>
              <p className="text-xs text-muted-foreground">Ativa um campo obrigatório de endereço no fechamento.</p>
            </div>
            <Switch checked={!!s.require_address} onCheckedChange={(v) => setField("require_address", v)} />
          </div>
          <p className="text-xs text-muted-foreground">
            O PIX usado é o mesmo configurado na aba <strong>Pagamento</strong> deste bot. Sem PIX configurado, o pedido é registrado e o cliente combina o pagamento com você.
          </p>
        </div>

        {/* Catálogo da loja */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Catálogo da loja</h3></div>
          <p className="text-xs text-muted-foreground">Organize em seções e escolha quais produtos aparecem na loja online.</p>
          <StoreCatalogManager botId={botId} userId={userId} />
        </div>

        {/* Templates */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Estilo da loja</h3></div>
          <p className="text-xs text-muted-foreground">Escolha um modelo pronto. Depois você pode trocar as cores como quiser.</p>
          <div className="grid grid-cols-3 gap-2">
            {STORE_THEMES.map((t) => (
              <button key={t.slug} type="button" onClick={() => applyTemplate(t.slug)} className={`p-3 rounded-xl border-2 text-left transition-all ${s.template_slug === t.slug ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}>
                <div className="flex gap-1 mb-2">
                  <div className="h-5 w-5 rounded" style={{ background: t.theme }} />
                  <div className="h-5 w-5 rounded" style={{ background: t.accent }} />
                  <div className="h-5 w-5 rounded border border-border" style={{ background: t.secondary }} />
                </div>
                <div className="text-xs font-medium">{t.name}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Cor principal</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={s.theme_color ?? "#10b981"} onChange={(e) => setField("theme_color", e.target.value)} className="h-9 w-12 rounded cursor-pointer border border-input bg-background" />
                <Input value={s.theme_color ?? ""} onChange={(e) => setField("theme_color", e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={s.accent_color ?? "#0f172a"} onChange={(e) => setField("accent_color", e.target.value)} className="h-9 w-12 rounded cursor-pointer border border-input bg-background" />
                <Input value={s.accent_color ?? ""} onChange={(e) => setField("accent_color", e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor dos cards</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={s.secondary_color ?? "#1e293b"} onChange={(e) => setField("secondary_color", e.target.value)} className="h-9 w-12 rounded cursor-pointer border border-input bg-background" />
                <Input value={s.secondary_color ?? ""} onChange={(e) => setField("secondary_color", e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor do texto</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={s.text_color ?? "#ffffff"} onChange={(e) => setField("text_color", e.target.value)} className="h-9 w-12 rounded cursor-pointer border border-input bg-background" />
                <Input value={s.text_color ?? ""} onChange={(e) => setField("text_color", e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de letra</Label>
              <div className="flex gap-1">
                {[{ v: "sans", l: "Moderna" }, { v: "display", l: "Marcante" }, { v: "serif", l: "Clássica" }].map((o) => (
                  <button key={o.v} type="button" onClick={() => setField("font_family", o.v)} className={`flex-1 h-9 rounded-md text-xs border ${s.font_family === o.v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>{o.l}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cantos dos botões</Label>
              <div className="flex gap-1">
                {[{ v: "rounded", l: "Suave" }, { v: "square", l: "Reto" }, { v: "pill", l: "Redondo" }].map((o) => (
                  <button key={o.v} type="button" onClick={() => setField("button_style", o.v)} className={`flex-1 h-9 rounded-md text-xs border ${(s.button_style ?? "rounded") === o.v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>{o.l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Como os produtos aparecem</h3></div>
          {[
            { label: "Formato", key: "mode" as const, opts: [{ v: "grid", l: "Grade" }, { v: "list", l: "Lista" }] },
            { label: "Tamanho dos cards", key: "card" as const, opts: [{ v: "large", l: "Grande" }, { v: "compact", l: "Compacto" }] },
            { label: "Colunas no computador", key: "columns" as const, opts: [{ v: 2, l: "2" }, { v: 3, l: "3" }, { v: 4, l: "4" }] },
            { label: "Formato da foto", key: "image" as const, opts: [{ v: "square", l: "Quadrada" }, { v: "wide", l: "Deitada" }, { v: "tall", l: "Em pé" }] },
            { label: "Espaçamento", key: "gap" as const, opts: [{ v: "tight", l: "Justo" }, { v: "normal", l: "Normal" }, { v: "airy", l: "Amplo" }] },
          ].map((row) => (
            <div key={row.key} className="space-y-1">
              <Label className="text-xs">{row.label}</Label>
              <div className="flex gap-1">
                {row.opts.map((o) => (
                  <button key={String(o.v)} type="button" onClick={() => setLayout({ [row.key]: o.v } as Partial<StoreLayout>)}
                    className={`flex-1 h-9 rounded-md text-xs border ${(layout as any)[row.key] === o.v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>


        {/* Identidade */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-semibold">Logo e foto de capa</h3>
          <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label className="text-xs">Logo</Label>
              <ImageUploader value={s.logo_url} onChange={(v) => setField("logo_url", v)} userId={userId} kind="logo" aspectClass="aspect-square" hint="Quadrada" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Foto de capa (banner)</Label>
              <ImageUploader value={s.cover_url} onChange={(v) => setField("cover_url", v)} userId={userId} kind="cover" aspectClass="aspect-[3/1]" hint="Banner do topo da loja" />
            </div>
          </div>
        </div>

        {/* Informações */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-semibold">Informações</h3>
          <div className="space-y-2">
            <Label>Nome da loja</Label>
            <Input value={s.store_title ?? ""} onChange={(e) => setField("store_title", e.target.value)} placeholder="Loja do João" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={s.store_description ?? ""} onChange={(e) => setField("store_description", e.target.value)} placeholder="O que sua loja vende? Pra quem é? Entrega em quais cidades?" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Endereço (opcional)</Label>
            <Input value={s.address ?? ""} onChange={(e) => setField("address", e.target.value)} placeholder="Rua das Flores, 123 — Bairro, Cidade/UF" />
          </div>
        </div>

        {/* Horário */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Horário de funcionamento</h3></div>
          <p className="text-xs text-muted-foreground">Deixe em branco se não quer mostrar.</p>
          <div className="space-y-1.5">
            {DAYS.map((d) => {
              const h = hours[d.key];
              const closed = h?.closed ?? false;
              return (
                <div key={d.key} className="flex items-center gap-2 text-sm">
                  <div className="w-12 text-muted-foreground">{d.label}</div>
                  <Switch checked={!closed} onCheckedChange={(v) => setDay(d.key, { closed: !v })} />
                  {!closed ? (
                    <>
                      <Input type="time" value={h?.open ?? "09:00"} onChange={(e) => setDay(d.key, { open: e.target.value })} className="w-28 h-8" />
                      <span className="text-muted-foreground">até</span>
                      <Input type="time" value={h?.close ?? "18:00"} onChange={(e) => setDay(d.key, { close: e.target.value })} className="w-28 h-8" />
                    </>
                  ) : <span className="text-xs text-muted-foreground">Fechado</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contato */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-semibold">Como o cliente fala com você</h3>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <PhoneInputBR value={s.phone_number} onChange={(v) => setField("phone_number", v)} />
            <p className="text-xs text-muted-foreground">É pra esse número que vão chegar as mensagens dos clientes. Pode ser o seu Zap normal — não precisa ser Business.</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram (opcional)</Label>
            <Input value={s.instagram_url ?? ""} onChange={(e) => setField("instagram_url", e.target.value)} placeholder="@minhaloja ou link completo" />
          </div>
          <div className="space-y-2">
            <Label>TikTok (opcional)</Label>
            <Input value={s.tiktok_url ?? ""} onChange={(e) => setField("tiktok_url", e.target.value)} placeholder="@minhaloja" />
          </div>
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Botões que aparecem na loja</Label>
            {[
              { k: "whatsapp", icon: ShoppingBag, label: "Comprar pelo WhatsApp" },
              { k: "instagram", icon: Instagram, label: "Ver Instagram" },
              { k: "call", icon: Phone, label: "Ligar" },
            ].map(({ k, icon: Icon, label }) => (
              <div key={k} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</div>
                <Switch checked={!!(s.contact_buttons as any)?.[k]} onCheckedChange={(v) => setField("contact_buttons", { ...(s.contact_buttons ?? {}), [k]: v })} />
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-border">
            <MessageTemplateBuilder value={s.buy_message_template ?? ""} onChange={(v) => setField("buy_message_template", v)} />
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow w-full md:w-auto">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar loja
        </Button>
      </div>

      {/* PREVIEW */}
      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pré-visualização</Label>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button onClick={() => setDevice("mobile")} className={`p-1.5 ${device === "mobile" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}><Smartphone className="h-3.5 w-3.5" /></button>
            <button onClick={() => setDevice("desktop")} className={`p-1.5 ${device === "desktop" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}><Monitor className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className={`mx-auto ${device === "mobile" ? "max-w-[280px]" : "max-w-full"} rounded-2xl overflow-hidden border-4 border-border shadow-lg`}>
          <StorePreview s={s} layout={layout} botId={botId} />
        </div>
        <p className="text-xs text-muted-foreground text-center">Mostra seus produtos reais, do jeito que o cliente vai ver.</p>
      </div>
    </div>
  );
}

function StorePreview({ s, layout, botId }: { s: Settings; layout: StoreLayout; botId: string }) {
  const fontClass = s.font_family === "serif" ? "font-serif" : s.font_family === "display" ? "font-display" : "font-sans";
  const radius = buttonRadius(s.button_style);
  const bg = s.accent_color || "#0f172a";
  const surface = s.secondary_color || "rgba(255,255,255,0.06)";
  const fg = s.text_color || "#ffffff";
  const theme = s.theme_color || "#10b981";
  const [items, setItems] = useState<Array<{ id: string; name: string; price_cents: number; image_url: string | null }>>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price_cents, image_url")
        .eq("bot_id", botId).eq("is_active", true).order("sort_order").limit(6);
      setItems((data as any[]) ?? []);
    })();
  }, [botId]);

  const aspect = imageAspectClass(layout.image);

  return (
    <div className={fontClass} style={{ background: bg, color: fg, minHeight: 400 }}>
      <div className="relative">
        {s.cover_url ? (
          <img src={normalizeImageUrl(s.cover_url) ?? s.cover_url} alt="" className="w-full aspect-[3/1] object-cover" />
        ) : (
          <div className="w-full aspect-[3/1]" style={{ background: `linear-gradient(135deg, ${theme}, ${bg})` }} />
        )}
        {s.logo_url && (
          <img src={normalizeImageUrl(s.logo_url) ?? s.logo_url} alt="" className="absolute -bottom-8 left-4 h-16 w-16 object-cover border-4" style={{ borderColor: bg, borderRadius: radius }} />
        )}
      </div>
      <div className={`px-4 ${s.logo_url ? "pt-10" : "pt-4"} pb-4 space-y-2`}>
        <div className="text-lg font-bold leading-tight">{s.store_title || "Nome da loja"}</div>
        {s.store_description && <div className="text-xs opacity-80">{s.store_description}</div>}
        {s.address && <div className="text-[11px] opacity-70 flex items-center gap-1"><MapPin className="h-3 w-3" />{s.address}</div>}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {(s.contact_buttons as any)?.whatsapp && (
            <div className="px-2.5 py-1 text-[11px] font-medium text-white" style={{ background: theme, borderRadius: radius }}>WhatsApp</div>
          )}
          {(s.contact_buttons as any)?.instagram && s.instagram_url && (
            <div className="px-2.5 py-1 text-[11px] font-medium bg-white/10" style={{ borderRadius: radius }}>Instagram</div>
          )}
          {(s.contact_buttons as any)?.call && s.phone_number && (
            <div className="px-2.5 py-1 text-[11px] font-medium bg-white/10" style={{ borderRadius: radius }}>Ligar</div>
          )}
        </div>

        <div className={`pt-3 ${layout.mode === "list" ? "grid grid-cols-1" : `grid grid-cols-2 ${gapClass(layout.gap) === "gap-6" ? "gap-3" : gapClass(layout.gap)}`} ${layout.mode === "list" ? gapClass(layout.gap) : ""}`}>
          {(items.length > 0 ? items : [null, null, null, null]).map((p, i) =>
            layout.mode === "list" ? (
              <div key={p?.id ?? i} className="flex gap-2 items-center p-2 border" style={{ background: surface, borderColor: "rgba(255,255,255,0.08)", borderRadius: radius }}>
                <div className="h-12 w-12 shrink-0 overflow-hidden bg-white/5 flex items-center justify-center" style={{ borderRadius: radius }}>
                  {p?.image_url ? <img src={normalizeImageUrl(p.image_url) ?? p.image_url} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-4 w-4 opacity-40" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{p?.name ?? "Produto"}</div>
                  <div className="text-xs font-bold" style={{ color: theme }}>{p ? `R$ ${(p.price_cents / 100).toFixed(2).replace(".", ",")}` : "R$ 0,00"}</div>
                </div>
              </div>
            ) : (
              <div key={p?.id ?? i} className="overflow-hidden border" style={{ background: surface, borderColor: "rgba(255,255,255,0.08)", borderRadius: radius }}>
                <div className={`w-full ${aspect} bg-white/5 flex items-center justify-center`}>
                  {p?.image_url ? <img src={normalizeImageUrl(p.image_url) ?? p.image_url} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-5 w-5 opacity-40" />}
                </div>
                <div className={layout.card === "compact" ? "p-1.5" : "p-2"}>
                  <div className="text-[11px] font-medium truncate">{p?.name ?? "Produto"}</div>
                  <div className="text-xs font-bold" style={{ color: theme }}>{p ? `R$ ${(p.price_cents / 100).toFixed(2).replace(".", ",")}` : "R$ 0,00"}</div>
                </div>
              </div>
            ),
          )}
        </div>

        {s.accept_orders !== false && (
          <div className="pt-2">
            <div className="w-full h-9 flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: theme, borderRadius: radius }}>
              Ver carrinho • pagar no PIX
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

