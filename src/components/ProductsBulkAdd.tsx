import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  botId: string;
  userId: string;
  existingCount: number;
  onDone: () => void;
}

type Row = {
  name: string;
  priceStr: string;
  stockStr: string;
  trackStock: boolean;
  is_active: boolean;
};

const emptyRow = (): Row => ({ name: "", priceStr: "", stockStr: "", trackStock: false, is_active: true });

function parsePrice(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,\.\-]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Math.round(parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  }
  if (cleaned.includes(",")) return Math.round(parseFloat(cleaned.replace(",", ".")) * 100) || 0;
  return Math.round(parseFloat(cleaned) * 100) || 0;
}

export function ProductsBulkAdd({ open, onOpenChange, botId, userId, existingCount, onDone }: Props) {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 5 }, emptyRow));
  const [saving, setSaving] = useState(false);

  const reset = () => setRows(Array.from({ length: 5 }, emptyRow));

  const handleClose = (v: boolean) => {
    if (saving) return;
    onOpenChange(v);
    if (!v) setTimeout(reset, 200);
  };

  const update = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    const valid = rows
      .map((r, i) => {
        const name = r.name.trim();
        const cents = parsePrice(r.priceStr);
        return { r, i, name, cents };
      })
      .filter((x) => x.name && x.cents > 0);

    if (valid.length === 0) {
      toast.error("Preencha nome e preço em pelo menos uma linha");
      return;
    }

    setSaving(true);
    const payload = valid.map((v, idx) => ({
      bot_id: botId,
      user_id: userId,
      name: v.name,
      price_cents: v.cents,
      is_active: v.r.is_active,
      track_stock: v.r.trackStock,
      stock_quantity: v.r.trackStock ? Math.max(0, parseInt(v.r.stockStr || "0", 10) || 0) : 0,
      sort_order: existingCount + idx,
    }));
    const { error } = await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${payload.length} produto${payload.length > 1 ? "s" : ""} cadastrado${payload.length > 1 ? "s" : ""}`);
    onDone();
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Cadastro rápido</DialogTitle>
          <DialogDescription>
            Digite vários produtos de uma vez. Sem planilha, sem complicação. Só nome e preço são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto pr-1 space-y-2">
          <div className="grid grid-cols-[1fr_110px_120px_60px_36px] gap-2 text-xs text-muted-foreground px-1">
            <div>Nome do produto *</div>
            <div>Preço R$ *</div>
            <div>Estoque</div>
            <div className="text-center">Ativo</div>
            <div />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_120px_60px_36px] gap-2 items-center">
              <Input
                value={r.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Ex: X-Burger"
              />
              <Input
                value={r.priceStr}
                onChange={(e) => update(i, { priceStr: e.target.value })}
                placeholder="19,90"
                inputMode="decimal"
              />
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={r.trackStock}
                  onCheckedChange={(v) => update(i, { trackStock: v })}
                />
                <Input
                  value={r.stockStr}
                  onChange={(e) => update(i, { stockStr: e.target.value.replace(/\D/g, "") })}
                  disabled={!r.trackStock}
                  placeholder="—"
                  inputMode="numeric"
                  className="h-9"
                />
              </div>
              <div className="flex justify-center">
                <Switch checked={r.is_active} onCheckedChange={(v) => update(i, { is_active: v })} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeRow(i)} disabled={rows.length <= 1}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRow} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Adicionar linha
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar tudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
