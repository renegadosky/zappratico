/** Aparência da Mini-loja: temas prontos + ajustes de layout. */

export interface StoreLayout {
  /** grade de cards ou lista horizontal */
  mode: "grid" | "list";
  /** tamanho dos cards */
  card: "large" | "compact";
  /** colunas no desktop */
  columns: 2 | 3 | 4;
  /** proporção da imagem */
  image: "square" | "wide" | "tall";
  /** espaçamento entre itens */
  gap: "tight" | "normal" | "airy";
}

export const DEFAULT_LAYOUT: StoreLayout = {
  mode: "grid",
  card: "large",
  columns: 2,
  image: "square",
  gap: "normal",
};

export function parseLayout(value: unknown): StoreLayout {
  const v = (value ?? {}) as Partial<StoreLayout>;
  return {
    mode: v.mode === "list" ? "list" : "grid",
    card: v.card === "compact" ? "compact" : "large",
    columns: v.columns === 3 || v.columns === 4 ? v.columns : 2,
    image: v.image === "wide" || v.image === "tall" ? v.image : "square",
    gap: v.gap === "tight" || v.gap === "airy" ? v.gap : "normal",
  };
}

export interface StoreTheme {
  slug: string;
  name: string;
  theme: string;
  accent: string;
  secondary: string;
  text: string;
  font: string;
  button: ButtonStyle;
  layout: StoreLayout;
}

export type ButtonStyle = "rounded" | "square" | "pill";

export const STORE_THEMES: StoreTheme[] = [
  {
    slug: "classic", name: "Clássico", theme: "#10b981", accent: "#0f172a", secondary: "#1e293b",
    text: "#ffffff", font: "sans", button: "rounded", layout: DEFAULT_LAYOUT,
  },
  {
    slug: "modern", name: "Moderno", theme: "#6366f1", accent: "#12102b", secondary: "#211d47",
    text: "#ffffff", font: "display", button: "pill",
    layout: { mode: "grid", card: "large", columns: 3, image: "wide", gap: "airy" },
  },
  {
    slug: "minimal", name: "Minimalista", theme: "#111827", accent: "#f8fafc", secondary: "#ffffff",
    text: "#0f172a", font: "sans", button: "square",
    layout: { mode: "grid", card: "compact", columns: 3, image: "square", gap: "tight" },
  },
  {
    slug: "food", name: "Cardápio", theme: "#ef4444", accent: "#1a0a0a", secondary: "#2a1010",
    text: "#fff7ed", font: "serif", button: "rounded",
    layout: { mode: "list", card: "large", columns: 2, image: "square", gap: "normal" },
  },
  {
    slug: "compact", name: "Compacto", theme: "#0ea5e9", accent: "#0b1220", secondary: "#131f36",
    text: "#ffffff", font: "sans", button: "square",
    layout: { mode: "grid", card: "compact", columns: 4, image: "square", gap: "tight" },
  },
];

export function buttonRadius(style: string | null | undefined): string {
  if (style === "square") return "0.25rem";
  if (style === "pill") return "9999px";
  return "0.75rem";
}

export function gapClass(gap: StoreLayout["gap"]): string {
  return gap === "tight" ? "gap-2" : gap === "airy" ? "gap-6" : "gap-4";
}

export function columnsClass(columns: number): string {
  if (columns === 4) return "sm:grid-cols-2 lg:grid-cols-4";
  if (columns === 3) return "sm:grid-cols-2 lg:grid-cols-3";
  return "sm:grid-cols-2";
}

export function imageAspectClass(image: StoreLayout["image"]): string {
  return image === "wide" ? "aspect-[4/3]" : image === "tall" ? "aspect-[3/4]" : "aspect-square";
}

/** Horário: diz se a loja está aberta agora (fuso do próprio visitante). */
export const WEEK_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function isOpenNow(hours: Record<string, { open: string; close: string; closed?: boolean } | undefined> | null): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const now = new Date();
  const key = WEEK_KEYS[now.getDay()];
  const h = hours[key];
  if (!h || h.closed) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (s: string) => {
    const [hh, mm] = s.split(":").map((n) => parseInt(n, 10) || 0);
    return hh * 60 + mm;
  };
  const open = toMin(h.open ?? "00:00");
  const close = toMin(h.close ?? "23:59");
  if (close <= open) return minutes >= open || minutes <= close; // vira a meia-noite
  return minutes >= open && minutes <= close;
}
