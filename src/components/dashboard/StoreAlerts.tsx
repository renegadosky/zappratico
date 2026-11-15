import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import type { DashboardData } from "@/lib/use-dashboard";
import { EmptyState, Panel, Skeleton } from "./primitives";

type Alert = { id: string; title: string; description: string; to: string; cta: string };

export function StoreAlerts({
  data,
  pending,
  loading,
}: {
  data: DashboardData | null;
  pending: number;
  loading: boolean;
}) {
  const alerts: Alert[] = [];

  if (data) {
    const editPath = data.setup.firstBotId ? `/bots/${data.setup.firstBotId}/edit` : "/bots";

    if (!data.setup.hasPayment)
      alerts.push({
        id: "pix",
        title: "Pagamento não configurado",
        description: "Sem PIX ativo o bot não consegue cobrar automaticamente.",
        to: editPath,
        cta: "Configurar",
      });

    if (!data.setup.hasWhatsapp)
      alerts.push({
        id: "wa",
        title: "WhatsApp desconectado",
        description: "Conecte o número para receber pedidos de verdade.",
        to: editPath,
        cta: "Conectar",
      });

    if (pending > 0)
      alerts.push({
        id: "pending",
        title: `${pending} pedido(s) aguardando pagamento`,
        description: "Confirme ou cancele para manter as comandas em dia.",
        to: "/orders",
        cta: "Ver comandas",
      });

    for (const p of data.lowStock)
      alerts.push({
        id: `stock-${p.id}`,
        title: `Estoque baixo: ${p.name}`,
        description: `Restam ${p.stock_quantity} unidade(s) em estoque.`,
        to: editPath,
        cta: "Repor",
      });
  }

  return (
    <Panel title="Alertas da loja" description="Verificações feitas na sua configuração real.">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tudo em ordem"
          description="Nenhum alerta pendente na sua loja neste momento."
        />
      ) : (
        <ul className="space-y-2">
          {alerts.slice(0, 5).map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
            >
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{a.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{a.description}</p>
              </div>
              <Link
                to={a.to}
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"
              >
                {a.cta} <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
