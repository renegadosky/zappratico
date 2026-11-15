import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ShoppingBag, MessageCircle, ImageOff, MapPin, Clock, Instagram, Phone, Music2,
  Plus, Minus, ShoppingCart, X, Check, Copy, ArrowLeft, ChevronRight,
} from "lucide-react";
import { normalizeImageUrl } from "@/lib/image-url";
import { toast } from "sonner";
import {
  parseLayout, buttonRadius, gapClass, columnsClass, imageAspectClass, isOpenNow,
  type StoreLayout,
} from "@/lib/store-theme";

export const Route = createFileRoute("/loja/$slug")({
  head: () => ({
    meta: [
      { title: "Loja online — monte seu pedido e pague no PIX" },
      { name: "description", content: "Veja os produtos, monte seu pedido e pague na hora pelo PIX, sem precisar de WhatsApp." },
      { property: "og:title", content: "Loja online — monte seu pedido e pague no PIX" },
      { property: "og:description", content: "Veja os produtos, monte seu pedido e pague na hora pelo PIX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicStore,
});

function money(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

interface Store {
  bot_id: string; phone_number: string | null; store_title: string | null;
  store_description: string | null;
  logo_url: string | null; cover_url: string | null;
  theme_color: string | null; accent_color: string | null; secondary_color: string | null;
  text_color: string | null; button_style: string | null; layout_json: any;
  font_family: string | null; address: string | null; hours_json: any;
  instagram_url: string | null; tiktok_url: string | null;
  contact_buttons: any; require_address: boolean; accept_orders: boolean;
}
interface Product {
  id: string; name: string; description: string | null; price_cents: number;
  image_url: string | null; track_stock: boolean; stock_quantity: number;
}
interface CategoryRow { id: string; name: string; description: string | null; sort_order: number }
interface StoreProductRow {
  product_id: string; category_id: string | null; price_override_cents: number | null; sort_order: number;
}
interface ImageRow { id: string; product_id: string; url: string; sort_order: number }
interface OptionGroup {
  id: string; product_id: string; name: string; is_required: boolean; min_select: number; max_select: number; sort_order: number;
}
interface OptionRow { id: string; group_id: string; name: string; price_cents: number; is_available: boolean; sort_order: number }

interface CartOption { option_id: string; name: string; price_cents: number }
interface CartLine {
  key: string; product_id: string; name: string; base_cents: number;
  options: CartOption[]; quantity: number; note: string | null;
}

const DAYS = [
  { key: "mon", label: "Segunda" }, { key: "tue", label: "Terça" }, { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" }, { key: "fri", label: "Sexta" }, { key: "sat", label: "Sábado" }, { key: "sun", label: "Domingo" },
];

function normalizeIg(v: string | null) {
  if (!v) return null;
  return v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "")}`;
}
function normalizeTt(v: string | null) {
  if (!v) return null;
  return v.startsWith("http") ? v : `https://tiktok.com/@${v.replace(/^@/, "")}`;
}

function StoreImg({ src, alt, aspect }: { src: string; alt: string; aspect: string }) {
  const [errored, setErrored] = useState(false);
  const url = normalizeImageUrl(src);
  if (errored || !url) {
    return (
      <div className={`w-full ${aspect} bg-black/10 flex items-center justify-center opacity-40`}>
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setErrored(true)} className={`w-full ${aspect} object-cover bg-black/5`} />;
}

function lineUnit(l: CartLine) {
  return l.base_cents + l.options.reduce((s, o) => s + o.price_cents, 0);
}

function PublicStore() {
  const { slug } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [entries, setEntries] = useState<StoreProductRow[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);

  const [detail, setDetail] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<"cart" | "form" | "pix">("cart");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkout, setCheckout] = useState<{
    order_id: string; code: string | null; total_cents: number; status: string;
    pix: { payload: string; qr_url: string | null; key?: string | null; holder?: string | null } | null;
    whatsapp: string | null;
  } | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ws } = await supabase
        .from("whatsapp_settings")
        .select("bot_id, phone_number, store_title, store_description, logo_url, cover_url, theme_color, accent_color, secondary_color, text_color, button_style, layout_json, font_family, address, hours_json, instagram_url, tiktok_url, contact_buttons, require_address, accept_orders")
        .eq("store_slug", slug).eq("store_enabled", true).maybeSingle();
      if (!ws) { setLoading(false); return; }
      setStore(ws as unknown as Store);
      const botId = (ws as any).bot_id as string;

      const [prodRes, catRes, spRes] = await Promise.all([
        supabase.from("products").select("id, name, description, price_cents, image_url, track_stock, stock_quantity").eq("bot_id", botId).eq("is_active", true).order("sort_order"),
        supabase.from("store_categories").select("id, name, description, sort_order").eq("bot_id", botId).eq("is_active", true).order("sort_order"),
        supabase.from("store_products").select("product_id, category_id, price_override_cents, sort_order").eq("bot_id", botId).eq("is_available", true).order("sort_order"),
      ]);
      const prods = (prodRes.data as Product[]) ?? [];
      setProducts(prods);
      setCategories((catRes.data as CategoryRow[]) ?? []);
      setEntries((spRes.data as StoreProductRow[]) ?? []);

      const ids = prods.map((p) => p.id);
      if (ids.length > 0) {
        const [imgRes, grpRes, optRes] = await Promise.all([
          supabase.from("product_images").select("id, product_id, url, sort_order").in("product_id", ids).order("sort_order"),
          supabase.from("product_option_groups").select("id, product_id, name, is_required, min_select, max_select, sort_order").in("product_id", ids).order("sort_order"),
          supabase.from("product_options").select("id, group_id, name, price_cents, is_available, sort_order").eq("is_available", true).order("sort_order"),
        ]);
        setImages((imgRes.data as ImageRow[]) ?? []);
        const g = (grpRes.data as OptionGroup[]) ?? [];
        setGroups(g);
        const gids = new Set(g.map((x) => x.id));
        setOptions(((optRes.data as OptionRow[]) ?? []).filter((o) => gids.has(o.group_id)));
      }
      setLoading(false);
    })();
  }, [slug]);

  const layout: StoreLayout = useMemo(() => parseLayout(store?.layout_json), [store]);
  const cartTotal = useMemo(() => cart.reduce((s, l) => s + lineUnit(l) * l.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const priceOf = useCallback(
    (id: string) => {
      const e = entries.find((x) => x.product_id === id);
      return e?.price_override_cents ?? productById.get(id)?.price_cents ?? 0;
    },
    [entries, productById],
  );

  /** Grupos exibidos: usa store_products quando existir; senão, todos os produtos ativos. */
  const sections = useMemo(() => {
    if (entries.length === 0) {
      return [{ id: "all", name: "", description: null as string | null, items: products }];
    }
    const bucket = (catId: string | null) =>
      entries
        .filter((e) => (catId === null ? !e.category_id : e.category_id === catId))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((e) => productById.get(e.product_id))
        .filter(Boolean) as Product[];
    const out = categories.map((c) => ({ id: c.id, name: c.name, description: c.description, items: bucket(c.id) }));
    const loose = bucket(null);
    if (loose.length > 0) out.push({ id: "none", name: categories.length > 0 ? "Outros" : "", description: null, items: loose });
    return out.filter((s) => s.items.length > 0);
  }, [entries, categories, products, productById]);

  const addLine = useCallback((p: Product, chosen: CartOption[], qty: number, note: string | null, unitBase: number) => {
    const key = `${p.id}|${chosen.map((o) => o.option_id).sort().join(",")}|${note ?? ""}`;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + qty) };
        return next;
      }
      return [...prev, { key, product_id: p.id, name: p.name, base_cents: unitBase, options: chosen, quantity: Math.min(99, qty), note }];
    });
    toast.success(`${p.name} no carrinho`);
  }, []);

  const changeQty = (key: string, delta: number) => {
    setCart((prev) => {
      const next = prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l));
      return next.filter((l) => l.quantity > 0).map((l) => ({ ...l, quantity: Math.min(99, l.quantity) }));
    });
  };

  // Acompanha o pagamento enquanto a tela do PIX está aberta
  useEffect(() => {
    if (!checkout?.order_id || !checkout.code || paid) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/public/store/checkout?id=${checkout.order_id}&code=${encodeURIComponent(checkout.code!)}`);
        const json = await res.json();
        if (!stop && json?.status && json.status !== "pending") { setPaid(true); setCart([]); }
      } catch { /* silencioso */ }
    };
    const id = setInterval(tick, 6000);
    tick();
    return () => { stop = true; clearInterval(id); };
  }, [checkout?.order_id, checkout?.code, paid]);

  const submitOrder = async () => {
    if (name.trim().length < 2) { toast.error("Informe seu nome."); return; }
    if (phone.replace(/\D/g, "").length < 10) { toast.error("Informe um telefone válido com DDD."); return; }
    if (store?.require_address && address.trim().length < 5) { toast.error("Informe o endereço de entrega."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          address: address.trim() || undefined,
          note: orderNote.trim() || undefined,
          items: cart.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            note: l.note ?? undefined,
            option_ids: l.options.map((o) => o.option_id),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Não foi possível finalizar o pedido.");
      setCheckout(json);
      setStep("pix");
      setPaid(json.status === "paid");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao finalizar o pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  const theme = store?.theme_color || "#10b981";
  const bg = store?.accent_color || "#0f172a";
  const surface = store?.secondary_color || "rgba(255,255,255,0.05)";
  const fg = store?.text_color || "#ffffff";
  const radius = buttonRadius(store?.button_style);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-2xl font-display font-bold">Loja não encontrada</h1>
          <p className="text-muted-foreground mt-2">Esta loja pode ter sido desativada ou o link está incorreto.</p>
        </div>
      </div>
    );
  }

  const fontClass = store.font_family === "serif" ? "font-serif" : store.font_family === "display" ? "font-display" : "font-sans";
  const buttons = (store.contact_buttons ?? { whatsapp: true }) as Record<string, boolean>;
  const phoneDigits = (store.phone_number || "").replace(/\D/g, "");
  const hours = (store.hours_json ?? {}) as Record<string, { open: string; close: string; closed?: boolean } | undefined>;
  const hasHours = DAYS.some((d) => hours[d.key]);
  const openNow = isOpenNow(hours);
  const canOrder = store.accept_orders !== false;

  const aspect = imageAspectClass(layout.image);
  const compact = layout.card === "compact";

  const ProductTile = ({ p }: { p: Product }) => {
    const price = priceOf(p.id);
    const soldOut = p.track_stock && p.stock_quantity <= 0;
    const inCart = cart.filter((l) => l.product_id === p.id).reduce((s, l) => s + l.quantity, 0);
    if (layout.mode === "list") {
      return (
        <button type="button" onClick={() => setDetail(p)} className="w-full text-left flex gap-3 items-center p-3 border" style={{ background: surface, borderColor: "rgba(255,255,255,0.08)", borderRadius: radius }}>
          <div className="h-20 w-20 shrink-0 overflow-hidden" style={{ borderRadius: radius }}>
            {p.image_url ? <StoreImg src={p.image_url} alt={p.name} aspect="aspect-square" /> : <div className="w-full aspect-square flex items-center justify-center opacity-40"><ShoppingBag className="h-6 w-6" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            {p.description && <div className="text-sm opacity-70 line-clamp-2">{p.description}</div>}
            <div className="font-bold mt-1" style={{ color: theme }}>{soldOut ? "Esgotado" : money(price)}</div>
          </div>
          <div className="shrink-0 flex items-center gap-1 text-sm opacity-70">
            {inCart > 0 && <span className="px-2 py-0.5 text-xs font-semibold" style={{ background: theme, color: "#fff", borderRadius: radius }}>{inCart}</span>}
            <ChevronRight className="h-4 w-4" />
          </div>
        </button>
      );
    }
    return (
      <button type="button" onClick={() => setDetail(p)} className="text-left overflow-hidden border flex flex-col" style={{ background: surface, borderColor: "rgba(255,255,255,0.08)", borderRadius: radius }}>
        {p.image_url ? <StoreImg src={p.image_url} alt={p.name} aspect={aspect} /> : (
          <div className={`w-full ${aspect} flex items-center justify-center opacity-40`}><ShoppingBag className="h-10 w-10" /></div>
        )}
        <div className={compact ? "p-3" : "p-4"}>
          <h3 className={`font-semibold ${compact ? "text-sm" : ""} line-clamp-2`}>{p.name}</h3>
          {!compact && p.description && <p className="text-sm opacity-70 line-clamp-2 mt-1">{p.description}</p>}
          <div className={`font-bold mt-2 ${compact ? "text-base" : "text-xl"}`} style={{ color: theme }}>
            {soldOut ? "Esgotado" : money(price)}
          </div>
          {inCart > 0 && <div className="text-xs mt-1 opacity-70">{inCart} no carrinho</div>}
        </div>
      </button>
    );
  };

  return (
    <div className={`min-h-screen ${fontClass}`} style={{ background: bg, color: fg }}>
      <header className="relative">
        {store.cover_url ? (
          <img src={normalizeImageUrl(store.cover_url) ?? store.cover_url} alt="" className="w-full aspect-[3/1] md:aspect-[4/1] object-cover" />
        ) : (
          <div className="w-full aspect-[3/1] md:aspect-[4/1]" style={{ background: `linear-gradient(135deg, ${theme}, ${bg})` }} />
        )}
        {store.logo_url && (
          <img src={normalizeImageUrl(store.logo_url) ?? store.logo_url} alt="" className="absolute left-4 md:left-8 -bottom-10 md:-bottom-12 h-20 w-20 md:h-24 md:w-24 object-cover border-4" style={{ borderColor: bg, borderRadius: radius }} />
        )}
      </header>

      <div className={`max-w-5xl mx-auto px-4 ${store.logo_url ? "pt-14 md:pt-16" : "pt-6"} pb-4 space-y-3`}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">{store.store_title || "Nossa loja"}</h1>
          {openNow !== null && (
            <span className="text-xs font-semibold px-2.5 py-1" style={{ borderRadius: radius, background: openNow ? theme : "rgba(255,255,255,0.12)", color: openNow ? "#fff" : fg }}>
              {openNow ? "Aberto agora" : "Fechado agora"}
            </span>
          )}
        </div>
        {store.store_description && <p className="opacity-80">{store.store_description}</p>}
        {store.address && <div className="flex items-start gap-2 text-sm opacity-80"><MapPin className="h-4 w-4 mt-0.5 shrink-0" />{store.address}</div>}

        <div className="flex flex-wrap gap-2 pt-2">
          {buttons.whatsapp !== false && phoneDigits && (
            <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-medium text-white" style={{ background: theme, borderRadius: radius }}>
              <MessageCircle className="h-4 w-4" /> Falar pelo WhatsApp
            </a>
          )}
          {store.instagram_url && buttons.instagram !== false && (
            <a href={normalizeIg(store.instagram_url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-medium bg-white/10 hover:bg-white/15" style={{ borderRadius: radius }}><Instagram className="h-4 w-4" /> Instagram</a>
          )}
          {store.tiktok_url && (
            <a href={normalizeTt(store.tiktok_url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-medium bg-white/10 hover:bg-white/15" style={{ borderRadius: radius }}><Music2 className="h-4 w-4" /> TikTok</a>
          )}
          {buttons.call && phoneDigits && (
            <a href={`tel:+${phoneDigits}`} className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-medium bg-white/10 hover:bg-white/15" style={{ borderRadius: radius }}><Phone className="h-4 w-4" /> Ligar</a>
          )}
        </div>

        {hasHours && (
          <details className="pt-2">
            <summary className="cursor-pointer inline-flex items-center gap-1.5 text-sm opacity-80 hover:opacity-100"><Clock className="h-4 w-4" /> Horário de funcionamento</summary>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm opacity-80">
              {DAYS.map((d) => {
                const h = hours[d.key];
                return <div key={d.key} className="flex justify-between"><span>{d.label}</span><span className="font-mono text-xs">{!h || h.closed ? "Fechado" : `${h.open}–${h.close}`}</span></div>;
              })}
            </div>
          </details>
        )}
      </div>

      {/* CATÁLOGO */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-10 pb-36">
        {sections.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/15 rounded-2xl">
            <ShoppingBag className="h-10 w-10 opacity-50 mx-auto mb-3" />
            <p className="opacity-70">Nenhum produto por aqui ainda.</p>
            {phoneDigits && (
              <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-4 px-4 h-10 text-sm font-medium text-white" style={{ background: theme, borderRadius: radius }}>
                <MessageCircle className="h-4 w-4" /> Fale com a gente
              </a>
            )}
          </div>
        ) : (
          sections.map((sec) => (
            <section key={sec.id} id={`grupo-${sec.id}`}>
              {sec.name && <h2 className="text-2xl font-bold mb-1">{sec.name}</h2>}
              {sec.description && <p className="text-sm opacity-70 mb-3">{sec.description}</p>}
              <div className={layout.mode === "list" ? `grid grid-cols-1 ${gapClass(layout.gap)}` : `grid grid-cols-1 ${columnsClass(layout.columns)} ${gapClass(layout.gap)}`}>
                {sec.items.map((p) => <ProductTile key={`${sec.id}-${p.id}`} p={p} />)}
              </div>
            </section>
          ))
        )}
      </main>

      {/* DETALHE DO PRODUTO */}
      {detail && (
        <ProductDetail
          product={detail}
          price={priceOf(detail.id)}
          gallery={[detail.image_url, ...images.filter((i) => i.product_id === detail.id).map((i) => i.url)].filter(Boolean) as string[]}
          groups={groups.filter((g) => g.product_id === detail.id).sort((a, b) => a.sort_order - b.sort_order)}
          options={options}
          theme={theme} bg={bg} surface={surface} fg={fg} radius={radius}
          canOrder={canOrder}
          onClose={() => setDetail(null)}
          onAdd={(chosen, qty, note, unitBase) => { addLine(detail, chosen, qty, note, unitBase); setDetail(null); }}
        />
      )}

      {/* BARRA DO CARRINHO */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4">
          <button
            onClick={() => { setCartOpen(true); setStep("cart"); }}
            className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 h-14 font-semibold text-white shadow-2xl"
            style={{ background: theme, borderRadius: radius }}
          >
            <span className="inline-flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> {cartCount} {cartCount === 1 ? "item" : "itens"}</span>
            <span>{money(cartTotal)} • Ver carrinho</span>
          </button>
        </div>
      )}

      {/* CARRINHO / CHECKOUT / PIX */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto border" style={{ background: bg, color: fg, borderColor: "rgba(255,255,255,0.12)", borderRadius: radius }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="flex items-center gap-2">
                {step !== "cart" && step !== "pix" && (
                  <button onClick={() => setStep("cart")} className="opacity-70 hover:opacity-100"><ArrowLeft className="h-5 w-5" /></button>
                )}
                <h2 className="font-bold text-lg">
                  {step === "cart" ? "Seu pedido" : step === "form" ? "Seus dados" : paid ? "Pagamento recebido" : "Pagamento por PIX"}
                </h2>
              </div>
              <button onClick={() => setCartOpen(false)} className="opacity-70 hover:opacity-100"><X className="h-5 w-5" /></button>
            </div>

            {step === "cart" && (
              <div className="p-4 space-y-3">
                {cart.length === 0 ? (
                  <p className="text-center py-8 opacity-70">Seu carrinho está vazio.</p>
                ) : (
                  <>
                    {cart.map((l) => (
                      <div key={l.key} className="flex gap-3 items-start p-3 border" style={{ background: surface, borderColor: "rgba(255,255,255,0.08)", borderRadius: radius }}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{l.name}</div>
                          {l.options.length > 0 && (
                            <div className="text-xs opacity-70">{l.options.map((o) => o.name).join(", ")}</div>
                          )}
                          {l.note && <div className="text-xs opacity-70 italic">“{l.note}”</div>}
                          <div className="text-sm font-semibold mt-1" style={{ color: theme }}>{money(lineUnit(l) * l.quantity)}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => changeQty(l.key, -1)} className="h-8 w-8 inline-flex items-center justify-center bg-white/10" style={{ borderRadius: radius }}><Minus className="h-4 w-4" /></button>
                          <span className="w-6 text-center font-semibold">{l.quantity}</span>
                          <button onClick={() => changeQty(l.key, 1)} className="h-8 w-8 inline-flex items-center justify-center bg-white/10" style={{ borderRadius: radius }}><Plus className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 text-lg font-bold">
                      <span>Total</span><span style={{ color: theme }}>{money(cartTotal)}</span>
                    </div>
                    <button onClick={() => setCartOpen(false)} className="w-full h-11 font-medium bg-white/10" style={{ borderRadius: radius }}>Continuar comprando</button>
                    {canOrder ? (
                      <button onClick={() => setStep("form")} className="w-full h-12 font-semibold text-white" style={{ background: theme, borderRadius: radius }}>
                        Finalizar pedido
                      </button>
                    ) : (
                      <p className="text-sm text-center opacity-80">
                        A loja está com os pedidos pausados no momento.
                        {phoneDigits && <> Fale com a gente pelo <a className="underline" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>.</>}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {step === "form" && (
              <div className="p-4 space-y-3">
                <label className="block text-sm">
                  Seu nome
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar?"
                    className="mt-1 w-full h-11 px-3 bg-black/25 border border-white/10 outline-none focus:ring-2 focus:ring-white/20" style={{ borderRadius: radius }} />
                </label>
                <label className="block text-sm">
                  WhatsApp / telefone
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(11) 99999-9999"
                    className="mt-1 w-full h-11 px-3 bg-black/25 border border-white/10 outline-none focus:ring-2 focus:ring-white/20" style={{ borderRadius: radius }} />
                </label>
                {store.require_address && (
                  <label className="block text-sm">
                    Endereço de entrega
                    <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro"
                      className="mt-1 w-full h-11 px-3 bg-black/25 border border-white/10 outline-none focus:ring-2 focus:ring-white/20" style={{ borderRadius: radius }} />
                  </label>
                )}
                <label className="block text-sm">
                  Observação (opcional)
                  <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value.slice(0, 300))} rows={2} placeholder="Ponto de referência, troco, etc."
                    className="mt-1 w-full px-3 py-2 bg-black/25 border border-white/10 outline-none focus:ring-2 focus:ring-white/20" style={{ borderRadius: radius }} />
                </label>
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span>Total</span><span style={{ color: theme }}>{money(cartTotal)}</span>
                </div>
                <button onClick={submitOrder} disabled={submitting} className="w-full h-12 font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: theme, borderRadius: radius }}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Pagar com PIX
                </button>
              </div>
            )}

            {step === "pix" && checkout && (
              <div className="p-4 space-y-4">
                {paid ? (
                  <div className="text-center py-6">
                    <div className="h-14 w-14 mx-auto rounded-full flex items-center justify-center" style={{ background: theme }}><Check className="h-7 w-7 text-white" /></div>
                    <h3 className="text-xl font-bold mt-3">Pagamento confirmado!</h3>
                    <p className="opacity-80 mt-1">Pedido {checkout.code ? `#${checkout.code}` : ""} recebido. Já avisamos a loja.</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-sm opacity-70">Pedido {checkout.code ? `#${checkout.code}` : ""}</div>
                      <div className="text-3xl font-bold mt-1" style={{ color: theme }}>{money(checkout.total_cents)}</div>
                    </div>
                    {checkout.pix ? (
                      <>
                        {checkout.pix.qr_url && (
                          <img src={checkout.pix.qr_url} alt="QR Code do PIX" className="mx-auto h-56 w-56 bg-white p-2" style={{ borderRadius: radius }} />
                        )}
                        {checkout.pix.holder && (
                          <div className="text-center text-sm opacity-80">Recebedor: {checkout.pix.holder}</div>
                        )}
                        <button
                          onClick={async () => { await navigator.clipboard.writeText(checkout.pix!.payload); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
                          className="w-full h-12 font-semibold text-white inline-flex items-center justify-center gap-2"
                          style={{ background: theme, borderRadius: radius }}
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Chave copiada!" : "Copiar código PIX"}
                        </button>
                        <p className="text-xs opacity-70 text-center">
                          Abra o app do seu banco, escolha PIX → Copia e cola e finalize. A confirmação aparece aqui automaticamente quando a loja recebe.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-center opacity-80">
                        Esta loja ainda não configurou o PIX. Seu pedido foi registrado
                        {checkout.whatsapp ? " — combine o pagamento pelo WhatsApp." : " — a loja vai entrar em contato."}
                      </p>
                    )}
                    <Link
                      to="/pedido/$orderId"
                      params={{ orderId: checkout.order_id }}
                      search={{ code: checkout.code ?? "" }}
                      className="block w-full h-11 font-medium bg-white/10 inline-flex items-center justify-center"
                      style={{ borderRadius: radius }}
                    >
                      Acompanhar meu pedido
                    </Link>
                    {checkout.whatsapp && (
                      <a href={`https://wa.me/${checkout.whatsapp}?text=${encodeURIComponent(`Olá! Fiz o pedido ${checkout.code ? `#${checkout.code}` : ""} pela loja online.`)}`} target="_blank" rel="noopener noreferrer" className="block text-center text-sm underline opacity-80">
                        Falar com a loja pelo WhatsApp
                      </a>
                    )}
                  </>
                )}
                {paid && (
                  <Link to="/pedido/$orderId" params={{ orderId: checkout.order_id }} search={{ code: checkout.code ?? "" }} className="block w-full h-11 font-medium text-white inline-flex items-center justify-center" style={{ background: theme, borderRadius: radius }}>
                    Acompanhar meu pedido
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= DETALHE DO PRODUTO ================= */
function ProductDetail({
  product, price, gallery, groups, options, theme, bg, surface, fg, radius, canOrder, onClose, onAdd,
}: {
  product: Product; price: number; gallery: string[];
  groups: OptionGroup[]; options: OptionRow[];
  theme: string; bg: string; surface: string; fg: string; radius: string;
  canOrder: boolean;
  onClose: () => void;
  onAdd: (chosen: CartOption[], qty: number, note: string | null, unitBase: number) => void;
}) {
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [chosen, setChosen] = useState<Record<string, string[]>>({});

  const soldOut = product.track_stock && product.stock_quantity <= 0;
  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const toggle = (g: OptionGroup, optionId: string) => {
    setChosen((prev) => {
      const cur = prev[g.id] ?? [];
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((x) => x !== optionId) };
      if (g.max_select <= 1) return { ...prev, [g.id]: [optionId] };
      if (cur.length >= g.max_select) { toast.error(`Escolha até ${g.max_select} em ${g.name}`); return prev; }
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  };

  const chosenList: CartOption[] = Object.values(chosen).flat().map((id) => {
    const o = optionById.get(id);
    return { option_id: id, name: o?.name ?? "", price_cents: o?.price_cents ?? 0 };
  });
  const unit = price + chosenList.reduce((s, o) => s + o.price_cents, 0);

  const add = () => {
    for (const g of groups) {
      const count = (chosen[g.id] ?? []).length;
      if (g.is_required && count < Math.max(1, g.min_select)) {
        toast.error(`Escolha em “${g.name}”`);
        return;
      }
    }
    onAdd(chosenList, qty, note.trim() || null, price);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto border" style={{ background: bg, color: fg, borderColor: "rgba(255,255,255,0.12)", borderRadius: radius }}>
        <div className="relative">
          {gallery.length > 0 ? (
            <StoreImg src={gallery[active]} alt={product.name} aspect="aspect-square sm:aspect-[4/3]" />
          ) : (
            <div className="w-full aspect-square sm:aspect-[4/3] flex items-center justify-center opacity-40"><ShoppingBag className="h-12 w-12" /></div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 h-9 w-9 inline-flex items-center justify-center bg-black/60 text-white" style={{ borderRadius: radius }}><X className="h-5 w-5" /></button>
        </div>

        {gallery.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {gallery.map((g, i) => (
              <button key={`${g}-${i}`} onClick={() => setActive(i)} className={`h-16 w-16 shrink-0 overflow-hidden border-2 ${i === active ? "" : "opacity-60"}`} style={{ borderColor: i === active ? theme : "transparent", borderRadius: radius }}>
                <img src={normalizeImageUrl(g) ?? g} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-2xl font-bold">{product.name}</h2>
            <div className="text-2xl font-bold mt-1" style={{ color: theme }}>{money(price)}</div>
            {soldOut && <div className="text-sm mt-1 font-semibold text-red-400">Esgotado no momento</div>}
          </div>
          {product.description && <p className="opacity-80 whitespace-pre-line">{product.description}</p>}

          {groups.map((g) => {
            const opts = options.filter((o) => o.group_id === g.id).sort((a, b) => a.sort_order - b.sort_order);
            if (opts.length === 0) return null;
            const cur = chosen[g.id] ?? [];
            return (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-xs opacity-70">{g.is_required ? "Obrigatório" : g.max_select > 1 ? `até ${g.max_select}` : "opcional"}</div>
                </div>
                <div className="space-y-1.5">
                  {opts.map((o) => {
                    const on = cur.includes(o.id);
                    return (
                      <button key={o.id} type="button" onClick={() => toggle(g, o.id)} className="w-full flex items-center gap-3 p-3 border text-left" style={{ background: on ? `${theme}22` : surface, borderColor: on ? theme : "rgba(255,255,255,0.08)", borderRadius: radius }}>
                        <div className="h-5 w-5 shrink-0 border flex items-center justify-center" style={{ borderColor: on ? theme : "rgba(255,255,255,0.3)", background: on ? theme : "transparent", borderRadius: g.max_select > 1 ? "0.25rem" : "9999px" }}>
                          {on && <Check className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <span className="flex-1">{o.name}</span>
                        {o.price_cents > 0 && <span className="text-sm opacity-80">+ {money(o.price_cents)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <label className="block text-sm">
            Observação
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} placeholder="Ex.: sem cebola"
              className="mt-1 w-full h-11 px-3 bg-black/25 border border-white/10 outline-none focus:ring-2 focus:ring-white/20" style={{ borderRadius: radius }} />
          </label>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 inline-flex items-center justify-center bg-white/10" style={{ borderRadius: radius }}><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center font-bold text-lg">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(99, q + 1))} className="h-11 w-11 inline-flex items-center justify-center bg-white/10" style={{ borderRadius: radius }}><Plus className="h-4 w-4" /></button>
            </div>
            <button
              onClick={add}
              disabled={soldOut || !canOrder}
              className="flex-1 h-12 font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: theme, borderRadius: radius }}
            >
              <Plus className="h-4 w-4" /> {soldOut ? "Esgotado" : `Adicionar • ${money(unit * qty)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
