import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { SetupChecklist } from "@/components/SetupChecklist";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { StoreAlerts } from "@/components/dashboard/StoreAlerts";
import { useAuth } from "@/lib/auth-context";
import {
  deriveDailySeries,
  deriveMetrics,
  formatBRL,
  useDashboard,
} from "@/lib/use-dashboard";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Clock,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel · Zap Prático" },
      {
        name: "description",
        content:
          "Acompanhe receita, pedidos, clientes e alertas da sua loja em tempo real no painel do Zap Prático.",
      },
      { property: "og:title", content: "Painel · Zap Prático" },
      {
        property: "og:description",
        content: "Receita, pedidos e alertas da sua loja em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function Dashboard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useDashboard();

  const metrics = useMemo(
    () => deriveMetrics(data?.orders ?? [], data?.counts.conversations30d ?? 0),
    [data],
  );
  const series = useMemo(() => deriveDailySeries(data?.orders ?? []), [data]);

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">
            Olá, {profile?.full_name?.split(" ")[0] ?? "tudo certo"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resumo da sua operação, atualizado em tempo real.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-2 text-xs rounded-lg border border-border px-3 py-2 hover:border-primary/40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-center gap-3">
          <p className="text-sm flex-1">Não foi possível carregar os dados: {error}</p>
          <button
            type="button"
            onClick={reload}
            className="text-xs font-medium rounded-lg border border-border px-3 py-1.5"
          >
            Tentar de novo
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Receita hoje"
          value={formatBRL(metrics.todayRevenue)}
          icon={DollarSign}
          delta={metrics.revenueDelta}
          hint={
            metrics.revenueDelta === null && !loading
              ? metrics.todayRevenue === 0
                ? "Aguardando primeiras vendas."
                : "Sem base de ontem."
              : "vs. ontem"
          }
          loading={loading}
        />
        <StatCard
          label="Vendas hoje"
          value={String(metrics.todaySales)}
          icon={ShoppingBag}
          hint="pedidos pagos"
          loading={loading}
        />
        <StatCard
          label="Aguardando pagamento"
          value={String(metrics.pending)}
          icon={Clock}
          hint="últimos 30 dias"
          attention={metrics.pending > 0}
          loading={loading}
        />
        <StatCard
          label="Ticket médio"
          value={metrics.sales30d > 0 ? formatBRL(metrics.avgTicket) : formatBRL(0)}
          icon={BarChart3}
          hint={metrics.sales30d > 0 ? "últimos 30 dias" : "sem vendas ainda"}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Clientes"
          value={String(data?.counts.customers30d ?? 0)}
          icon={Users}
          hint="atendidos em 30 dias"
          loading={loading}
        />
        <StatCard
          label="Conversão"
          value={metrics.conversion !== null ? `${metrics.conversion}%` : "—"}
          icon={Sparkles}
          hint={metrics.conversion !== null ? "conversas que viraram venda" : "sem conversas ainda"}
          loading={loading}
        />
        <StatCard
          label="Produtos ativos"
          value={String(data?.counts.products ?? 0)}
          icon={Package}
          hint="no catálogo"
          loading={loading}
        />
        <StatCard
          label="Bots"
          value={String(data?.counts.bots ?? 0)}
          icon={Bot}
          hint="criados na conta"
          loading={loading}
        />
      </div>

      <SetupChecklist />

      <RevenueChart buckets={series} loading={loading} total={metrics.revenue30d} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentOrders orders={data?.orders ?? []} loading={loading} />
        </div>
        <div className="space-y-4">
          <StoreAlerts data={data} pending={metrics.pending} loading={loading} />
          <ActivityTimeline events={data?.events ?? []} loading={loading} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Shortcut to="/analytics" icon={BarChart3} title="Análises" desc="Receita, conversão e clientes." />
        <Shortcut to="/orders" icon={ShoppingBag} title="Comandas" desc="Gerencie e atualize status." />
        <Shortcut to="/bots" icon={Bot} title="Meus bots" desc="Produtos, PIX e WhatsApp." />
        <Shortcut to="/stores" icon={Store} title="Minhas lojas" desc="Multi-loja por plano." />
        <Shortcut to="/templates" icon={Sparkles} title="Templates" desc="Comece de um modelo pronto." />
        <Shortcut to="/ai-builder" icon={Users} title="Assistente de Criação" desc="Monte um bot conversando." />
      </div>
    </div>
  );
}

function Shortcut({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-card transition-all p-4 flex items-center gap-3"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </Link>
  );
}
