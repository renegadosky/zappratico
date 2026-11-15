import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getCached, setCached } from "@/lib/data-cache";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Save, MessageSquare, ShoppingBag, CreditCard,
  Smartphone, Plus, Trash2, ExternalLink, Copy, Check, Zap, ImageOff,
  Send, Bot as BotIcon, FlaskConical, RotateCcw, FileSpreadsheet, Info
} from "lucide-react";
import { testChatReply } from "@/lib/test-chat.functions";
import { verifyWhatsAppCredentials, selfCheckWebhook, subscribeWaba } from "@/lib/whatsapp-setup.functions";
import { normalizeImageUrl, isLikelyImageUrl } from "@/lib/image-url";
import { Upload } from "lucide-react";
import { MenusManager } from "@/components/MenusManager";
import { MessagesTab as MessagesTabNew } from "@/components/MessagesTab";
import { ProductsImport } from "@/components/ProductsImport";
import { ProductsBulkAdd } from "@/components/ProductsBulkAdd";
import { StoreSiteEditor } from "@/components/StoreSiteEditor";
import { ProductExtrasEditor } from "@/components/ProductExtrasEditor";
import { Image as ImageIcon } from "lucide-react";


export const Route = createFileRoute("/bots_/$botId/edit")({
  component: () => (
    <AppShell>
      <BotEditor />
    </AppShell>
  ),
});

interface Bot {
  id: string; name: string; bot_type: string; segment: string | null;
  tone: string; is_active: boolean;
  greeting_morning: string | null; greeting_afternoon: string | null;
  greeting_evening: string | null; away_message: string | null;
}
interface Product {
  id: string; bot_id: string; user_id: string;
  name: string; description: string | null; price_cents: number;
  image_url: string | null; sort_order: number; is_active: boolean;
  track_stock?: boolean; stock_quantity?: number;
  sku?: string | null; category?: string | null;
}
interface PaymentSettings {
  id?: string; bot_id: string; user_id: string;
  provider: string; pix_key: string | null; pix_key_type: string | null;
  beneficiary_name: string | null; beneficiary_city: string | null;
  mp_access_token: string | null; asaas_api_key: string | null;
  is_enabled: boolean;
}
interface WhatsAppSettings {
  id?: string; bot_id: string; user_id: string;
  phone_number: string | null; store_slug: string | null;
  store_enabled: boolean; store_title: string | null; store_description: string | null;
  buy_message_template: string | null; use_native_catalog: boolean;
}

function BotEditor() {
  const { botId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const cacheKey = `bot:${botId}`;
  const cachedBot = getCached<Bot>(cacheKey);
  const [bot, setBot] = useState<Bot | null>(cachedBot ?? null);
  const [loading, setLoading] = useState(!cachedBot);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("bots").select("*").eq("id", botId).maybeSingle();
        if (cancelled) return;
        if (error) { toast.error(error.message); navigate({ to: "/bots" }); return; }
        if (!data) { toast.error("Bot não encontrado"); navigate({ to: "/bots" }); return; }
        setBot(data as Bot);
        setCached(cacheKey, data);
      } catch (e: any) {
        if (!cancelled && !cachedBot) { toast.error(e?.message ?? "Erro ao carregar"); navigate({ to: "/bots" }); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, user, authLoading]);

  if (authLoading || (loading && !bot)) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <Link to="/bots" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!bot) return null;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <Link to="/bots" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Link>
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-display font-bold">{bot.name}</h1>
          <Badge className={bot.is_active ? "bg-primary/20 text-primary hover:bg-primary/20" : ""}>
            {bot.is_active ? "Ativo" : "Pausado"}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Edite mensagens, catálogo, pagamento e loja do WhatsApp</p>
      </div>

      <Tabs defaultValue="messages">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6">
          <TabsList className="inline-flex md:grid w-auto md:w-full md:grid-cols-5">
            <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Mensagens</span><span className="md:hidden ml-1.5">Msgs</span></TabsTrigger>
            <TabsTrigger value="catalog"><ShoppingBag className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Catálogo</span><span className="md:hidden ml-1.5">Catálogo</span></TabsTrigger>
            <TabsTrigger value="payment"><CreditCard className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Pagamento PIX</span><span className="md:hidden ml-1.5">PIX</span></TabsTrigger>
            <TabsTrigger value="store"><ExternalLink className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Mini-loja</span><span className="md:hidden ml-1.5">Loja</span></TabsTrigger>
            <TabsTrigger value="whatsapp"><Smartphone className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">WhatsApp</span><span className="md:hidden ml-1.5">Zap</span></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="messages"><MessagesTabNew bot={bot} userId={user!.id} onChange={setBot} /></TabsContent>
        <TabsContent value="catalog"><CatalogTab botId={botId} userId={user!.id} /></TabsContent>
        <TabsContent value="payment"><PaymentTab botId={botId} userId={user!.id} /></TabsContent>
        <TabsContent value="store"><StoreSiteEditor botId={botId} userId={user!.id} botName={bot.name} /></TabsContent>
        <TabsContent value="whatsapp"><WhatsAppTab botId={botId} userId={user!.id} botName={bot.name} /></TabsContent>

      </Tabs>
    </div>
  );
}

/* ===== MESSAGES MOVED TO src/components/MessagesTab.tsx ===== */

/* ===== CATALOG ===== */
function CatalogTab({ botId, userId }: { botId: string; userId: string }) {
  return (
    <Tabs defaultValue="products">
      <TabsList className="mb-4">
        <TabsTrigger value="products">Produtos</TabsTrigger>
        <TabsTrigger value="menus">Cardápios</TabsTrigger>
      </TabsList>
      <TabsContent value="products"><ProductsTab botId={botId} userId={userId} /></TabsContent>
      <TabsContent value="menus"><MenusManager botId={botId} userId={userId} /></TabsContent>
    </Tabs>
  );
}

function ProductsTab({ botId, userId }: { botId: string; userId: string }) {
  const cacheKey = `products:${botId}`;
  const cached = getCached<Product[]>(cacheKey);
  const [items, setItems] = useState<Product[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [extras, setExtras] = useState<{ id: string; name: string } | null>(null);


  const load = async () => {
    const { data } = await supabase.from("products").select("*").eq("bot_id", botId).order("sort_order");
    const list = (data as Product[]) ?? [];
    setItems(list);
    setCached(cacheKey, list);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [botId]);

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error("Informe o nome do produto"); return; }
    const normalizedImg = normalizeImageUrl(editing.image_url ?? "");
    const trackStock = editing.track_stock ?? false;
    const payload = {
      bot_id: botId, user_id: userId,
      name: editing.name.trim(),
      description: editing.description ?? null,
      price_cents: Number(editing.price_cents) || 0,
      image_url: normalizedImg || null,
      is_active: editing.is_active ?? true,
      sort_order: editing.sort_order ?? items.length,
      track_stock: trackStock,
      stock_quantity: trackStock ? Math.max(0, Number(editing.stock_quantity) || 0) : 0,
      sku: editing.sku?.trim() || null,
      category: editing.category?.trim() || null,
    };
    const { error } = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Produto salvo"); setEditing(null); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Produto removido"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? "produto" : "produtos"}</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Zap className="h-4 w-4 mr-2" /> Adicionar vários
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Importar planilha
          </Button>
          <Button onClick={() => setEditing({ name: "", description: "", price_cents: 0, is_active: true, track_stock: false, stock_quantity: 0 })} className="bg-gradient-primary text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4 mr-2" /> Novo produto
          </Button>
        </div>
      </div>

      {extras && (
        <ProductExtrasEditor
          open={!!extras}
          onOpenChange={(v) => { if (!v) setExtras(null); }}
          productId={extras.id}
          productName={extras.name}
          userId={userId}
        />
      )}

      <ProductsImport

        open={importOpen}
        onOpenChange={setImportOpen}
        botId={botId}
        userId={userId}
        existingCount={items.length}
        onDone={load}
      />
      <ProductsBulkAdd
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        botId={botId}
        userId={userId}
        existingCount={items.length}
        onDone={load}
      />

      {editing && (
        <div className="bg-surface border border-primary/40 rounded-2xl p-6 space-y-4">
          <h3 className="font-display font-semibold text-lg">{editing.id ? "Editar produto" : "Novo produto"}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Camiseta básica preta" />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$) *</Label>
              <Input type="number" step="0.01" min="0"
                value={editing.price_cents ? (editing.price_cents / 100).toFixed(2) : ""}
                onChange={(e) => setEditing({ ...editing, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                placeholder="49.90" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="100% algodão, modelagem regular..." />
          </div>
          <div className="space-y-2">
            <Label>Imagem do produto (opcional)</Label>
            <ImagePicker
              value={editing.image_url ?? ""}
              userId={userId}
              onChange={(v) => setEditing({ ...editing, image_url: v })}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria (opcional)</Label>
              <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Lanches, Bebidas..." />
            </div>
            <div className="space-y-2">
              <Label>Código / SKU (opcional)</Label>
              <Input value={editing.sku ?? ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} placeholder="CAM-PRT-M" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">Controlar estoque deste produto</div>
                <div className="text-xs text-muted-foreground">Quando zerar, o bot para de oferecer automaticamente.</div>
              </div>
              <Switch
                checked={editing.track_stock ?? false}
                onCheckedChange={(v) => setEditing({ ...editing, track_stock: v })}
              />
            </div>
            {editing.track_stock && (
              <div className="space-y-2">
                <Label>Quantidade disponível</Label>
                <Input
                  type="number" min="0" step="1"
                  value={editing.stock_quantity ?? 0}
                  onChange={(e) => setEditing({ ...editing, stock_quantity: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })}
                />
                <p className="text-xs text-muted-foreground">Cada pedido pago desconta automaticamente.</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
            <Label>Produto ativo (aparece para clientes)</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-surface">
          <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum produto ainda. Adicione o primeiro!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((p) => (
            <div key={p.id} className="bg-surface border border-border rounded-xl p-4 flex gap-3">
              {p.image_url ? (
                <ProductImg src={p.image_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover bg-background flex-shrink-0" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><ShoppingBag className="h-6 w-6 text-primary" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-primary font-display font-bold">R$ {(p.price_cents / 100).toFixed(2).replace(".", ",")}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {!p.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                    {p.track_stock && (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${(p.stock_quantity ?? 0) === 0 ? "bg-destructive/20 text-destructive" : (p.stock_quantity ?? 0) <= 3 ? "bg-yellow-500/20 text-yellow-600" : "bg-primary/10 text-primary"}`}
                      >
                        {(p.stock_quantity ?? 0) === 0 ? "Sem estoque" : `${p.stock_quantity} em estoque`}
                      </Badge>
                    )}
                  </div>
                </div>
                {p.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{p.description}</p>}
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setExtras({ id: p.id, name: p.name })}>
                    <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Fotos e opções
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== PAYMENT ===== */
function PaymentTab({ botId, userId }: { botId: string; userId: string }) {
  const cacheKey = `payment:${botId}`;
  const cached = getCached<PaymentSettings>(cacheKey);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<PaymentSettings>(
    cached ?? {
      bot_id: botId, user_id: userId, provider: "manual",
      pix_key: "", pix_key_type: "email", beneficiary_name: "", beneficiary_city: "",
      mp_access_token: "", asaas_api_key: "", is_enabled: false,
    }
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("payment_settings").select("*").eq("bot_id", botId).maybeSingle();
      if (data) {
        const row = data as PaymentSettings;
        setS({ ...row, provider: "manual" });
        setCached(cacheKey, data);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const pixReady = !!(s.pix_key ?? "").trim() && !!(s.beneficiary_name ?? "").trim();

  const save = async () => {
    if (s.is_enabled && !pixReady) {
      toast.error("Informe a sua chave PIX e o nome do recebedor");
      return;
    }
    setSaving(true);
    const payload = { ...s, provider: "manual", bot_id: botId, user_id: userId };
    const { data, error } = s.id
      ? await supabase.from("payment_settings").update(payload).eq("id", s.id).select().maybeSingle()
      : await supabase.from("payment_settings").insert(payload).select().maybeSingle();
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Pagamento configurado"); if (data) { setS(data as PaymentSettings); setCached(cacheKey, data); } }
  };

  if (loading && !cached) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      {/* Banner explicativo */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold mb-1">PIX direto na sua conta</h3>
            <p className="text-sm text-muted-foreground">
              Informe a sua chave PIX. A cada pedido o bot gera o QR Code e o “copia e cola” com o valor exato,
              e o dinheiro cai direto na sua conta — sem intermediários.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
          <div>
            <Label>Aceitar pagamentos PIX</Label>
            <p className="text-xs text-muted-foreground">Habilite para o bot enviar o QR Code a cada pedido</p>
          </div>
          <Switch checked={s.is_enabled} onCheckedChange={(v) => setS({ ...s, is_enabled: v })} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de chave</Label>
            <select
              value={s.pix_key_type ?? "email"}
              onChange={(e) => setS({ ...s, pix_key_type: e.target.value })}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="random">Chave aleatória</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Chave PIX</Label>
            <Input
              value={s.pix_key ?? ""}
              onChange={(e) => setS({ ...s, pix_key: e.target.value })}
              placeholder="ex: seuemail@gmail.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome do recebedor</Label>
            <Input
              value={s.beneficiary_name ?? ""}
              onChange={(e) => setS({ ...s, beneficiary_name: e.target.value })}
              placeholder="Nome que aparece no banco"
            />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              value={s.beneficiary_city ?? ""}
              onChange={(e) => setS({ ...s, beneficiary_city: e.target.value })}
              placeholder="ex: Fortaleza"
            />
          </div>
        </div>

        <div className={`rounded-lg border p-3 text-xs flex items-start gap-2 ${pixReady ? "border-primary/40 bg-primary/5 text-foreground" : "border-border bg-background/50 text-muted-foreground"}`}>
          {pixReady ? <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" /> : <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />}
          <span>
            {pixReady
              ? "Pronto: o bot gera o QR Code PIX com o valor exato de cada pedido usando a sua chave."
              : "Preencha a chave PIX e o nome do recebedor para o bot conseguir gerar as cobranças."}
          </span>
        </div>

        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar pagamento
        </Button>
      </div>
    </div>
  );
}


/* ===== WHATSAPP (conexão + simulador) ===== */
function WhatsAppTab({ botId, userId, botName }: { botId: string; userId: string; botName: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display font-semibold text-lg">Conectar ao WhatsApp</h3>
        <p className="text-xs text-muted-foreground">
          Configure aqui se quiser que o bot responda automaticamente no WhatsApp dos seus clientes.
          A mini-loja funciona sem isso — ela fica na aba <b>Mini-loja</b>.
        </p>
      </div>
      <SimulatorCard botId={botId} userId={userId} botName={botName} />
      <CloudApiCard botId={botId} userId={userId} />
    </div>
  );
}


function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/* ===== ProductImg with fallback ===== */
function ProductImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  const url = normalizeImageUrl(src);
  if (errored || !url) {
    return (
      <div className={`${className ?? ""} bg-muted/40 flex items-center justify-center text-muted-foreground`}>
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" onError={() => setErrored(true)} />;
}

/* ===== ImagePicker — upload OU url ===== */
function ImagePicker({
  value,
  userId,
  onChange,
}: {
  value: string;
  userId: string;
  onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);


  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (jpg, png, webp ou gif).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const normalized = normalizeImageUrl(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <span className={`inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-muted ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar do dispositivo
          </span>
        </label>
        {value && (
          <Button variant="outline" size="sm" onClick={() => onChange("")}>
            <Trash2 className="h-4 w-4 mr-1" /> Remover
          </Button>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…ou cole o link da imagem (Google, Instagram, etc.)"
      />
      <p className="text-xs text-muted-foreground">
        Aceita upload (jpg, png, webp, gif até 5MB) ou qualquer link de imagem. Links do Google Images são tratados automaticamente.
      </p>
      {value && (
        <div className="mt-1 flex items-center gap-3 p-2 rounded-lg bg-background border border-border">
          <ProductImg src={normalized || value} alt="preview" className="h-20 w-20 rounded-md object-cover" />
          <div className="text-xs text-muted-foreground break-all">
            {isLikelyImageUrl(normalized || value) ? "Pré-visualização" : "Link inválido"}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Cloud API (bot automático) ===== */
interface WaCred {
  id?: string; bot_id: string; user_id: string;
  phone_number_id: string | null; business_account_id: string | null;
  access_token: string | null; verify_token: string | null;
  display_phone_number: string | null; is_connected: boolean;
}
function CloudApiCard({ botId, userId }: { botId: string; userId: string }) {
  const cacheKey = `wacred:${botId}`;
  const cached = getCached<WaCred>(cacheKey);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [c, setC] = useState<WaCred>(
    cached ?? {
      bot_id: botId, user_id: userId,
      phone_number_id: "", business_account_id: "",
      access_token: "", verify_token: randomToken(),
      display_phone_number: "", is_connected: false,
    }
  );
  const [step, setStep] = useState(0);
  const [convCount, setConvCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("whatsapp_credentials").select("*").eq("bot_id", botId).maybeSingle();
      if (data) {
        setC(data as WaCred);
        setCached(cacheKey, data);
        // Se já tem credenciais salvas, pula direto para o passo de teste
        if ((data as WaCred).access_token && (data as WaCred).phone_number_id) setStep(3);
      }
      const { count } = await supabase.from("conversations").select("id", { count: "exact", head: true }).eq("bot_id", botId);
      setConvCount(count ?? 0);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/whatsapp/webhook`
    : "/api/public/whatsapp/webhook";
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyVal = async (key: string, val: string) => {
    await navigator.clipboard.writeText(val);
    setCopiedField(key);
    toast.success("Copiado");
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Validações leves
  const phoneIdInvalid = !!c.phone_number_id && !/^\d{6,}$/.test(c.phone_number_id.trim());
  const tokenInvalid = !!c.access_token && c.access_token.trim().length < 20;

  const save = async () => {
    if (!c.phone_number_id?.trim() || !c.access_token?.trim()) {
      toast.error("Preencha o Phone Number ID e o Access Token");
      return;
    }
    if (phoneIdInvalid) {
      toast.error("Phone Number ID deve ser só números");
      return;
    }
    if (tokenInvalid) {
      toast.error("Access Token parece inválido (muito curto)");
      return;
    }
    if (!c.verify_token?.trim()) { toast.error("Verify Token vazio"); return; }
    setSaving(true);
    const payload = { ...c, bot_id: botId, user_id: userId };
    const { data, error } = c.id
      ? await supabase.from("whatsapp_credentials").update(payload).eq("id", c.id).select().maybeSingle()
      : await supabase.from("whatsapp_credentials").insert(payload).select().maybeSingle();
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: "Verifique os dados e tente novamente." });
      return;
    }
    toast.success("Credenciais salvas com sucesso");
    if (data) { setC(data as WaCred); setCached(cacheKey, data); }
    // Avança para o próximo passo automaticamente
    setStep((s) => Math.min(s + 1, 3));
  };

  const [diag, setDiag] = useState<{ kind: "info" | "ok" | "err"; msg: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const verifyCreds = async () => {
    if (!c.id) { toast.error("Salve primeiro as credenciais"); return; }
    setChecking(true); setDiag(null);
    try {
      const r = await verifyWhatsAppCredentials({ data: { botId } });
      if (r.ok) {
        setDiag({ kind: "ok", msg: `Token válido • Número ${r.displayPhoneNumber ?? "—"} (${r.verifiedName ?? "sem nome verificado"})` });
        setC({ ...c, display_phone_number: r.displayPhoneNumber });
      } else {
        setDiag({ kind: "err", msg: r.reason });
      }
    } catch (e: any) {
      setDiag({ kind: "err", msg: e?.message ?? "Falha ao verificar" });
    } finally { setChecking(false); }
  };

  const checkWebhook = async () => {
    if (!c.id) { toast.error("Salve primeiro"); return; }
    setChecking(true); setDiag(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const r = await selfCheckWebhook({ data: { botId, origin } });
      setDiag({ kind: r.ok ? "ok" : "err", msg: r.reason });
    } catch (e: any) {
      setDiag({ kind: "err", msg: e?.message ?? "Falha" });
    } finally { setChecking(false); }
  };

  const testConnection = async () => {
    if (!c.id) { toast.error("Salve as credenciais antes de testar"); return; }
    setTesting(true); setDiag(null);
    try {
      // 1) Verifica token + phone
      const v = await verifyWhatsAppCredentials({ data: { botId } });
      if (!v.ok) {
        setDiag({ kind: "err", msg: `Credenciais: ${v.reason}` });
        await supabase.from("whatsapp_credentials").update({ is_connected: false }).eq("bot_id", botId);
        setC({ ...c, is_connected: false });
        return;
      }
      // 2) Auto-check do webhook
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const w = await selfCheckWebhook({ data: { botId, origin } });
      if (!w.ok) {
        setDiag({ kind: "err", msg: `Webhook: ${w.reason}` });
        return;
      }
      // 3) Inscreve a WABA no canal messages
      const s = await subscribeWaba({ data: { botId } });
      if (!s.ok) {
        setDiag({ kind: "err", msg: `Inscrição: ${s.reason}` });
        return;
      }
      setC({ ...c, is_connected: true, display_phone_number: v.displayPhoneNumber });
      setDiag({ kind: "ok", msg: `Tudo certo! Bot conectado em ${v.displayPhoneNumber ?? "seu número"}.` });
      toast.success("WhatsApp conectado", { description: "Seu bot já recebe mensagens reais." });
    } catch (e: any) {
      setDiag({ kind: "err", msg: e?.message ?? "Erro inesperado" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="bg-surface border border-border rounded-2xl p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const steps = [
    { label: "Criar app na Meta" },
    { label: "Pegar credenciais" },
    { label: "Configurar webhook" },
    { label: "Testar conexão" },
  ];

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Bot automático no WhatsApp
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Siga os 4 passos abaixo para conectar sua conta WhatsApp Cloud API (Meta).
          </p>
        </div>
        <Badge className={c.is_connected ? "bg-primary/20 text-primary hover:bg-primary/20" : "bg-muted"}>
          {c.is_connected ? "Conectado" : "Desconectado"}
        </Badge>
      </div>

      {convCount !== null && convCount > 0 && (
        <div className="text-sm p-3 rounded-lg bg-primary/10 border border-primary/20">
          💬 <strong>{convCount}</strong> {convCount === 1 ? "conversa registrada" : "conversas registradas"} até agora
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {steps.map((st, idx) => {
          const active = step === idx;
          const done = step > idx || (idx === 3 && c.is_connected);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setStep(idx)}
              className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : done
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                active ? "bg-primary-foreground/20" : done ? "bg-emerald-500/20" : "bg-muted"
              }`}>
                {done ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              {st.label}
            </button>
          );
        })}
      </div>

      {/* PASSO 1 — Criar app na Meta */}
      {step === 0 && (
        <div className="rounded-xl border border-border bg-background p-5 space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            ⚠️ Esse passo é técnico. Se quiser começar sem ele, sua <strong>mini-loja</strong> já funciona — basta configurar acima e compartilhar o link.
          </div>
          <h4 className="font-semibold text-sm">Passo 1 — Criar um app na Meta for Developers</h4>

          <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-3">
            <div className="text-xs text-muted-foreground">
              O link abaixo <strong>precisa ser aberto no seu navegador</strong> (Chrome, Safari, etc.).
              Dentro desta pré-visualização a Meta bloqueia a abertura — clique em <strong>Copiar link</strong> e cole numa aba nova do navegador.
            </div>
            <div className="flex gap-2 items-center">
              <Input readOnly value="https://developers.facebook.com/apps" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button
                onClick={() => copyVal("meta-url", "https://developers.facebook.com/apps")}
                className="bg-gradient-primary text-primary-foreground shadow-glow shrink-0"
              >
                {copiedField === "meta-url" ? <><Check className="h-4 w-4 mr-1" /> Copiado</> : <><Copy className="h-4 w-4 mr-1" /> Copiar link</>}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => {
                const w = window.open("https://developers.facebook.com/apps", "_blank", "noopener,noreferrer");
                if (!w) {
                  copyVal("meta-url", "https://developers.facebook.com/apps");
                  toast.info("Popup bloqueado — o link foi copiado. Cole no seu navegador.");
                }
              }}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> Tentar abrir mesmo assim
            </button>
          </div>


          <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
            <li>Faça login com sua conta do Facebook e clique em <strong>Create App</strong> (Criar App).</li>
            <li>Escolha o tipo <strong>Business</strong> (Empresa) e dê um nome qualquer ao app.</li>
            <li>Dentro do app criado, role a página até achar <strong>WhatsApp</strong> e clique em <strong>Set up</strong>.</li>
            <li>Pronto. Vai abrir uma tela chamada <strong>"API Setup"</strong> com um número de teste e algumas senhas. Não feche.</li>
          </ol>

          <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
            💡 No começo a Meta dá um número de teste e uma senha que dura 24h — serve pra testar. Quando estiver tudo certo, depois você gera uma senha permanente em <strong>Configurações → Usuários do sistema</strong>.
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)} className="bg-gradient-primary text-primary-foreground shadow-glow">
              Já criei o app, continuar →
            </Button>
          </div>
        </div>
      )}

      {/* PASSO 2 — Pegar credenciais */}
      {step === 1 && (
        <div className="rounded-xl border border-border bg-background p-5 space-y-4">
          <h4 className="font-semibold text-sm">Passo 2 — Cole as credenciais que a Meta te deu</h4>
          <p className="text-xs text-muted-foreground">
            Em "API Setup" você verá <strong>Phone Number ID</strong>, <strong>WhatsApp Business Account ID</strong> e um <strong>Access Token</strong>. Cole abaixo:
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone Number ID *</Label>
              <Input
                value={c.phone_number_id ?? ""}
                onChange={(e) => setC({ ...c, phone_number_id: e.target.value })}
                placeholder="123456789012345"
                aria-invalid={phoneIdInvalid || undefined}
                className={phoneIdInvalid ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {phoneIdInvalid && <p className="text-xs text-destructive">Deve conter apenas números.</p>}
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Business Account ID</Label>
              <Input
                value={c.business_account_id ?? ""}
                onChange={(e) => setC({ ...c, business_account_id: e.target.value })}
                placeholder="987654321098765"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Access Token *</Label>
            <Input
              type="password"
              value={c.access_token ?? ""}
              onChange={(e) => setC({ ...c, access_token: e.target.value })}
              placeholder="EAAG..."
              aria-invalid={tokenInvalid || undefined}
              className={tokenInvalid ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {tokenInvalid ? (
              <p className="text-xs text-destructive">Token muito curto — confira se copiou inteiro.</p>
            ) : (
              <p className="text-xs text-muted-foreground">⚠️ O token temporário da Meta dura 24h. Para produção, gere um permanente.</p>
            )}
          </div>

          <div className="flex justify-between flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>← Voltar</Button>
            <div className="flex gap-2">
              <LoadingButton
                onClick={async () => { await save(); await verifyCreds(); }}
                loading={saving || checking}
                loadingText="Verificando..."
                variant="outline"
              >
                <Zap className="h-4 w-4" /> Testar credenciais
              </LoadingButton>
              <LoadingButton
                onClick={save}
                loading={saving}
                loadingText="Salvando..."
                className="bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Save className="h-4 w-4" /> Salvar e continuar
              </LoadingButton>
            </div>
          </div>
          {diag && <DiagBox kind={diag.kind} msg={diag.msg} />}
        </div>
      )}

      {/* PASSO 3 — Webhook */}
      {step === 2 && (
        <div className="rounded-xl border border-border bg-background p-5 space-y-4">
          <h4 className="font-semibold text-sm">Passo 3 — Configurar o webhook na Meta</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
            <li>No painel da Meta, vá em <strong>Configuration → Webhooks</strong> e clique em <strong>Edit</strong>.</li>
            <li>Cole a <strong>Callback URL</strong> e o <strong>Verify Token</strong> abaixo nos campos correspondentes.</li>
            <li>Em "Webhook fields", assine o campo <code className="px-1 bg-muted rounded">messages</code>.</li>
          </ol>

          <div className="space-y-3 rounded-lg bg-muted/40 border border-border p-3">
            <div className="space-y-2">
              <Label className="text-xs">Callback URL</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyVal("url", webhookUrl)}>
                  {copiedField === "url" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Verify Token</Label>
              <div className="flex gap-2">
                <Input value={c.verify_token ?? ""} onChange={(e) => setC({ ...c, verify_token: e.target.value })} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyVal("vt", c.verify_token ?? "")}>
                  {copiedField === "vt" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-between flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>← Voltar</Button>
            <div className="flex gap-2">
              <LoadingButton
                onClick={async () => { await save(); await checkWebhook(); }}
                loading={saving || checking}
                loadingText="Verificando..."
                variant="outline"
              >
                <Zap className="h-4 w-4" /> Verificar webhook
              </LoadingButton>
              <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salvar e continuar →
              </Button>
            </div>
          </div>
          {diag && <DiagBox kind={diag.kind} msg={diag.msg} />}
        </div>
      )}

      {/* PASSO 4 — Testar */}
      {step === 3 && (
        <div className="rounded-xl border border-border bg-background p-5 space-y-4">
          <h4 className="font-semibold text-sm">Passo 4 — Testar a conexão</h4>
          <p className="text-xs text-muted-foreground">
            Vamos consultar a Meta com suas credenciais para confirmar que está tudo certo.
          </p>

          {c.is_connected ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                <Check className="h-5 w-5" />
              </div>
              <div className="text-sm">
                <div className="font-semibold text-emerald-700 dark:text-emerald-400">Conectado!</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Número: <span className="font-mono">{c.display_phone_number ?? "—"}</span>
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  Seu bot já pode receber mensagens reais no WhatsApp.
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Ainda não testamos. Clique em <strong>Testar conexão</strong> para validar.
            </div>
          )}

          <div className="flex justify-between flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>← Voltar</Button>
            <div className="flex gap-2">
              <LoadingButton
                onClick={save}
                loading={saving}
                loadingText="Salvando..."
                variant="outline"
              >
                <Save className="h-4 w-4" /> Salvar mudanças
              </LoadingButton>
              <LoadingButton
                onClick={testConnection}
                loading={testing}
                loadingText="Testando..."
                disabled={!c.id}
                className="bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Zap className="h-4 w-4" /> Testar conexão
              </LoadingButton>
            </div>
          </div>
          {diag && <DiagBox kind={diag.kind} msg={diag.msg} />}
        </div>
      )}
    </div>
  );
}

function DiagBox({ kind, msg }: { kind: "info" | "ok" | "err"; msg: string }) {
  const styles =
    kind === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : kind === "err"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted/40 text-muted-foreground";
  const icon = kind === "ok" ? "✅" : kind === "err" ? "⚠️" : "ℹ️";
  return (
    <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${styles}`}>
      <span className="text-base leading-none">{icon}</span>
      <span className="break-words">{msg}</span>
    </div>
  );
}

function randomToken() {
  const arr = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ===== Simulador de teste (sem Cloud API) ===== */
type SimBlock =
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; caption?: string }
  | { kind: "pix"; text: string; payload?: string; qrUrl?: string };
interface SimMessage { direction: "inbound" | "outbound"; blocks: SimBlock[] }

function SimulatorCard({ botId, userId, botName }: { botId: string; userId: string; botName: string }) {
  const storageKey = `sim:${botId}`;
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(`${storageKey}:on`) === "1";
  });
  const [messages, setMessages] = useState<SimMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(`${storageKey}:msgs`);
      return raw ? (JSON.parse(raw) as SimMessage[]) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(scrollToBottom);
    const timer = window.setTimeout(scrollToBottom, 250);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [messages, sending, enabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${storageKey}:on`, enabled ? "1" : "0");
    }
  }, [enabled, storageKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${storageKey}:msgs`, JSON.stringify(messages.slice(-40)));
    }
  }, [messages, storageKey]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const newMsgs: SimMessage[] = [...messages, { direction: "inbound", blocks: [{ kind: "text", text }] }];
    setMessages(newMsgs);
    setInput("");
    setSending(true);
    try {
      // converte histórico em pares plain p/ a IA
      const flat = newMsgs.slice(-20).flatMap((m) =>
        m.blocks.map((b) => ({
          direction: m.direction,
          content: b.kind === "text" || b.kind === "pix" ? (b as any).text : `[imagem] ${(b as any).caption ?? ""}`,
        })),
      );
      const res = await testChatReply({ data: { botId, history: flat } });
      const blocks: SimBlock[] = (res?.replies ?? [])
        .map((r): SimBlock | null => {
          if (r.type === "text") {
            const t = (r.content ?? "").trim();
            return t ? { kind: "text", text: t } : null;
          }
          if (r.type === "image") {
            const url = (r.url ?? "").trim();
            if (!url) {
              const cap = (r.caption ?? "").trim();
              return cap ? { kind: "text", text: cap } : null;
            }
            return { kind: "image", url, caption: r.caption };
          }
          const t = (r.content ?? "").trim();
          return t ? { kind: "pix", text: t, payload: r.payload, qrUrl: r.qrUrl } : null;
        })
        .filter((b): b is SimBlock => b !== null);
      if (blocks.length === 0) toast.error("Sem resposta da IA");
      else setMessages((m) => [...m, { direction: "outbound", blocks }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar resposta");
    } finally {
      setSending(false);
    }
  };

  const reset = () => setMessages([]);

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 md:p-6 space-y-4 min-w-0 max-w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" /> Modo de teste
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Converse com seu bot aqui mesmo, sem precisar configurar a Cloud API da Meta. No modo de teste o bot não envia PIX — ele simula a conversa e o pedido.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`sim-${botId}`} className="text-xs text-muted-foreground">
            {enabled ? "Ativado" : "Desativado"}
          </Label>
          <Switch id={`sim-${botId}`} checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {enabled && (
        <>
          <div ref={scrollRef} className="rounded-xl border border-border bg-background p-3 h-[28rem] max-h-[58vh] overflow-y-auto overflow-x-hidden scroll-smooth overscroll-contain min-w-0 w-full flex flex-col">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <BotIcon className="h-6 w-6 mx-auto mb-2 opacity-50" />
                Mande uma mensagem para testar o bot. Tente: "oi, qual o cardápio?"
              </div>
            ) : (
              <div className="space-y-2 pr-1 mt-auto">
                {messages.map((m, i) =>
                  m.blocks.map((b, j) => (
                    <SimBubble key={`${i}-${j}`} dir={m.direction} block={b} botName={botName} />
                  )),
                )}
                {sending && (
                  <div className="flex w-full justify-start">
                    <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> digitando…
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 min-w-0">
            <Input
              className="min-w-0 flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Digite como se fosse um cliente…"
              disabled={sending}
            />
            <Button onClick={send} disabled={sending || !input.trim()} className="shrink-0 bg-gradient-primary text-primary-foreground shadow-glow">
              {sending ? <Loader2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={reset} disabled={sending || messages.length === 0} title="Limpar conversa" className="shrink-0">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SimBubble({ dir, block, botName }: { dir: "inbound" | "outbound"; block: SimBlock; botName: string }) {
  const [copied, setCopied] = useState(false);
  const isUser = dir === "inbound";
  const row = `flex w-full ${isUser ? "justify-end" : "justify-start"}`;
  const base = `max-w-[82%] min-w-0 rounded-2xl text-sm whitespace-pre-wrap break-words ${
    isUser ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
  }`;

  if (block.kind === "image") {
    return (
      <div className={row}>
        <div className={`${base} p-1 w-64 max-w-full overflow-hidden`}>
          {!isUser && <div className="text-[10px] font-semibold opacity-60 px-2 pt-1 pb-1">{botName}</div>}
          <img
            src={block.url}
            alt=""
            loading="lazy"
            className="w-full h-auto rounded-xl block bg-background"
          />
          {block.caption && <div className="px-2 py-2 break-words">{block.caption}</div>}
        </div>
      </div>
    );
  }


  if (block.kind === "pix") {
    const text = (block.text ?? "").trim();
    return (
      <div className={row}>
        <div className={`${base} px-3 py-2 space-y-2 overflow-hidden`}>
          {!isUser && <div className="text-[10px] font-semibold opacity-60">{botName}</div>}
          {text && <div className="whitespace-pre-wrap">{text}</div>}
          {block.qrUrl && (
            <img src={block.qrUrl} alt="QR Code PIX" className="w-40 h-40 rounded-lg bg-white p-1 self-center" />
          )}
          {block.payload && (
            <div className="rounded-lg bg-background/60 border border-border/40 p-2 min-w-0">
              <div className="text-[10px] uppercase opacity-60 mb-1">PIX copia e cola</div>
              <code className="text-[10px] break-all block max-h-28 overflow-y-auto">{block.payload}</code>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(block.payload!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}
          </div>
      </div>
    );
  }

  const text = (block.text ?? "").trim();
  if (!text) return null;
  return (
    <div className={row}>
      <div className={`${base} px-3 py-2 overflow-hidden`}>
        {!isUser && <div className="text-[10px] font-semibold opacity-60 mb-0.5">{botName}</div>}
        {text}
      </div>
    </div>
  );
}
