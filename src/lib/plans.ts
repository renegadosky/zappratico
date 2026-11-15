export type PlanId = "free" | "pro" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  priceLabel: string;
  botLimit: number; // Infinity = ilimitado
  storeLimit: number; // quantas lojas/empresas o usuário pode gerenciar
  features: string[];
  /** features que ficam BLOQUEADAS visualmente quando o usuário não tem este plano */
  proFeatures?: string[];
  highlighted?: boolean;
  /** plano interno (não aparece na vitrine de planos) */
  hidden?: boolean;
}

/** Planos vendáveis (exibidos ao usuário) */
export function getVisiblePlans(): Plan[] {
  return PLANS.filter((p) => !p.hidden);
}

export function getStoreLimit(planId: string | null | undefined): number {
  return getPlan(planId).storeLimit;
}

/**
 * Recursos travados por plano (gate visual + lógico).
 * - free: bot + WhatsApp + mini-loja básica (sem personalização visual avançada)
 * - pro: + simulador de teste, editor visual da mini-loja, QR PIX automático, multi-bot
 * - business: ilimitado + Assistente de Criação avançada
 */
export const PRO_FEATURES = {
  TEST_SIMULATOR: "test_simulator",
  STORE_VISUAL_EDITOR: "store_visual_editor",
  PIX_QR_AUTO: "pix_qr_auto",
  MULTI_BOT: "multi_bot",
  MULTI_STORE: "multi_store",
} as const;

export type ProFeature = (typeof PRO_FEATURES)[keyof typeof PRO_FEATURES];

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Sem assinatura",
    price: "R$ 0",
    priceLabel: "sem plano ativo",
    botLimit: 1,
    storeLimit: 1,
    hidden: true,
    features: [
      "1 loja com 1 bot",
      "Catálogo ilimitado de produtos",
      "PIX manual",
      "Mini-loja pública",
    ],
  },
  {
    id: "pro",
    name: "Profissional",
    price: "R$ 49",
    priceLabel: "por mês",
    botLimit: 5,
    storeLimit: 5,
    highlighted: true,
    features: [
      "Até 5 lojas (1 bot por loja)",
      "Simulador de teste do bot",
      "Editor visual da mini-loja",
      "QR Code PIX automático",
      "Suporte prioritário",
    ],
    proFeatures: [
      PRO_FEATURES.TEST_SIMULATOR,
      PRO_FEATURES.STORE_VISUAL_EDITOR,
      PRO_FEATURES.PIX_QR_AUTO,
      PRO_FEATURES.MULTI_STORE,
    ],
  },

  {
    id: "business",
    name: "Business",
    price: "R$ 149",
    priceLabel: "por mês",
    botLimit: Infinity,
    storeLimit: Infinity,
    features: [
      "Lojas e bots ilimitados",
      "Catálogo nativo do WhatsApp",
      "Assistente de Criação avançada",
      "Suporte dedicado",
    ],
    proFeatures: [
      PRO_FEATURES.TEST_SIMULATOR,
      PRO_FEATURES.STORE_VISUAL_EDITOR,
      PRO_FEATURES.PIX_QR_AUTO,
      PRO_FEATURES.MULTI_BOT,
      PRO_FEATURES.MULTI_STORE,
    ],
  },
];

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Retorna true se o plano atual libera a feature. */
export function hasProFeature(planId: string | null | undefined, feature: ProFeature): boolean {
  const plan = getPlan(planId);
  return plan.proFeatures?.includes(feature) ?? false;
}
