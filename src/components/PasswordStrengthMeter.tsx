import { useMemo } from "react";

const COMMON = new Set([
  "123456", "12345678", "123456789", "qwerty", "abc123", "password", "senha",
  "senha123", "111111", "000000", "admin", "iloveyou", "1q2w3e4r",
]);

export type StrengthLevel = "vazia" | "fraca" | "media" | "forte" | "excelente";

export function scorePassword(pwd: string): {
  level: StrengthLevel;
  score: number; // 0..4
  tips: string[];
  isAcceptable: boolean;
} {
  if (!pwd) return { level: "vazia", score: 0, tips: [], isAcceptable: false };

  const tips: string[] = [];
  let score = 0;

  const lengthOk = pwd.length >= 8;
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pwd);

  if (lengthOk) score++; else tips.push("Use pelo menos 8 caracteres");
  if (hasLower && hasUpper) score++; else tips.push("Misture letras maiúsculas e minúsculas");
  if (hasNumber) score++; else tips.push("Inclua pelo menos um número");
  if (hasSymbol) score++; else tips.push("Adicione um símbolo (!, @, #, …) pra ficar forte");
  if (pwd.length >= 12) score = Math.min(4, score + 1);

  const lower = pwd.toLowerCase();
  const isCommon = COMMON.has(lower) || /^(.)\1+$/.test(pwd) || /^(012|123|234|345|456|567|678|789|890|abc|qwe)/i.test(pwd);

  let level: StrengthLevel = "fraca";
  if (isCommon) {
    level = "fraca";
    score = 0;
    tips.unshift("Essa senha é muito comum — escolha algo único");
  } else if (score >= 4) level = "excelente";
  else if (score === 3) level = "forte";
  else if (score === 2) level = "media";
  else level = "fraca";

  const isAcceptable = !isCommon && pwd.length >= 6 && score >= 2;
  return { level, score, tips: tips.slice(0, 2), isAcceptable };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { level, score, tips } = useMemo(() => scorePassword(password), [password]);

  if (!password) return null;

  const colors: Record<StrengthLevel, string> = {
    vazia: "bg-muted",
    fraca: "bg-destructive",
    media: "bg-yellow-500",
    forte: "bg-primary",
    excelente: "bg-emerald-500",
  };

  const labels: Record<StrengthLevel, string> = {
    vazia: "",
    fraca: "Fraca",
    media: "Média",
    forte: "Forte",
    excelente: "Excelente",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[level] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${
          level === "fraca" ? "text-destructive" :
          level === "media" ? "text-yellow-500" :
          level === "forte" ? "text-primary" :
          level === "excelente" ? "text-emerald-500" : "text-muted-foreground"
        }`}>{labels[level]}</span>
        {tips[0] && <span className="text-muted-foreground text-right">{tips[0]}</span>}
      </div>
    </div>
  );
}
