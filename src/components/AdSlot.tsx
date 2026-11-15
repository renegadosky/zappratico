import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { getMyMonetization, type MyMonetization } from "@/lib/monetization.functions";
import { useAuth } from "@/lib/auth-context";

/**
 * Monetização alternativa: anúncios discretos no canto inferior, exibidos
 * apenas quando a loja deixou de usar o pagamento oficial da plataforma.
 * Somem automaticamente no primeiro pedido pago pelo sistema oficial.
 */
export function AdSlot() {
  const { user } = useAuth();
  const load = useServerFn(getMyMonetization);
  const [status, setStatus] = useState<MyMonetization | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    load()
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [user, load]);

  if (!status?.adsEnabled || dismissed) return null;

  return (
    <aside
      aria-label="Publicidade"
      className="fixed bottom-4 right-4 z-40 hidden md:block w-64 rounded-xl border border-border bg-card/95 backdrop-blur p-3 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Publicidade
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Fechar anúncio"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 text-xs font-medium leading-snug">
        Sua loja está sem o pagamento oficial ativo.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
        Ative o PIX automático da plataforma e estes anúncios desaparecem no próximo pedido pago.
      </p>
      <a
        href="/bots"
        className="mt-2 inline-block text-[11px] font-medium text-primary hover:underline"
      >
        Ativar pagamento oficial →
      </a>
    </aside>
  );
}
