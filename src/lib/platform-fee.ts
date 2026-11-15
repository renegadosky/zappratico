/**
 * Cálculo da taxa da plataforma (padrão: 1% por pedido).
 * Funções puras — usadas no servidor (fonte da verdade) e para exibição no painel.
 * O frontend NUNCA define a porcentagem: ela vem sempre de `platform_settings`.
 */
export const DEFAULT_FEE_PERCENT = 1;
export const MAX_FEE_PERCENT = 20;
export const DEFAULT_ADS_THRESHOLD = 10;

export interface FeeBreakdown {
  /** valor dos produtos (fica com o lojista) */
  netCents: number;
  /** taxa da plataforma */
  feeCents: number;
  /** valor total cobrado do cliente (produtos + taxa) */
  grossCents: number;
  feePercent: number;
}

export function computePlatformFee(
  subtotalCents: number,
  feePercent: number = DEFAULT_FEE_PERCENT,
): FeeBreakdown {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const pct = Number.isFinite(feePercent)
    ? Math.max(0, Math.min(MAX_FEE_PERCENT, Number(feePercent)))
    : DEFAULT_FEE_PERCENT;
  const feeCents = Math.round((subtotal * pct) / 100);
  return { netCents: subtotal, feeCents, grossCents: subtotal + feeCents, feePercent: pct };
}

export function formatFeePercent(pct: number): string {
  const v = Number(pct ?? DEFAULT_FEE_PERCENT);
  return `${(Number.isFinite(v) ? v : DEFAULT_FEE_PERCENT)
    .toString()
    .replace(".", ",")
    .replace(/,0+$/, "")}%`;
}

export function formatCentsBRL(cents: number): string {
  return ((Number(cents) || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
