import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Palette, Image as ImageIcon, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { renderMenuPoster } from "@/lib/menu-poster";


export interface MenuVisualEditorHandle {
  saveAll: () => Promise<boolean>;
}

export interface MenuTheme {
  primary: string;
  background: string;
  text: string;
  accent: string;
}

const DEFAULT_THEME: MenuTheme = {
  primary: "#c2410c",
  background: "#fef3c7",
  text: "#1c1917",
  accent: "#0f766e",
};

interface MenuVisual {
  id: string;
  name: string;
  subtitle: string | null;
  template_slug: string | null;
  theme: MenuTheme | null;
  header_image_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
}

interface MenuItem {
  id: string;
  product_id: string;
  sort_order: number;
  price_override_cents: number | null;
  note: string | null;
}

const TEMPLATES = [
  { slug: "classic", name: "Clássico", theme: { primary: "#1e293b", background: "#fafaf9", text: "#1c1917", accent: "#c2410c" } },
  { slug: "modern", name: "Moderno", theme: { primary: "#0ea5e9", background: "#0f172a", text: "#f8fafc", accent: "#f59e0b" } },
  { slug: "restaurant", name: "Restaurante", theme: { primary: "#c2410c", background: "#fef3c7", text: "#1c1917", accent: "#0f766e" } },
];

export const MenuVisualEditor = forwardRef<MenuVisualEditorHandle, { menuId: string }>(function MenuVisualEditor({ menuId }, ref) {
  const [menu, setMenu] = useState<MenuVisual | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: m } = await supabase
        .from("menus")
        .select("id, name, subtitle, template_slug, theme, header_image_url, logo_url, cover_image_url, bot_id")
        .eq("id", menuId)
        .maybeSingle();
      if (!m || cancelled) { setLoading(false); return; }
      const { data: its } = await supabase
        .from("menu_items").select("*").eq("menu_id", menuId).order("sort_order");
      const itemList = (its as MenuItem[]) ?? [];
      const productIds = itemList.map((i) => i.product_id);
      const { data: prods } = productIds.length
        ? await supabase.from("products").select("*").in("id", productIds)
        : { data: [] as Product[] };
      const map: Record<string, Product> = {};
      (prods as Product[] ?? []).forEach((p) => { map[p.id] = p; });
      if (cancelled) return;
      const mm = m as Record<string, unknown>;
      setMenu({
        id: mm.id as string,
        name: mm.name as string,
        subtitle: (mm.subtitle as string | null) ?? null,
        template_slug: (mm.template_slug as string | null) ?? "restaurant",
        theme: (mm.theme as MenuTheme | null) ?? DEFAULT_THEME,
        header_image_url: (mm.header_image_url as string | null) ?? null,
        logo_url: (mm.logo_url as string | null) ?? null,
        cover_image_url: (mm.cover_image_url as string | null) ?? null,
      });
      setItems(itemList);
      setProducts(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [menuId]);

  const update = (patch: Partial<MenuVisual>) => {
    if (!menu) return;
    setMenu({ ...menu, ...patch });
  };

  const applyTemplate = (slug: string) => {
    const t = TEMPLATES.find((x) => x.slug === slug);
    if (!t) return;
    update({ template_slug: slug, theme: t.theme });
  };

  const [generating, setGenerating] = useState(false);

  const generateImage = async (): Promise<string | null> => {
    if (!menu) return null;
    if (items.length === 0) {
      toast.error("Adicione itens ao cardápio antes de gerar a imagem");
      return null;
    }

    const blob = await renderMenuPoster({
      title: menu.name,
      subtitle: menu.subtitle,
      template: menu.template_slug,
      theme: menu.theme ?? DEFAULT_THEME,
      logoUrl: menu.logo_url,
      headerImageUrl: menu.header_image_url,
      lines: items
        .map((it) => {
          const p = products[it.product_id];
          if (!p) return null;
          return {
            name: p.name,
            priceCents: it.price_override_cents ?? p.price_cents,
            note: it.note,
          };
        })
        .filter(Boolean) as { name: string; priceCents: number; note: string | null }[],
    });

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? "anon";
    const path = `${uid}/menus/${menu.id}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(path, blob, { contentType: "image/png", upsert: true, cacheControl: "3600" });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    return pub.publicUrl;
  };


  const saveAll = async (): Promise<boolean> => {
    if (!menu) return false;
    setGenerating(true);
    try {
      const { error } = await supabase
        .from("menus")
        .update({
          subtitle: menu.subtitle,
          template_slug: menu.template_slug,
          theme: menu.theme as unknown as Record<string, string>,
          header_image_url: menu.header_image_url,
          logo_url: menu.logo_url,
        })
        .eq("id", menu.id);
      if (error) throw error;

      if (items.length === 0) {
        toast.error("Adicione itens ao cardápio para gerar a imagem do WhatsApp.");
        return false;
      }

      const url = await generateImage();
      if (!url) return false;
      const { error: updErr } = await supabase
        .from("menus")
        .update({ cover_image_url: url })
        .eq("id", menu.id);
      if (updErr) throw updErr;
      setMenu({ ...menu, cover_image_url: url });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar a imagem do cardápio");
      return false;
    } finally {
      setGenerating(false);
    }
  };

  useImperativeHandle(ref, () => ({ saveAll }), [menu, items]);




  if (loading || !menu) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  const theme = menu.theme ?? DEFAULT_THEME;

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-5">
      {/* Painel de controle */}
      <div className="space-y-4">
        <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Palette className="h-4 w-4 text-primary" /> Modelo
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => {
              const active = menu.template_slug === t.slug;
              return (
                <button
                  key={t.slug}
                  onClick={() => applyTemplate(t.slug)}
                  className={`p-2 rounded-lg border-2 transition-all text-xs font-medium ${active ? "border-primary" : "border-border hover:border-primary/40"}`}
                  style={{ background: t.theme.background, color: t.theme.text }}
                >
                  <div className="h-6 rounded mb-1" style={{ background: t.theme.primary }} />
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <Label className="text-sm">Conteúdo</Label>
          <div className="space-y-2">
            <Input value={menu.name} disabled placeholder="Nome do cardápio" />
            <Textarea
              rows={2}
              value={menu.subtitle ?? ""}
              onChange={(e) => update({ subtitle: e.target.value })}
              placeholder="Subtítulo (ex: das 18h às 23h)"
            />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <Label className="text-sm">Cores</Label>
          <ColorRow label="Fundo" value={theme.background} onChange={(v) => update({ theme: { ...theme, background: v } })} />
          <ColorRow label="Texto" value={theme.text} onChange={(v) => update({ theme: { ...theme, text: v } })} />
          <ColorRow label="Destaque" value={theme.primary} onChange={(v) => update({ theme: { ...theme, primary: v } })} />
          <ColorRow label="Detalhe" value={theme.accent} onChange={(v) => update({ theme: { ...theme, accent: v } })} />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon className="h-4 w-4 text-primary" /> Imagens
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL da imagem de capa</Label>
            <Input value={menu.header_image_url ?? ""} onChange={(e) => update({ header_image_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL do logo</Label>
            <Input value={menu.logo_url ?? ""} onChange={(e) => update({ logo_url: e.target.value })} placeholder="https://…" />
          </div>
        </div>

        {generating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando imagem do cardápio…
          </div>
        )}





        {!menu.cover_image_url ? (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-medium text-foreground mb-0.5">Imagem do WhatsApp ainda não gerada</div>
                <p className="text-muted-foreground">
                  Clique em <b>"Salvar cardápio"</b> no topo da página. Enquanto isso, quando o cliente pedir "cardápio" o bot só lista os itens em texto.
                </p>

              </div>
            </div>
          </div>
        ) : (
          <div className="bg-primary/5 border border-primary/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-medium text-foreground mb-0.5">Imagem pronta ✓</div>
                <p className="text-muted-foreground">
                  Quando o cliente pedir "cardápio", o bot envia essa imagem. Se mudar algo, salve de novo no topo pra regerar.
                </p>
              </div>
            </div>
            <a
              href={menu.cover_image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Ver imagem atual <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-background border border-border rounded-2xl p-4 lg:p-6 overflow-auto">
        <div ref={canvasRef}>
          <MenuCanvas menu={menu} items={items} products={products} />
        </div>
      </div>
    </div>
  );
});

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs flex-1">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 rounded border border-border cursor-pointer bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-20 px-2 text-xs rounded border border-border bg-background font-mono"
      />
    </div>
  );
}

function MenuCanvas({ menu, items, products }: { menu: MenuVisual; items: MenuItem[]; products: Record<string, Product> }) {
  const theme = menu.theme ?? DEFAULT_THEME;
  const template = menu.template_slug ?? "restaurant";

  // Render based on template
  return (
    <div
      className="mx-auto rounded-xl overflow-hidden shadow-xl"
      style={{
        background: theme.background,
        color: theme.text,
        maxWidth: 520,
        aspectRatio: "9/12",
        fontFamily: "Georgia, serif",
      }}
    >
      {/* Header */}
      <div
        className="px-6 pt-6 pb-4 relative"
        style={template === "restaurant" ? { background: theme.primary, color: "#fff" } : {}}
      >
        {menu.logo_url && (
          <img src={menu.logo_url} alt="" className="h-10 w-10 rounded-full object-cover mb-2" />
        )}
        <div className="text-[11px] uppercase tracking-[0.3em] opacity-80" style={{ color: template === "restaurant" ? "#fff" : theme.accent }}>
          Cardápio
        </div>
        <div className="text-4xl font-bold leading-tight" style={{ color: template === "restaurant" ? "#fff" : theme.primary }}>
          {menu.name}
        </div>
        {menu.subtitle && (
          <div className="text-sm mt-1 opacity-90">{menu.subtitle}</div>
        )}
      </div>

      {menu.header_image_url && (
        <div className="w-full" style={{ height: 140 }}>
          <img src={menu.header_image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Items */}
      <div className="px-6 py-5 space-y-3 overflow-hidden">
        {items.length === 0 && (
          <div className="text-center text-sm opacity-60 py-8">
            Adicione produtos na aba "Itens" para vê-los aqui
          </div>
        )}
        {items.map((it) => {
          const p = products[it.product_id];
          if (!p) return null;
          const cents = it.price_override_cents ?? p.price_cents;
          return (
            <div key={it.id} className="flex items-baseline gap-2">
              <div className="font-semibold text-sm whitespace-nowrap" style={{ color: theme.primary }}>{p.name}</div>
              <div
                className="flex-1 border-b border-dotted opacity-40"
                style={{ borderColor: theme.text }}
              />
              <div className="font-bold text-sm" style={{ color: theme.accent }}>
                R$ {(cents / 100).toFixed(2).replace(".", ",")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-3 text-center text-[10px] uppercase tracking-widest"
        style={{ background: theme.accent, color: "#fff" }}
      >
        Bom apetite
      </div>
    </div>
  );
}
