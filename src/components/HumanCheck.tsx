import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * "Não sou um robô" — caixa simples com verificação comportamental:
 * - honeypot escondido (bots costumam preencher)
 * - delay mínimo entre montagem e clique (bots clicam instantâneo)
 * - pequena animação de "verificando" para dar a sensação familiar
 */
export interface HumanCheckHandle {
  isHuman: boolean;
  honeypot: string;
}

export function HumanCheck({
  onChange,
}: {
  onChange: (state: HumanCheckHandle) => void;
}) {
  const [checked, setChecked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    onChange({ isHuman: checked, honeypot });
  }, [checked, honeypot, onChange]);

  const handleClick = () => {
    if (checked || verifying) return;
    const elapsed = Date.now() - mountedAt.current;
    // bots costumam clicar em < 600ms; pedimos pelo menos 700ms de presença
    if (elapsed < 700) {
      // simula verificação demorada para parecer real, mas marca depois
      setVerifying(true);
      setTimeout(() => {
        setVerifying(false);
        setChecked(true);
      }, 800 - Math.min(elapsed, 700));
      return;
    }
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setChecked(true);
    }, 400);
  };

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2.5 flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={verifying || checked}
        aria-pressed={checked}
        className={`h-6 w-6 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
          checked
            ? "bg-primary border-primary"
            : "border-muted-foreground/40 hover:border-primary"
        }`}
      >
        {verifying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : checked ? (
          <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
        ) : null}
      </button>
      <span className="text-sm select-none">Não sou um robô</span>

      {/* honeypot - escondido de humanos, bots costumam preencher */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        aria-hidden="true"
      />
    </div>
  );
}
