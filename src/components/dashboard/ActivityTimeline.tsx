import { Activity } from "lucide-react";
import type { EventRow } from "@/lib/use-dashboard";
import { EmptyState, Panel, STATUS_LABEL, Skeleton } from "./primitives";

const TYPE_LABEL: Record<string, string> = {
  created: "Pedido criado",
  status_changed: "Status alterado",
  note: "Nota interna",
  message_sent: "Mensagem enviada",
  refund: "Pedido cancelado",
};

function describe(e: EventRow) {
  if (e.type === "status_changed" && e.to_status) {
    return `${STATUS_LABEL[e.from_status ?? ""] ?? e.from_status ?? "—"} → ${
      STATUS_LABEL[e.to_status] ?? e.to_status
    }`;
  }
  return e.message ?? TYPE_LABEL[e.type] ?? e.type;
}

export function ActivityTimeline({ events, loading }: { events: EventRow[]; loading: boolean }) {
  return (
    <Panel title="Atividade recente" description="Eventos registrados pelo sistema.">
      {loading ? (
        <ul className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex gap-3">
              <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </li>
          ))}
        </ul>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma atividade ainda"
          description="Criações de pedidos, mudanças de status e mensagens aparecem aqui."
        />
      ) : (
        <ol className="relative space-y-4 pl-4 before:absolute before:left-[3px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-4 top-1.5 h-[7px] w-[7px] rounded-full bg-primary/70 ring-2 ring-card" />
              <p className="text-xs font-medium leading-snug">{TYPE_LABEL[e.type] ?? e.type}</p>
              <p className="text-xs text-muted-foreground leading-snug truncate">{describe(e)}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {new Date(e.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
