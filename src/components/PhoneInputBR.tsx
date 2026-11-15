import { Input } from "@/components/ui/input";

/** Aceita só dígitos BR (DDD + número). Armazena E.164 (+55...). */
function formatBR(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function toE164(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (!d) return "";
  return `+55${d}`;
}

function fromE164(value: string | null | undefined) {
  if (!value) return "";
  const d = value.replace(/\D/g, "");
  return d.startsWith("55") ? d.slice(2) : d;
}

export function PhoneInputBR({
  value,
  onChange,
  placeholder = "(11) 99999-9999",
}: {
  value: string | null;
  onChange: (e164: string) => void;
  placeholder?: string;
}) {
  const digits = fromE164(value);
  return (
    <div className="flex gap-2 items-stretch">
      <div className="inline-flex items-center gap-1.5 px-3 rounded-md border border-input bg-background text-sm">
        <span aria-hidden>🇧🇷</span>
        <span className="text-muted-foreground">+55</span>
      </div>
      <Input
        type="tel"
        inputMode="numeric"
        value={digits ? formatBR(digits) : ""}
        onChange={(e) => onChange(toE164(e.target.value))}
        placeholder={placeholder}
      />
    </div>
  );
}
