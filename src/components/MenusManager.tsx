import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, BookOpen, ArrowLeft,
  Save, Loader2, FileText, Sparkles, Palette,
} from "lucide-react";
import { MenuVisualEditor, type MenuVisualEditorHandle } from "@/components/MenuVisualEditor";


interface Menu {
  id: string; bot_id: string; user_id: string;
  name: string; description: string | null;
  is_active: boolean; sort_order: number; template_slug: string | null;
}
interface MenuItem {
  id: string; menu_id: string; product_id: string; user_id: string;
  sort_order: number; price_override_cents: number | null; note: string | null;
}
interface Product {
  id: string; name: string; price_cents: number; image_url: string | null; is_active: boolean;
}
interface MenuTemplate {
  id: string; slug: string; name: string; description: string | null;
  segment: string | null; icon: string | null; suggested_items: string[];
}

export function MenusManager({ botId, userId }: { botId: string; userId: string }) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("menus").select("*").eq("bot_id", botId)
      .order("sort_order").order("created_at");
    setMenus((data as Menu[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [botId]);

  const removeMenu = async (id: string) => {
    if (!confirm("Excluir este cardápio? Os produtos continuam cadastrados.")) return;
    const { error } = await supabase.from("menus").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Cardápio excluído"); load(); }
  };

  const toggleActive = async (m: Menu) => {
    const { error } = await supabase.from("menus").update({ is_active: !m.is_active }).eq("id", m.id);
    if (error) toast.error(error.message);
    else load();
  };

  if (openMenuId) {
    return (
      <MenuEditor
        menuId={openMenuId}
        botId={botId}
        userId={userId}
        onBack={() => { setOpenMenuId(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <MenuDeliveryPicker botId={botId} />

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {menus.length} {menus.length === 1 ? "cardápio" : "cardápios"}
        </p>
        <Button onClick={() => setCreateOpen(true)} className="bg-gradient-primary text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo cardápio
        </Button>
      </div>


      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : menus.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-surface">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-1">Você ainda não tem cardápios</p>
          <p className="text-xs text-muted-foreground/80">Organize seus produtos em seções como Almoço, Combos, Bebidas…</p>
          <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-4">
            <Sparkles className="h-4 w-4 mr-2" /> Começar com um modelo
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {menus.map((m) => (
            <MenuCard
              key={m.id}
              menu={m}
              onOpen={() => setOpenMenuId(m.id)}
              onToggle={() => toggleActive(m)}
              onRemove={() => removeMenu(m.id)}
            />
          ))}
        </div>
      )}

      <CreateMenuDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        botId={botId}
        userId={userId}
        onCreated={(id) => { setCreateOpen(false); setOpenMenuId(id); load(); }}
      />
    </div>
  );
}

function MenuDeliveryPicker({ botId }: { botId: string }) {
  const [mode, setMode] = useState<"auto" | "image" | "list">("auto");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bots").select("menu_delivery").eq("id", botId).maybeSingle();
      const v = (data as any)?.menu_delivery;
      if (v === "auto" || v === "image" || v === "list") setMode(v);
      setLoaded(true);
    })();
  }, [botId]);

  const save = async (next: "auto" | "image" | "list") => {
    setMode(next);
    setSaving(true);
    const { error } = await supabase.from("bots").update({ menu_delivery: next } as any).eq("id", botId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Modo de envio salvo");
  };

  const options: { v: "auto" | "image" | "list"; title: string; desc: string }[] = [
    { v: "auto", title: "Automático", desc: "Envia a imagem se existir, senão lista por texto." },
    { v: "image", title: "Sempre imagem", desc: "O bot manda a imagem do cardápio gerada aqui." },
    { v: "list", title: "Sempre lista", desc: "O bot escreve os itens em texto (sem imagem)." },
  ];

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display font-semibold text-sm">Como o bot envia o cardápio no WhatsApp</div>
          <div className="text-xs text-muted-foreground">Vale para quando o cliente pedir "cardápio", "menu", "o que vocês têm"…</div>
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {options.map((o) => {
          const active = mode === o.v;
          return (
            <button
              key={o.v}
              type="button"
              disabled={!loaded}
              onClick={() => save(o.v)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}
            >
              <div className="text-sm font-medium">{o.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{o.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function MenuCard({
  menu, onOpen, onToggle, onRemove,
}: { menu: Menu; onOpen: () => void; onToggle: () => void; onRemove: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancel = false;
    supabase.from("menu_items").select("id", { count: "exact", head: true })
      .eq("menu_id", menu.id)
      .then(({ count }) => { if (!cancel) setCount(count ?? 0); });
    return () => { cancel = true; };
  }, [menu.id]);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2 hover-lift">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-semibold truncate">{menu.name}</span>
          </div>
          {menu.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{menu.description}</p>
          )}
        </button>
        {!menu.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground">
          {count === null ? "…" : `${count} ${count === 1 ? "item" : "itens"}`}
        </span>
        <div className="flex items-center gap-2">
          <Switch checked={menu.is_active} onCheckedChange={onToggle} />
          <Button size="sm" variant="ghost" onClick={onOpen}>Abrir</Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateMenuDialog({
  open, onOpenChange, botId, userId, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  botId: string; userId: string; onCreated: (id: string) => void;
}) {
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("menu_templates").select("*").order("name")
      .then(({ data }) => setTemplates((data as MenuTemplate[]) ?? []));
  }, [open]);

  const createBlank = async () => {
    if (!name.trim()) { toast.error("Dê um nome para o cardápio"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("menus")
      .insert({ bot_id: botId, user_id: userId, name: name.trim() })
      .select("id").maybeSingle();
    setSaving(false);
    if (error || !data) { toast.error(error?.message ?? "Erro ao criar"); return; }
    setName("");
    toast.success("Cardápio criado");
    onCreated(data.id);
  };

  const createFromTemplate = async (t: MenuTemplate) => {
    setSaving(true);
    const { data, error } = await supabase.from("menus")
      .insert({
        bot_id: botId, user_id: userId,
        name: t.name, description: t.description,
        template_slug: t.slug,
      }).select("id").maybeSingle();
    setSaving(false);
    if (error || !data) { toast.error(error?.message ?? "Erro ao criar"); return; }
    toast.success(`Cardápio "${t.name}" criado`);
    onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo cardápio</DialogTitle>
          <DialogDescription>
            Crie em branco ou comece a partir de um modelo pronto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Cardápio em branco</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Combos da casa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createBlank(); }}
            />
            <Button onClick={createBlank} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <Label className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Modelos prontos
          </Label>
          <div className="grid sm:grid-cols-2 gap-2">
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground col-span-2 py-4 text-center">
                Carregando modelos…
              </p>
            ) : templates.map((t) => (
              <button
                key={t.id}
                disabled={saving}
                onClick={() => createFromTemplate(t)}
                className="text-left bg-background border border-border rounded-lg p-3 hover:border-primary/60 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.icon ?? "📋"}</span>
                  <span className="font-semibold">{t.name}</span>
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                )}
                {t.suggested_items?.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                    Sugestões: {t.suggested_items.slice(0, 3).join(", ")}
                    {t.suggested_items.length > 3 ? "…" : ""}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MenuEditor({
  menuId, botId, userId, onBack,
}: { menuId: string; botId: string; userId: string; onBack: () => void }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const visualRef = useRef<MenuVisualEditorHandle | null>(null);

  const load = async () => {
    const [m, it, ps] = await Promise.all([
      supabase.from("menus").select("*").eq("id", menuId).maybeSingle(),
      supabase.from("menu_items").select("*").eq("menu_id", menuId).order("sort_order"),
      supabase.from("products").select("id,name,price_cents,image_url,is_active").eq("bot_id", botId).order("name"),
    ]);
    setMenu((m.data as Menu) ?? null);
    setItems((it.data as MenuItem[]) ?? []);
    setProducts((ps.data as Product[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [menuId]);

  const saveEverything = async () => {
    if (!menu) return;
    setSaving(true);
    try {
      // 1) Salva conteúdo (nome, descrição, ativo)
      const { error } = await supabase.from("menus").update({
        name: menu.name, description: menu.description, is_active: menu.is_active,
      }).eq("id", menu.id);
      if (error) throw error;

      // 2) Salva visual + gera imagem do WhatsApp
      const visualOk = visualRef.current ? await visualRef.current.saveAll() : false;

      if (visualOk) {
        toast.success("Cardápio salvo! A imagem já está pronta para o WhatsApp.");
      } else {
        toast.warning("Cardápio salvo, mas a imagem não foi gerada (adicione itens ao cardápio).");
      }


    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[idx]; const b = items[j];
    const next = [...items];
    next[idx] = { ...b, sort_order: a.sort_order };
    next[j] = { ...a, sort_order: b.sort_order };
    // swap sort_order values
    const newOrderA = b.sort_order;
    const newOrderB = a.sort_order;
    // ensure distinct values: if same, reindex on the fly
    const reindex = newOrderA === newOrderB;
    if (reindex) {
      next.forEach((it, i) => { it.sort_order = i; });
    }
    setItems(next.sort((x, y) => x.sort_order - y.sort_order));
    if (reindex) {
      await Promise.all(next.map((it) =>
        supabase.from("menu_items").update({ sort_order: it.sort_order }).eq("id", it.id)
      ));
    } else {
      await Promise.all([
        supabase.from("menu_items").update({ sort_order: newOrderA }).eq("id", a.id),
        supabase.from("menu_items").update({ sort_order: newOrderB }).eq("id", b.id),
      ]);
    }
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const updateItem = async (id: string, patch: Partial<MenuItem>) => {
    const { error } = await supabase.from("menu_items").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  if (loading || !menu) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  const usedIds = new Set(items.map((i) => i.product_id));
  const available = products.filter((p) => !usedIds.has(p.id));
  const productById = (id: string) => products.find((p) => p.id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button onClick={saveEverything} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Salvando…" : "Salvar cardápio"}
        </Button>

      </div>

      <Tabs defaultValue="content" className="w-full">
        <TabsList>
          <TabsTrigger value="content"><FileText className="h-4 w-4 mr-1.5" /> Conteúdo</TabsTrigger>
          <TabsTrigger value="visual"><Palette className="h-4 w-4 mr-1.5" /> Visual</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4 mt-4">
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do cardápio *</Label>
                <Input value={menu.name} onChange={(e) => setMenu({ ...menu, name: e.target.value })} />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={menu.is_active} onCheckedChange={(v) => setMenu({ ...menu, is_active: v })} />
                  <Label>Ativo na loja</Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                rows={2}
                value={menu.description ?? ""}
                onChange={(e) => setMenu({ ...menu, description: e.target.value })}
                placeholder="Pratos servidos das 11h às 15h…"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="font-display font-semibold">Itens do cardápio</h4>
            <Button
              onClick={() => setAddOpen(true)}
              disabled={available.length === 0}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar produto
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-surface">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum item ainda. Adicione produtos ao cardápio.</p>
              {products.length === 0 && (
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Cadastre produtos primeiro na aba "Produtos".
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it, idx) => {
                const p = productById(it.product_id);
                const finalCents = it.price_override_cents ?? p?.price_cents ?? 0;
                return (
                  <li key={it.id} className="bg-surface border border-border rounded-xl p-3 flex gap-3 items-center">
                    <div className="flex flex-col">
                      <button
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => move(idx, -1)}
                        aria-label="Mover para cima"
                      ><ChevronUp className="h-4 w-4" /></button>
                      <button
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === items.length - 1}
                        onClick={() => move(idx, 1)}
                        aria-label="Mover para baixo"
                      ><ChevronDown className="h-4 w-4" /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p?.name ?? "(produto removido)"}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>R$ {(finalCents / 100).toFixed(2).replace(".", ",")}</span>
                        {it.price_override_cents != null && p && it.price_override_cents !== p.price_cents && (
                          <Badge variant="secondary" className="text-[10px]">preço alterado</Badge>
                        )}
                        {it.note && <span className="truncate">· {it.note}</span>}
                      </div>
                    </div>
                    <ItemEditPopover item={it} product={p} onSave={(patch) => updateItem(it.id, patch)} />
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(it.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <AddItemDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            available={available}
            onAdd={async (productId, price_override_cents, note) => {
              const { error } = await supabase.from("menu_items").insert({
                menu_id: menuId, product_id: productId, user_id: userId,
                sort_order: items.length,
                price_override_cents, note,
              });
              if (error) toast.error(error.message);
              else { setAddOpen(false); load(); }
            }}
          />
        </TabsContent>

        {/* forceMount para que o editor visual mantenha os dados carregados
            e a imagem possa ser gerada a partir de qualquer aba */}
        <TabsContent
          value="visual"
          forceMount
          className="mt-4 data-[state=inactive]:hidden"
        >
          <MenuVisualEditor ref={visualRef} menuId={menuId} />
        </TabsContent>


      </Tabs>
    </div>
  );
}

function ItemEditPopover({
  item, product, onSave,
}: {
  item: MenuItem;
  product?: Product;
  onSave: (patch: Partial<MenuItem>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(
    item.price_override_cents != null ? (item.price_override_cents / 100).toFixed(2) : ""
  );
  const [note, setNote] = useState(item.note ?? "");

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Editar</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar item</DialogTitle>
            <DialogDescription>
              Sobrescreva o preço só para este cardápio ou adicione uma observação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>
                Preço neste cardápio (R$)
                {product && (
                  <span className="text-xs text-muted-foreground ml-2">
                    padrão: R$ {(product.price_cents / 100).toFixed(2).replace(".", ",")}
                  </span>
                )}
              </Label>
              <Input
                type="number" step="0.01" min="0"
                placeholder="Deixe em branco para usar o padrão"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Acompanha refrigerante" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const cents = price.trim() === "" ? null : Math.round(parseFloat(price) * 100);
                onSave({ price_override_cents: cents, note: note.trim() || null });
                setOpen(false);
              }}
              className="bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddItemDialog({
  open, onOpenChange, available, onAdd,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  available: Product[];
  onAdd: (productId: string, priceOverrideCents: number | null, note: string | null) => void;
}) {
  const [productId, setProductId] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) { setProductId(""); setPrice(""); setNote(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar produto ao cardápio</DialogTitle>
          <DialogDescription>
            Escolha um produto já cadastrado. Você pode ajustar o preço só para este cardápio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
              <SelectContent>
                {available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — R$ {(p.price_cents / 100).toFixed(2).replace(".", ",")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Preço neste cardápio (opcional)</Label>
            <Input
              type="number" step="0.01" min="0"
              placeholder="Deixe em branco para usar o padrão"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: combo com fritas" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!productId}
            onClick={() => {
              const cents = price.trim() === "" ? null : Math.round(parseFloat(price) * 100);
              onAdd(productId, cents, note.trim() || null);
            }}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4 mr-2" /> Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
