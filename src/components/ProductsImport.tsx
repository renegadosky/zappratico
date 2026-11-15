import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  botId: string;
  userId: string;
  existingCount: number;
  onDone: () => void;
}

type Row = Record<string, string>;
type ParsedProduct = {
  name: string;
  price_cents: number;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  category: string | null;
  sku: string | null;
  track_stock: boolean;
  stock_quantity: number;
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parsePrice(raw: string): number {
  if (!raw) return 0;
  // aceita "12,50", "12.50", "R$ 12,50", "1.234,56"
  const cleaned = raw.replace(/[^\d,\.\-]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // formato brasileiro 1.234,56
    return Math.round(parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  }
  if (cleaned.includes(",")) {
    return Math.round(parseFloat(cleaned.replace(",", ".")) * 100) || 0;
  }
  return Math.round(parseFloat(cleaned) * 100) || 0;
}

export function ProductsImport({ open, onOpenChange, botId, userId, existingCount, onDone }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [valid, setValid] = useState<ParsedProduct[]>([]);
  const [errors, setErrors] = useState<{ row: number; reason: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ ok: number; failed: number } | null>(null);

  const reset = () => {
    setRows([]); setValid([]); setErrors([]); setProgress(0); setDone(null);
  };

  const handleClose = (v: boolean) => {
    if (importing) return;
    onOpenChange(v);
    if (!v) setTimeout(reset, 200);
  };

  const downloadTemplate = () => {
    const csv = "nome,preco,descricao,imagem,categoria,codigo,estoque\nCamiseta básica,49.90,100% algodão,https://...,Camisetas,CAM-01,20\nCalça jeans,129.00,Lavagem clara,,Calças,,";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-produtos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    reset();
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: (result) => {
        const parsedRows = result.data as Row[];
        setRows(parsedRows);
        const ok: ParsedProduct[] = [];
        const errs: { row: number; reason: string }[] = [];
        parsedRows.forEach((r, i) => {
          const name = (r.nome || r.name || r.produto || r.item || "").trim();
          const priceRaw = r.preco || r.price || r["preço"] || r.valor || "";
          const cents = parsePrice(String(priceRaw));
          if (!name) { errs.push({ row: i + 2, reason: "Nome vazio" }); return; }
          if (cents <= 0) { errs.push({ row: i + 2, reason: "Preço inválido" }); return; }
          const stockRaw = (r.estoque || r.stock || r.qtd || r.quantidade || "").toString().trim();
          const hasStock = stockRaw !== "";
          const stockNum = hasStock ? Math.max(0, parseInt(stockRaw.replace(/\D/g, ""), 10) || 0) : 0;
          const activeRaw = (r.ativo || r.active || r.status || "").toString().trim().toLowerCase();
          const inactive = ["nao", "não", "no", "false", "0", "inativo"].includes(activeRaw);
          ok.push({
            name,
            price_cents: cents,
            description: (r.descricao || r.description || r["descrição"] || "").trim() || null,
            image_url: (r.imagem || r.image || r.image_url || r.foto || "").trim() || null,
            sort_order: existingCount + ok.length,
            is_active: !inactive,
            category: (r.categoria || r.category || r.cat || "").trim() || null,
            sku: (r.codigo || r.sku || r.code || r["código"] || "").trim() || null,
            track_stock: hasStock,
            stock_quantity: stockNum,
          });
        });
        setValid(ok);
        setErrors(errs);
      },
      error: (err) => toast.error("Não consegui ler o arquivo: " + err.message),
    });
  };

  const startImport = async () => {
    if (valid.length === 0) return;
    setImporting(true);
    setProgress(0);
    let ok = 0;
    let failed = 0;
    const CHUNK = 100;
    for (let i = 0; i < valid.length; i += CHUNK) {
      const batch = valid.slice(i, i + CHUNK).map((p) => ({ ...p, bot_id: botId, user_id: userId }));
      const { error } = await supabase.from("products").insert(batch);
      if (error) failed += batch.length;
      else ok += batch.length;
      setProgress(Math.round(((i + batch.length) / valid.length) * 100));
    }
    setDone({ ok, failed });
    setImporting(false);
    onDone();
    if (failed === 0) toast.success(`${ok} produtos importados`);
    else toast.warning(`${ok} importados, ${failed} com erro`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar produtos em massa</DialogTitle>
          <DialogDescription>
            Suba uma planilha CSV (ou exportada do Excel) com seus produtos. Ideal para mercadinhos e atacados com muitos itens.
          </DialogDescription>
        </DialogHeader>

        {!rows.length && !done && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <FileSpreadsheet className="h-10 w-10 text-primary mx-auto mb-3" />
              <p className="font-medium mb-1">Escolha um arquivo CSV</p>
              <p className="text-xs text-muted-foreground mb-4">Colunas aceitas: <code className="px-1 bg-background rounded">nome</code>, <code className="px-1 bg-background rounded">preco</code>, <code className="px-1 bg-background rounded">descricao</code>, <code className="px-1 bg-background rounded">imagem</code>, <code className="px-1 bg-background rounded">categoria</code>, <code className="px-1 bg-background rounded">codigo</code>, <code className="px-1 bg-background rounded">estoque</code>, <code className="px-1 bg-background rounded">ativo</code></p>
              <label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <span className="inline-flex items-center justify-center cursor-pointer rounded-md bg-gradient-primary text-primary-foreground shadow-glow px-4 py-2 text-sm font-medium">
                  <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
                </span>
              </label>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" /> Baixar planilha modelo
            </Button>
            <p className="text-xs text-muted-foreground">
              Dica: no Excel ou Google Sheets, use "Salvar como… CSV". Preços podem ser <code className="px-1 bg-background rounded">12,50</code> ou <code className="px-1 bg-background rounded">12.50</code>.
            </p>
          </div>
        )}

        {rows.length > 0 && !done && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary">{rows.length} linhas lidas</Badge>
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">{valid.length} válidos</Badge>
              {errors.length > 0 && <Badge variant="destructive">{errors.length} com erro</Badge>}
            </div>

            <div className="border border-border rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-background sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">#</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Preço</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {valid.slice(0, 10).map((p, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2 truncate max-w-[260px]">{p.name}</td>
                      <td className="p-2">R$ {(p.price_cents / 100).toFixed(2).replace(".", ",")}</td>
                      <td className="p-2"><CheckCircle2 className="h-4 w-4 text-primary" /></td>
                    </tr>
                  ))}
                  {errors.slice(0, 5).map((e, i) => (
                    <tr key={`e${i}`} className="border-t border-border bg-destructive/5">
                      <td className="p-2 text-muted-foreground">linha {e.row}</td>
                      <td className="p-2 text-muted-foreground" colSpan={2}>{e.reason}</td>
                      <td className="p-2"><AlertCircle className="h-4 w-4 text-destructive" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {valid.length > 10 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t border-border">
                  …e mais {valid.length - 10} produtos
                </div>
              )}
            </div>

            {importing && <Progress value={progress} className="h-2" />}
          </div>
        )}

        {done && (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <p className="font-display font-semibold text-lg">{done.ok} produtos importados</p>
            {done.failed > 0 && <p className="text-sm text-destructive">{done.failed} falharam</p>}
          </div>
        )}

        <DialogFooter>
          {!done ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>Cancelar</Button>
              <Button
                onClick={startImport}
                disabled={!valid.length || importing}
                className="bg-gradient-primary text-primary-foreground shadow-glow"
              >
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Importar {valid.length > 0 ? valid.length : ""}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)} className="bg-gradient-primary text-primary-foreground shadow-glow">Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
