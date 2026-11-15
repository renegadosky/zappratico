import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, Upload, Image as ImageIcon, GripVertical, ChevronUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { normalizeImageUrl } from "@/lib/image-url";
import { uploadStoreImage, MAX_IMAGE_BYTES } from "@/lib/store-upload";

interface ImageRow { id: string; url: string; sort_order: number }
interface OptionRow { id: string; group_id: string; name: string; price_cents: number; is_available: boolean; sort_order: number }
interface GroupRow {
  id: string; name: string; is_required: boolean; min_select: number; max_select: number; sort_order: number;
}

/**
 * Fotos adicionais e opções/adicionais de um produto.
 * Tudo é salvo direto no banco (nada fica só na tela).
 */
export function ProductExtrasEditor({
  open, onOpenChange, productId, productName, userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productName: string;
  userId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const [imgRes, grpRes, optRes] = await Promise.all([
      supabase.from("product_images").select("id, url, sort_order").eq("product_id", productId).order("sort_order"),
      supabase.from("product_option_groups").select("id, name, is_required, min_select, max_select, sort_order").eq("product_id", productId).order("sort_order"),
      supabase.from("product_options").select("id, group_id, name, price_cents, is_available, sort_order").order("sort_order"),
    ]);
    setImages((imgRes.data as ImageRow[]) ?? []);
    const g = (grpRes.data as GroupRow[]) ?? [];
    setGroups(g);
    const ids = new Set(g.map((x) => x.id));
    setOptions(((optRes.data as OptionRow[]) ?? []).filter((o) => ids.has(o.group_id)));
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  /* ---------- imagens ---------- */
  const addImages = async (files: FileList) => {
    setUploading(true);
    try {
      let order = images.length;
      for (const file of Array.from(files).slice(0, 6)) {
        if (file.size > MAX_IMAGE_BYTES) { toast.error(`${file.name}: imagem maior que 5MB`); continue; }
        const url = await uploadStoreImage(file, userId, "product");
        const { error } = await supabase.from("product_images").insert({
          product_id: productId, user_id: userId, url, sort_order: order++,
        });
        if (error) throw error;
      }
      await load();
      toast.success("Fotos adicionadas");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar a foto");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (id: string) => {
    const { error } = await supabase.from("product_images").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const moveImage = async (index: number, dir: -1 | 1) => {
    const next = [...images];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    await Promise.all(next.map((img, i) => supabase.from("product_images").update({ sort_order: i }).eq("id", img.id)));
  };

  /* ---------- grupos de opções ---------- */
  const addGroup = async () => {
    const { data, error } = await supabase.from("product_option_groups").insert({
      product_id: productId, user_id: userId, name: "Novo grupo",
      is_required: false, min_select: 0, max_select: 1, sort_order: groups.length,
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (data) setGroups((prev) => [...prev, data as GroupRow]);
  };

  const patchGroup = async (id: string, patch: Partial<GroupRow>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const { error } = await supabase.from("product_option_groups").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const removeGroup = async (id: string) => {
    const { error } = await supabase.from("product_option_groups").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setOptions((prev) => prev.filter((o) => o.group_id !== id));
  };

  const addOption = async (groupId: string) => {
    const count = options.filter((o) => o.group_id === groupId).length;
    const { data, error } = await supabase.from("product_options").insert({
      group_id: groupId, user_id: userId, name: "Nova opção", price_cents: 0, is_available: true, sort_order: count,
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (data) setOptions((prev) => [...prev, data as OptionRow]);
  };

  const patchOption = async (id: string, patch: Partial<OptionRow>) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    const { error } = await supabase.from("product_options").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const removeOption = async (id: string) => {
    const { error } = await supabase.from("product_options").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fotos e opções — {productName}</DialogTitle>
          <DialogDescription>
            Fotos extras aparecem na galeria do produto na Mini-loja. As opções deixam o cliente escolher tamanho, adicionais e afins.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            {/* GALERIA */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Galeria de fotos</Label>
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 h-9 rounded-md border border-input hover:bg-accent">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar fotos
                  <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
                    onChange={(e) => { const f = e.target.files; e.currentTarget.value = ""; if (f?.length) addImages(f); }} />
                </label>
              </div>
              {images.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-xl text-sm text-muted-foreground">
                  <ImageIcon className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  Nenhuma foto extra. A foto principal do produto continua valendo.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.map((img, i) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-background">
                      <img src={normalizeImageUrl(img.url) ?? img.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => moveImage(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => moveImage(i, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => removeImage(img.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* OPÇÕES */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Opções e adicionais</Label>
                <Button size="sm" variant="outline" onClick={addGroup}><Plus className="h-4 w-4 mr-1.5" /> Novo grupo</Button>
              </div>
              {groups.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-xl text-sm text-muted-foreground">
                  Ex.: grupo “Tamanho” com P, M e G; ou “Adicionais” com Bacon +R$ 4,00.
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((g) => (
                    <div key={g.id} className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input value={g.name} onChange={(e) => patchGroup(g.id, { name: e.target.value })} className="h-9" placeholder="Tamanho, Adicionais..." />
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeGroup(g.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <Switch checked={g.is_required} onCheckedChange={(v) => patchGroup(g.id, { is_required: v, min_select: v ? Math.max(1, g.min_select) : 0 })} />
                          Obrigatório
                        </label>
                        <label className="flex items-center gap-2">
                          Máximo de escolhas
                          <Input type="number" min={1} max={20} value={g.max_select}
                            onChange={(e) => patchGroup(g.id, { max_select: Math.max(1, parseInt(e.target.value || "1", 10)) })}
                            className="h-8 w-20" />
                        </label>
                      </div>
                      <div className="space-y-2">
                        {options.filter((o) => o.group_id === g.id).map((o) => (
                          <div key={o.id} className="flex items-center gap-2">
                            <Input value={o.name} onChange={(e) => patchOption(o.id, { name: e.target.value })} className="h-9 flex-1" placeholder="Bacon" />
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-muted-foreground">+R$</span>
                              <Input type="number" step="0.01" min="0" className="h-9 w-24"
                                value={o.price_cents ? (o.price_cents / 100).toFixed(2) : ""}
                                onChange={(e) => patchOption(o.id, { price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                                placeholder="0,00" />
                            </div>
                            <Switch checked={o.is_available} onCheckedChange={(v) => patchOption(o.id, { is_available: v })} />
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeOption(o.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => addOption(g.id)}><Plus className="h-4 w-4 mr-1.5" /> Adicionar opção</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
