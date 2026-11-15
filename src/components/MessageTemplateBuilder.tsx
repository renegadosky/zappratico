import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Variable { key: string; label: string; sample: string; }
const DEFAULT_VARS: Variable[] = [
  { key: "produto", label: "Nome do produto", sample: "Camiseta básica preta" },
  { key: "preco", label: "Preço", sample: "R$ 49,90" },
];

export function MessageTemplateBuilder({
  value,
  onChange,
  variables = DEFAULT_VARS,
  label = 'Mensagem do botão "Comprar"',
  helper = "Quando o cliente clicar em \"Comprar pelo WhatsApp\", essa mensagem vai chegar pra você. Use os botões abaixo pra colocar o nome e o preço sem digitar.",
}: {
  value: string;
  onChange: (v: string) => void;
  variables?: Variable[];
  label?: string;
  helper?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (key: string) => {
    const el = ref.current;
    const token = `{${key}}`;
    if (!el) { onChange((value ?? "") + token); return; }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const preview = (value ?? "").replace(/\{(\w+)\}/g, (_m, k) => {
    const v = variables.find((v) => v.key === k);
    return v ? v.sample : `{${k}}`;
  });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{label}</Label>
        <Textarea
          ref={ref}
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Olá! Quero comprar..."
        />
        <p className="text-xs text-muted-foreground">{helper}</p>
        <div className="flex flex-wrap gap-1.5">
          {variables.map((v) => (
            <Button
              key={v.key}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => insert(v.key)}
            >
              + {v.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-[#0b141a] p-3 border border-border">
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 px-1">Como vai chegar no seu WhatsApp</div>
        <div className="flex">
          <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-[#202c33] text-white text-sm px-3 py-2 whitespace-pre-wrap shadow">
            {preview || <span className="text-white/40">(escreva a mensagem acima)</span>}
            <div className="text-[10px] text-white/40 text-right mt-1">12:34</div>
          </div>
        </div>
      </div>
    </div>
  );
}
