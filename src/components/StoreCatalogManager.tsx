import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, ChevronUp, ChevronDown, ShoppingBag, FolderPlus, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { normalizeImageUrl } from "@/lib/image-url";

interface ProductRow {
  id: string; name: string; description: string | null; price_cents: number;
  image_url: string | null; is_active: boolean; track_stock: boolean; stock_quantity: number;
}
interface CategoryRow { id: string; name: string; description: string | null; is_active: boolean; sort_order: number }
interface StoreProductRow {
  id: string; product_id: string; category_id: string | null;
  price_override_cents: number | null; is_available: boolean; is_featured: boolean; sort_order: number;
}

const NO_CATEGORY = "__none__";

function money(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Catálogo da Mini-loja: grupos (categorias) e quais produtos já cadastrados
 * aparecem na loja pública, com ordem e disponibilidade.
 */
export function StoreCatalogManager({
  botId, userId, onChange,
}: {
  botId: string; userId: string; onChange?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [entries, setEntries] = useState<StoreProductRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickerCategory, setPickerCategory] = useState<string>(NO_CATEGORY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [prodRes, catRes, spRes] = await Promise.all([
      supabase.from("products").select("id, name, description, price_cents, image_url, is_active, track_stock, stock_quantity").eq("bot_id", botId).order("sort_order"),
      supabase.from("store_categories").select("id, name, description, is_active, sort_order").eq("bot_id", botId).order("sort_order"),
      supabase.from("store_products").select("id, product_id, category_id, price_override_cents, is_available, is_featured, sort_order").eq("bot_id", botId).order("sort_order"),
    ]);
    setProducts((prodRes.data as ProductRow[]) ?? []);
    setCategories((catRes.data as CategoryRow[]) ?? []);
    setEntries((spRes.data as StoreProductRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [botId]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const inStoreIds = useMemo(() => new Set(entries.map((e) => e.product_id)), [entries]);

  const notify = () => onChange?.();

  /* ---------- categorias ---------- */
  const addCategory = async () => {
    const { data, error } = await supabase.from("store_categories").insert({
      bot_id: botId, user_id: userId, name: "Novo grupo", is_active: true, sort_order: categories.length,
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (data) { setCategories((prev) => [...prev, data as CategoryRow]); notify(); }
  };

  const patchCategory = async (id: string, patch: Partial<CategoryRow>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("store_categories").update(patch).eq("id", id);
    if (error) toast.error(error.message); else notify();
  };

  const removeCategory = async (id: string) => {
    const { error } = await supabase.from("store_categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setEntries((prev) => prev.map((e) => (e.category_id === id ? { ...e, category_id: null } : e)));
    notify();
  };

  const moveCategory = async (index: number, dir: -1 | 1) => {
    const next = [...categories];
    const t = index + dir;
    if (t < 0 || t >= next.length) return;
    [next[index], next[t]] = [next[t], next[index]];
    setCategories(next);
    await Promise.all(next.map((c, i) => supabase.from("store_categories").update({ sort_order: i }).eq("id", c.id)));
    notify();
  };

  /* ---------- produtos da loja ---------- */
  const addPicked = async () => {
    if (picked.size === 0) { setPickerOpen(false); return; }
    setSaving(true);
    const base = entries.length;
    const rows = [...picked].map((product_id, i) => ({
      bot_id: botId, user_id: userId, product_id,
      category_id: pickerCategory === NO_CATEGORY ? null : pickerCategory,
      is_available: true, is_featured: false, sort_order: base + i,
    }));
    const { error } = await supabase.from("store_products").upsert(rows, { onConflict: "bot_id,product_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(picked.size === 1 ? "Produto adicionado à loja" : `${picked.size} produtos adicionados`);
    setPicked(new Set());
    setPickerOpen(false);
    await load();
    notify();
  };

  const patchEntry = async (id: string, patch: Partial<StoreProductRow>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from("store_products").update(patch).eq("id", id);
    if (error) toast.error(error.message); else notify();
  };

  const removeEntry = async (id: string) => {
    const { error } = await supabase.from("store_products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    notify();
  };

  const moveEntry = async (id: string, dir: -1 | 1, scoped: StoreProductRow[]) => {
    const index = scoped.findIndex((e) => e.id === id);
    const t = index + dir;
    if (index < 0 || t < 0 || t >= scoped.length) return;
    const reordered = [...scoped];
    [reordered[index], reordered[t]] = [reordered[t], reordered[index]];
    const orderMap = new Map(reordered.map((e, i) => [e.id, i]));
    setEntries((prev) =>
      prev.map((e) => (orderMap.has(e.id) ? { ...e, sort_order: orderMap.get(e.id)! } : e)),
    );
    await Promise.all(reordered.map((e, i) => supabase.from("store_products").update({ sort_order: i }).eq("id", e.id)));
    notify();
  };

  const groupsToRender = [
    ...categories.map((c) => ({ id: c.id, name: c.name })),
    { id: NO_CATEGORY, name: "Sem grupo" },
  ];

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* GRUPOS */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-semibold">Grupos da loja</h3>
            <p className="text-xs text-muted-foreground">Ex.: Hambúrgueres, Bebidas, Sobremesas. A ordem aqui é a ordem na loja.</p>
          </div>
          <Button size="sm" variant="outline" onClick={addCategory}><FolderPlus className="h-4 w-4 mr-1.5" /> Novo grupo</Button>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Sem grupos ainda — os produtos aparecem numa lista única.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => moveCategory(i, -1)} className="text-muted-foreground hover:text-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveCategory(i, 1)} className="text-muted-foreground hover:text-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                <Input value={c.name} onChange={(e) => patchCategory(c.id, { name: e.target.value })} className="h-9" />
                <Switch checked={c.is_active} onCheckedChange={(v) => patchCategory(c.id, { is_active: v })} />
                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeCategory(c.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PRODUTOS DA LOJA */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-semibold">Produtos da loja</h3>
            <p className="text-xs text-muted-foreground">
              {entries.length === 0 ? "Escolha entre os produtos que você já cadastrou." : `${entries.length} ${entries.length === 1 ? "produto" : "produtos"} na Mini-loja`}
            </p>
          </div>
          <Button size="sm" onClick={() => setPickerOpen(true)} className="bg-gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-1.5" /> Adicionar produto
          </Button>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-xl">
            <ShoppingBag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum produto na Mini-loja ainda.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupsToRender.map((g) => {
              const scoped = entries
                .filter((e) => (g.id === NO_CATEGORY ? !e.category_id : e.category_id === g.id))
                .sort((a, b) => a.sort_order - b.sort_order);
              if (scoped.length === 0) return null;
              return (
                <div key={g.id} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.name}</div>
                  {scoped.map((e) => {
                    const p = productById.get(e.product_id);
                    if (!p) return null;
                    const price = e.price_override_cents ?? p.price_cents;
                    const soldOut = p.track_stock && p.stock_quantity <= 0;
                    return (
                      <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
                        <div className="flex flex-col">
                          <button type="button" onClick={() => moveEntry(e.id, -1, scoped)} className="text-muted-foreground hover:text-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => moveEntry(e.id, 1, scoped)} className="text-muted-foreground hover:text-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
                        </div>
                        {p.image_url ? (
                          <img src={normalizeImageUrl(p.image_url) ?? p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover bg-background" />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center"><ShoppingBag className="h-5 w-5 text-primary" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate flex items-center gap-2">
                            {p.name}
                            {soldOut && <Badge variant="secondary" className="bg-destructive/20 text-destructive text-xs">Esgotado</Badge>}
                            {!p.is_active && <Badge variant="secondary" className="text-xs">Produto inativo</Badge>}
                          </div>
                          <div className="text-sm text-primary font-medium">{money(price)}</div>
                        </div>
                        <Select
                          value={e.category_id ?? NO_CATEGORY}
                          onValueChange={(v) => patchEntry(e.id, { category_id: v === NO_CATEGORY ? null : v })}
                        >
                          <SelectTrigger className="h-9 w-[150px] shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CATEGORY}>Sem grupo</SelectItem>
                            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5 shrink-0" title="Disponível na loja">
                          <Switch checked={e.is_available} onCheckedChange={(v) => patchEntry(e.id, { is_available: v })} />
                        </div>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeEntry(e.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: escolher produtos existentes */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar produtos à Mini-loja</DialogTitle>
            <DialogDescription>Marque os produtos que já estão cadastrados. Nome, preço, descrição e foto vêm do próprio produto.</DialogDescription>
          </DialogHeader>

          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Você ainda não cadastrou produtos. Cadastre em Catálogo → Produtos.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Colocar no grupo</Label>
                <Select value={pickerCategory} onValueChange={setPickerCategory}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sem grupo</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-[45vh] overflow-y-auto space-y-1.5 pr-1">
                {products.map((p) => {
                  const already = inStoreIds.has(p.id);
                  const checked = picked.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={already}
                      onClick={() => setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                        return next;
                      })}
                      className={`w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                        already ? "opacity-50 border-border" : checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary" : "border-input"}`}>
                        {(checked || already) && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                      </div>
                      {p.image_url ? (
                        <img src={normalizeImageUrl(p.image_url) ?? p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center"><ShoppingBag className="h-4 w-4 text-primary" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{money(p.price_cents)}{already ? " • já está na loja" : ""}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancelar</Button>
            <Button onClick={addPicked} disabled={saving || picked.size === 0} className="bg-gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Adicionar {picked.size > 0 ? `(${picked.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
