import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPlan } from "@/lib/plans";
import { getMyMonetization, type MyMonetization } from "@/lib/monetization.functions";
import { formatCentsBRL, formatFeePercent } from "@/lib/platform-fee";
import {
  User as UserIcon, Mail, Store as StoreIcon, Crown, BadgeDollarSign,
  KeyRound, LogOut, ShieldCheck, ChevronRight,
} from "lucide-react";



export const Route = createFileRoute("/settings")({
  component: () => (
    <AppShell>
      <Settings />
    </AppShell>
  ),
});

function Settings() {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const plan = getPlan(profile?.plan);
  const nameInvalid = businessName.trim().length === 0;

  const save = async () => {
    if (!user) return;
    if (nameInvalid) {
      toast.error("Informe o nome do negócio antes de salvar");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ business_name: businessName.trim(), full_name: fullName.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar");
      return;
    }
    toast.success("Configurações salvas");
    refreshProfile();
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setResetting(false);
    if (error) toast.error(error.message);
    else toast.success("Enviamos um e-mail com o link para redefinir sua senha.");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Sua conta, seu plano e integrações.
        </p>
      </div>

      {/* Plano */}
      <SectionCard
        icon={Crown}
        title="Plano atual"
        subtitle={`Você está no plano ${plan.name}.`}
        action={
          <Link to="/plans">
            <Button variant="outline" size="sm">
              {plan.id === "free" ? "Fazer upgrade" : "Gerenciar"}
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        }
      >
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">{plan.name}</span>
          <span>·</span>
          <span>{plan.storeLimit === Infinity ? "Lojas ilimitadas" : `${plan.storeLimit} loja(s)`}</span>
        </div>
      </SectionCard>

      {/* Perfil */}
      <SectionCard icon={UserIcon} title="Perfil" subtitle="Como você aparece dentro do app.">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fn">Seu nome</Label>
            <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Como devemos te chamar" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bn">
              <StoreIcon className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
              Nome do negócio
            </Label>
            <Input
              id="bn"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              aria-invalid={nameInvalid || undefined}
              className={nameInvalid ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {nameInvalid && <p className="text-xs text-destructive">Esse campo é obrigatório.</p>}
            <p className="text-xs text-muted-foreground">
              Para várias marcas, use{" "}
              <Link to="/stores" className="text-primary hover:underline">Minhas lojas</Link>.
            </p>
          </div>
          <div className="space-y-2">
            <Label>
              <Mail className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
              Email
            </Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <LoadingButton
            onClick={save}
            loading={saving}
            loadingText="Salvando..."
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            Salvar alterações
          </LoadingButton>
        </div>
      </SectionCard>

      {/* Segurança */}
      <SectionCard icon={ShieldCheck} title="Segurança" subtitle="Mantenha sua conta protegida.">
        <div className="space-y-3">
          <Row
            icon={KeyRound}
            title="Trocar senha"
            description="Enviamos um link de redefinição pro seu e-mail."
            action={
              <LoadingButton
                variant="outline"
                size="sm"
                loading={resetting}
                loadingText="Enviando..."
                onClick={sendPasswordReset}
              >
                Enviar link
              </LoadingButton>
            }
          />
          <Row
            icon={LogOut}
            title="Sair da conta"
            description="Encerra a sessão neste dispositivo."
            action={
              <Button size="sm" variant="outline" onClick={handleSignOut}>
                Sair
              </Button>
            }
          />
        </div>
      </SectionCard>

      <MonetizationCard />
    </div>
  );
}

function MonetizationCard() {
  const load = useServerFn(getMyMonetization);
  const [data, setData] = useState<MyMonetization | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [load]);

  return (
    <SectionCard
      icon={BadgeDollarSign}
      title="Monetização da plataforma"
      subtitle={`Taxa de ${data ? formatFeePercent(data.feePercent) : "1%"} por pedido pago pelo PIX oficial.`}
      action={
        <Link to="/bots">
          <Button variant="outline" size="sm">
            Configurar PIX
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </Link>
      }
    >
      {state === "loading" ? (
        <div className="h-16 rounded-lg bg-muted/40 animate-pulse" />
      ) : state === "error" || !data ? (
        <p className="text-xs text-muted-foreground">
          Não foi possível carregar seu status de monetização agora.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <MiniStat label="Pedidos" value={String(data.totalOrders)} />
            <MiniStat label="Com PIX oficial" value={String(data.officialOrders)} />
            <MiniStat label="Fora do sistema" value={String(data.unofficialOrders)} />
            <MiniStat label="Taxa paga" value={formatCentsBRL(data.feePaidCents)} />
          </div>
          <div
            className={`rounded-lg border p-3 text-xs ${
              data.adsEnabled ? "border-warning/40 bg-warning/10" : "border-border bg-background/50"
            }`}
          >
            {data.adsEnabled ? (
              <>
                <strong>Modo anúncios ativo.</strong> Detectamos {data.unofficialStreak} pedido(s)
                seguidos sem o pagamento oficial. Ative o PIX automático e os anúncios saem no
                próximo pedido pago.
              </>
            ) : (
              <>
                <strong>Modo taxa PIX.</strong> Sem anúncios. Após{" "}
                {data.adsThreshold} pedidos seguidos fora do pagamento oficial, exibimos anúncios
                discretos no painel.
              </>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}


function SectionCard({
  icon: Icon, title, subtitle, action, children,
}: {
  icon: any; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="mb-5 rounded-2xl bg-surface border border-border overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon, title, description, action,
}: {
  icon: any; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background/50">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          {description && <div className="text-xs text-muted-foreground truncate">{description}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}
