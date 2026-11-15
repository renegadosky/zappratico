import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/dashboard/primitives";
import {
  getAdminMonetization,
  updatePlatformSettings,
  type AdminMonetization,
} from "@/lib/monetization.functions";
import { formatCentsBRL, formatFeePercent } from "@/lib/platform-fee";
import { AlertTriangle, BadgeDollarSign, Megaphone, ShieldCheck, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel da plataforma · Zap Prático" },
      {
        name: "description",
        content:
          "Painel administrativo da plataforma: pedidos, taxa arrecadada, status de monetização e configuração da taxa PIX.",
      },
      { property: "og:title", content: "Painel da plataforma · Zap Prático" },
      {
        property: "og:description",
        content: "Pedidos, taxa arrecadada e status de monetização da plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <AdminPanel />
    </AppShell>
  ),
});

const PROVIDERS = ["manual", "mercadopago", "asaas", "efi", "pagarme"] as const;

function AdminPanel() {
  const fetchData = useServerFn(getAdminMonetization);
  const saveFn = useServerFn(updatePlatformSettings);

  const [data, setData] = useState<AdminMonetization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fee, setFee] = useState("1");
  const [threshold, setThreshold] = useState("10");
  const [pixKey, setPixKey] = useState("");
  const [pixName, setPixName] = useState("");
  const [pixCity, setPixCity] = useState("");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("manual");
  const [asaasWallet, setAsaasWallet] = useState("");
  const [mpUserId, setMpUserId] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchData()
      .then((d) => {
        setData(d);
        setFee(String(d.feePercent));
        setThreshold(String(d.adsThreshold));
        setPixKey(d.platformPixKey ?? "");
        setPixName(d.platformPixName ?? "");
        setPixCity(d.platformPixCity ?? "");
        setAsaasWallet(d.platformAsaasWalletId ?? "");
        setMpUserId(d.platformMpUserId ?? "");
        setProvider((PROVIDERS as readonly string[]).includes(d.splitProvider)
          ? (d.splitProvider as (typeof PROVIDERS)[number])
          : "manual");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [fetchData]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const feeNum = Number(fee.replace(",", "."));
    const thrNum = Number(threshold);
    if (!Number.isFinite(feeNum) || feeNum < 0 || feeNum > 20) {
      toast.error("A taxa deve estar entre 0% e 20%.");
      return;
    }
    if (!Number.isInteger(thrNum) || thrNum < 1) {
      toast.error("Informe um número válido de pedidos para ativar anúncios.");
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          feePercent: feeNum,
          adsThreshold: thrNum,
          platformPixKey: pixKey.trim() || null,
          platformPixName: pixName.trim() || null,
          platformPixCity: pixCity.trim() || null,
          splitProvider: provider,
          platformAsaasWalletId: asaasWallet.trim() || null,
          platformMpUserId: mpUserId.trim() || null,
        },
      });
      toast.success("Configuração da plataforma salva.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
          <p className="text-sm">Não foi possível carregar o painel: {error}</p>
          <button type="button" onClick={load} className="mt-3 text-xs underline">
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (!data?.isAdmin) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto" />
          <h1 className="mt-3 font-display font-bold text-xl">Acesso restrito</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este painel é exclusivo da equipe da plataforma. Sua conta não tem permissão de
            administrador.
          </p>
        </div>
      </div>
    );
  }

  const adsMode = data.storesOnAds > 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Painel da plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monetização por taxa PIX de {formatFeePercent(data.feePercent)} por pedido, com anúncios
          como plano B.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={ShoppingBag} label="Total de pedidos" value={String(data.totalOrders)} />
        <Stat icon={BadgeDollarSign} label="Com pagamento oficial" value={String(data.officialOrders)} />
        <Stat icon={AlertTriangle} label="Sem pagamento oficial" value={String(data.unofficialOrders)} />
        <Stat
          icon={BadgeDollarSign}
          label="Taxa arrecadada"
          value={formatCentsBRL(data.feeCollectedCents)}
          hint={`${formatCentsBRL(data.feePendingCents)} aguardando confirmação`}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Megaphone className={`h-4 w-4 ${adsMode ? "text-warning" : "text-muted-foreground"}`} />
          <div>
            <h2 className="font-display font-semibold text-sm">Status da monetização</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {adsMode
                ? `${data.storesOnAds} loja(s) em modo Anúncios por não usar o pagamento oficial.`
                : "Todas as lojas ativas estão no modo Taxa PIX."}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-display font-semibold">Configuração da monetização</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Somente administradores alteram estes valores. A taxa é aplicada no servidor em cada
            cobrança.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fee">Taxa da plataforma (%)</Label>
            <Input id="fee" value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" />
            <p className="text-[11px] text-muted-foreground">Padrão: 1% por pedido.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="thr">Pedidos sem pagamento oficial para ativar anúncios</Label>
            <Input
              id="thr"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              inputMode="numeric"
            />
            <p className="text-[11px] text-muted-foreground">Padrão: 10 pedidos consecutivos.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pk">Chave PIX da plataforma</Label>
            <Input id="pk" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pn">Beneficiário da plataforma</Label>
            <Input id="pn" value={pixName} onChange={(e) => setPixName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pc">Cidade do beneficiário</Label>
            <Input id="pc" value={pixCity} onChange={(e) => setPixCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prov">Intermediador do split</Label>
            <select
              id="prov"
              value={provider}
              onChange={(e) => setProvider(e.target.value as (typeof PROVIDERS)[number])}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="manual">Manual (sem split automático)</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="asaas">Asaas</option>
              <option value="efi">Efí</option>
              <option value="pagarme">Pagar.me</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Com Mercado Pago ou Asaas o split 99/1 é automático: a taxa cai direto na conta da
              plataforma. No modo manual a taxa é apenas registrada.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet">Wallet ID da plataforma no Asaas</Label>
            <Input
              id="wallet"
              value={asaasWallet}
              onChange={(e) => setAsaasWallet(e.target.value)}
              placeholder="ex: 8a5c7f0e-..."
            />
            <p className="text-[11px] text-muted-foreground">
              Encontrado no Asaas em Integrações → Split. É a conta que recebe a taxa.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mpid">User ID da plataforma no Mercado Pago</Label>
            <Input
              id="mpid"
              value={mpUserId}
              onChange={(e) => setMpUserId(e.target.value)}
              placeholder="ex: 123456789"
            />
            <p className="text-[11px] text-muted-foreground">
              A taxa vai via application_fee do Mercado Pago para a conta da plataforma.
            </p>
          </div>
        </div>

        <LoadingButton onClick={save} loading={saving} loadingText="Salvando...">
          Salvar configuração
        </LoadingButton>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display font-semibold text-sm">Últimas taxas registradas</h2>
        {data.recent.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Nenhuma taxa registrada ainda. Elas aparecem aqui quando um pedido é cobrado pelo
            pagamento oficial.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.recent.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </span>
                <span>{formatCentsBRL(r.gross_cents)}</span>
                <span className="font-medium text-primary">{formatCentsBRL(r.fee_cents)}</span>
                <span className="text-muted-foreground">{r.provider}</span>
                <span className="text-muted-foreground">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-xl font-display font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
