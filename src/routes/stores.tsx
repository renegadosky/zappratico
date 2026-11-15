import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getStoreLimit, getPlan } from "@/lib/plans";
import { toast } from "sonner";
import { Plus, Store as StoreIcon, Loader2, Crown, Pencil, Trash2, Upload, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/stores")({
  component: StoresPage,
});

interface StoreRow {
  id: string;
  name: string;
  segment: string | null;
  logo_url: string | null;
  color: string | null;
  description: string | null;
  is_primary: boolean;
}

async function uploadStoreLogo(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/store-logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type,
  });
  if (error) throw error;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

function StoresPage() {
  const { user, profile } = useAuth();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [saving, setSaving] = useState(false);

  const limit = getStoreLimit(profile?.plan);
  const plan = getPlan(profile?.plan);
  const canCreate = stores.length < limit;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("stores").select("*").eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) return toast.error("Erro: " + error.message);
    setStores((data as StoreRow[]) || []);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleSave = async (form: Partial<StoreRow>) => {
    if (!user) return;
    setSaving(true);
    if (editing?.id) {
      const { error } = await supabase.from("stores").update({
        name: form.name, segment: form.segment, description: form.description,
        color: form.color, logo_url: form.logo_url ?? null,
      }).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      toast.success("Loja atualizada");
    } else {
      if (!canCreate) {
        setSaving(false);
        return toast.error("Limite do seu plano atingido. Faça upgrade pra adicionar mais lojas.");
      }
      const { error } = await supabase.from("stores").insert({
        user_id: user.id, name: form.name!, segment: form.segment ?? null,
        description: form.description ?? null, color: form.color ?? "#10b981",
        logo_url: form.logo_url ?? null,
      });
      if (error) { setSaving(false); return toast.error(error.message); }
      toast.success("Loja criada");
    }
    setSaving(false);
    setOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("stores").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Loja removida");
    load();
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Minhas lojas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as lojas/empresas da sua conta.{" "}
              <span className="text-foreground">
                {stores.length}/{limit === Infinity ? "∞" : limit}
              </span>{" "}
              no plano <span className="text-primary font-medium">{plan.name}</span>.
            </p>
          </div>
          <Button
            onClick={() => { setEditing(null); setOpen(true); }}
            disabled={!canCreate}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4 mr-2" /> Nova loja
          </Button>
        </div>

        {!canCreate && limit < Infinity && (
          <div className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Quer gerenciar várias lojas?</div>
                <p className="text-sm text-muted-foreground">Disponível no plano Business — lojas ilimitadas.</p>
              </div>
            </div>
            <Link to="/plans">
              <Button variant="outline">Ver planos</Button>
            </Link>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : stores.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl">
            <StoreIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma loja ainda. Crie a primeira.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {stores.map((s) => (
              <div key={s.id} className="p-5 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0"
                    style={{ backgroundColor: s.color ?? undefined }}>
                    {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> :
                      <StoreIcon className="h-5 w-5 text-white/80" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{s.name}</h3>
                      {s.is_primary && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">Principal</span>}
                    </div>
                    {s.segment && <p className="text-xs text-muted-foreground">{s.segment}</p>}
                    {s.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(s); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                  {!s.is_primary && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}
                      className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <StoreDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
          initial={editing} saving={saving} onSave={handleSave} />
      </div>
    </AppShell>
  );
}

function StoreDialog({
  open, onOpenChange, initial, saving, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: StoreRow | null;
  saving: boolean;
  onSave: (form: Partial<StoreRow>) => void;
}) {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#10b981");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setName(initial?.name ?? "");
    setSegment(initial?.segment ?? "");
    setDescription(initial?.description ?? "");
    setColor(initial?.color ?? "#10b981");
    setLogoUrl(initial?.logo_url ?? null);
  }, [initial, open]);

  const handleLogoFile = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
    setUploading(true);
    try {
      const url = await uploadStoreLogo(file, user.id);
      setLogoUrl(url);
      toast.success("Logo enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar logo");
    } finally {
      setUploading(false);
    }
  };

  const PRESETS = ["#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#ef4444", "#14b8a6", "#0f172a"];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">{initial ? "Editar loja" : "Nova loja"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {initial ? "Atualize os dados da sua loja." : "Crie uma nova loja para separar produtos, bots e pedidos."}
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Preview card */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/40">
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0 shadow-inner overflow-hidden"
              style={{ backgroundColor: color }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <StoreIcon className="h-5 w-5 text-white/90" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{name || "Nome da loja"}</div>
              <div className="text-xs text-muted-foreground truncate">{segment || "Segmento"}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Logo (opcional)</Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-lg border border-dashed border-border bg-background/60 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-border hover:bg-accent text-xs font-medium cursor-pointer w-fit">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {logoUrl ? "Trocar logo" : "Enviar logo"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => {
                    const f = e.target.files?.[0]; e.target.value = "";
                    if (f) handleLogoFile(f);
                  }} />
                </label>
                {logoUrl && (
                  <button type="button" onClick={() => setLogoUrl(null)} className="text-xs text-muted-foreground hover:text-destructive text-left">
                    Remover logo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-name">Nome <span className="text-destructive">*</span></Label>
            <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Loja da Maria" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-segment">Segmento</Label>
            <Input id="store-segment" value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Ex: Roupas, Hamburgueria, Doceria" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-desc">Descrição</Label>
            <Textarea
              id="store-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Um resumo curto da sua loja (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label>Cor da marca</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  className={`h-9 w-9 rounded-lg border-2 transition-all ${
                    color.toLowerCase() === c.toLowerCase()
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="relative h-9 w-9 rounded-lg border-2 border-dashed border-border hover:border-primary/60 cursor-pointer flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                <Plus className="h-4 w-4" />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              <span className="text-xs text-muted-foreground font-mono ml-1 uppercase">{color}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || uploading}>Cancelar</Button>
          <Button
            disabled={!name.trim() || saving || uploading}
            onClick={() => onSave({ name, segment, description, color, logo_url: logoUrl })}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initial ? "Salvar alterações" : "Criar loja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
