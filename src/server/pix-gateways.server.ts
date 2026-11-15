/**
 * Cobranças PIX dinâmicas com SPLIT AUTOMÁTICO da taxa da plataforma.
 *
 * - Mercado Pago: cria o pagamento PIX com o token do lojista e aplica
 *   `application_fee` (a taxa vai para a conta da plataforma automaticamente).
 * - Asaas: cria a cobrança PIX com a API key do lojista e um `split` fixo
 *   para a carteira (walletId) da plataforma.
 *
 * Roda SOMENTE no servidor. Se algo falhar, o chamador cai no PIX manual.
 */

export type GatewayProvider = "mercadopago" | "asaas";

export interface GatewayCredentials {
  mpAccessToken?: string | null;
  asaasApiKey?: string | null;
}

export interface PlatformSplitConfig {
  /** walletId da plataforma no Asaas (recebe a taxa) */
  asaasWalletId?: string | null;
  /** user id (collector) da plataforma no Mercado Pago — informativo */
  mpUserId?: string | null;
}

export interface GatewayChargeInput {
  provider: GatewayProvider;
  credentials: GatewayCredentials;
  platform: PlatformSplitConfig;
  /** valor total cobrado do cliente, em centavos (produtos + taxa) */
  grossCents: number;
  /** taxa da plataforma, em centavos */
  feeCents: number;
  description: string;
  customerName?: string | null;
  customerPhone?: string | null;
  /** CPF/CNPJ apenas números — obrigatório no Asaas */
  customerDoc?: string | null;
  externalReference?: string | null;
}

export interface GatewayCharge {
  provider: GatewayProvider;
  chargeId: string;
  /** PIX copia e cola */
  payload: string;
  /** URL de imagem do QR (data URL quando o provedor devolve base64) */
  qrUrl?: string;
  expiresAt?: string | null;
  /** taxa efetivamente enviada no split */
  splitFeeCents: number;
}

const MP_API = "https://api.mercadopago.com";
const ASAAS_API = "https://api.asaas.com/v3";
const ASAAS_SANDBOX_API = "https://api-sandbox.asaas.com/v3";

function asaasBase(apiKey: string): string {
  // chaves de sandbox do Asaas contêm "hmlg"
  return apiKey.includes("hmlg") ? ASAAS_SANDBOX_API : ASAAS_API;
}

function reais(cents: number): number {
  return Math.round(Math.max(0, cents)) / 100;
}

function onlyDigits(v?: string | null): string {
  return (v ?? "").replace(/\D/g, "");
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `[${res.status}] ${body.slice(0, 500)}`;
}

/* -------------------------------- Mercado Pago -------------------------------- */

async function createMercadoPagoPix(input: GatewayChargeInput): Promise<GatewayCharge> {
  const token = input.credentials.mpAccessToken?.trim();
  if (!token) throw new Error("Access Token do Mercado Pago não configurado.");

  const idempotency = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  const body: Record<string, unknown> = {
    transaction_amount: reais(input.grossCents),
    description: input.description.slice(0, 250),
    payment_method_id: "pix",
    date_of_expiration: expires.toISOString().replace("Z", "-00:00"),
    payer: {
      email: `cliente-${onlyDigits(input.customerPhone) || "zap"}@zappratico.com.br`,
      first_name: (input.customerName ?? "Cliente").slice(0, 40),
      ...(onlyDigits(input.customerDoc).length >= 11 && {
        identification: { type: "CPF", number: onlyDigits(input.customerDoc) },
      }),
    },
    ...(input.externalReference && { external_reference: input.externalReference }),
  };
  // Split: a taxa da plataforma sai do valor recebido pelo lojista.
  if (input.feeCents > 0) body["application_fee"] = reais(input.feeCents);

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotency,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await readError(res);
    console.error("[mercadopago] pix create failed", err);
    throw new Error(`Mercado Pago recusou a cobrança ${err}`);
  }

  const data = (await res.json()) as {
    id: number | string;
    date_of_expiration?: string;
    point_of_interaction?: {
      transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
    };
  };
  const td = data.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw new Error("Mercado Pago não devolveu o código PIX.");

  return {
    provider: "mercadopago",
    chargeId: String(data.id),
    payload: td.qr_code,
    qrUrl: td.qr_code_base64
      ? `data:image/png;base64,${td.qr_code_base64}`
      : `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=10&data=${encodeURIComponent(td.qr_code)}`,
    expiresAt: data.date_of_expiration ?? expires.toISOString(),
    splitFeeCents: input.feeCents,
  };
}

/* ------------------------------------ Asaas ----------------------------------- */

async function asaasFetch(
  apiKey: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<Response> {
  return fetch(`${asaasBase(apiKey)}${path}`, {
    method: init.method,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      "User-Agent": "ZapPratico",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
}

async function resolveAsaasCustomer(apiKey: string, input: GatewayChargeInput): Promise<string> {
  const doc = onlyDigits(input.customerDoc);
  if (doc.length !== 11 && doc.length !== 14) {
    throw new Error("O Asaas exige o CPF/CNPJ do cliente para gerar a cobrança PIX.");
  }
  const found = await asaasFetch(apiKey, `/customers?cpfCnpj=${doc}&limit=1`, { method: "GET" });
  if (found.ok) {
    const list = (await found.json()) as { data?: { id: string }[] };
    if (list.data?.length) return list.data[0]!.id;
  }
  const created = await asaasFetch(apiKey, "/customers", {
    method: "POST",
    body: {
      name: (input.customerName ?? "Cliente WhatsApp").slice(0, 100),
      cpfCnpj: doc,
      ...(onlyDigits(input.customerPhone) && { mobilePhone: onlyDigits(input.customerPhone).slice(-11) }),
      notificationDisabled: true,
    },
  });
  if (!created.ok) throw new Error(`Asaas não criou o cliente ${await readError(created)}`);
  const cust = (await created.json()) as { id: string };
  return cust.id;
}

async function createAsaasPix(input: GatewayChargeInput): Promise<GatewayCharge> {
  const apiKey = input.credentials.asaasApiKey?.trim();
  if (!apiKey) throw new Error("API Key do Asaas não configurada.");

  const customerId = await resolveAsaasCustomer(apiKey, input);
  const wallet = input.platform.asaasWalletId?.trim();

  const res = await asaasFetch(apiKey, "/payments", {
    method: "POST",
    body: {
      customer: customerId,
      billingType: "PIX",
      value: reais(input.grossCents),
      dueDate: new Date().toISOString().slice(0, 10),
      description: input.description.slice(0, 500),
      ...(input.externalReference && { externalReference: input.externalReference }),
      ...(wallet && input.feeCents > 0
        ? { split: [{ walletId: wallet, fixedValue: reais(input.feeCents) }] }
        : {}),
    },
  });
  if (!res.ok) {
    const err = await readError(res);
    console.error("[asaas] payment create failed", err);
    throw new Error(`Asaas recusou a cobrança ${err}`);
  }
  const pay = (await res.json()) as { id: string; dueDate?: string };

  const qr = await asaasFetch(apiKey, `/payments/${pay.id}/pixQrCode`, { method: "GET" });
  if (!qr.ok) throw new Error(`Asaas não devolveu o QR PIX ${await readError(qr)}`);
  const qrData = (await qr.json()) as {
    payload?: string;
    encodedImage?: string;
    expirationDate?: string;
  };
  if (!qrData.payload) throw new Error("Asaas não devolveu o código PIX.");

  return {
    provider: "asaas",
    chargeId: pay.id,
    payload: qrData.payload,
    qrUrl: qrData.encodedImage
      ? `data:image/png;base64,${qrData.encodedImage}`
      : `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=10&data=${encodeURIComponent(qrData.payload)}`,
    expiresAt: qrData.expirationDate ?? null,
    splitFeeCents: wallet ? input.feeCents : 0,
  };
}

/* ----------------------------------- público ---------------------------------- */

export async function createGatewayPixCharge(input: GatewayChargeInput): Promise<GatewayCharge> {
  if (input.grossCents <= 0) throw new Error("Valor inválido para a cobrança.");
  return input.provider === "mercadopago"
    ? createMercadoPagoPix(input)
    : createAsaasPix(input);
}

/** Consulta o status de um pagamento no provedor (usado pelo webhook). */
export async function fetchGatewayPaymentStatus(args: {
  provider: GatewayProvider;
  credentials: GatewayCredentials;
  chargeId: string;
}): Promise<{ paid: boolean; status: string }> {
  if (args.provider === "mercadopago") {
    const token = args.credentials.mpAccessToken?.trim();
    if (!token) return { paid: false, status: "no_credentials" };
    const res = await fetch(`${MP_API}/v1/payments/${args.chargeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { paid: false, status: `error_${res.status}` };
    const data = (await res.json()) as { status?: string };
    return { paid: data.status === "approved", status: data.status ?? "unknown" };
  }

  const apiKey = args.credentials.asaasApiKey?.trim();
  if (!apiKey) return { paid: false, status: "no_credentials" };
  const res = await asaasFetch(apiKey, `/payments/${args.chargeId}`, { method: "GET" });
  if (!res.ok) return { paid: false, status: `error_${res.status}` };
  const data = (await res.json()) as { status?: string };
  return {
    paid: data.status === "RECEIVED" || data.status === "CONFIRMED" || data.status === "RECEIVED_IN_CASH",
    status: data.status ?? "unknown",
  };
}

/* --------------------------- reembolso / estorno ---------------------------- */

export interface GatewayRefundResult {
  ok: boolean;
  status: string;
  refundedCents: number;
  message?: string;
}

/**
 * Solicita o reembolso (total ou parcial) da cobrança no provedor.
 * Nunca confia em valores do frontend: quem chama já validou o dono do pedido.
 */
export async function refundGatewayPayment(args: {
  provider: GatewayProvider;
  credentials: GatewayCredentials;
  chargeId: string;
  amountCents?: number | null;
}): Promise<GatewayRefundResult> {
  if (args.provider === "mercadopago") {
    const token = args.credentials.mpAccessToken?.trim();
    if (!token) return { ok: false, status: "no_credentials", refundedCents: 0, message: "Access Token do Mercado Pago não configurado." };
    const res = await fetch(`${MP_API}/v1/payments/${args.chargeId}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `refund-${args.chargeId}-${args.amountCents ?? "full"}`,
      },
      ...(args.amountCents && args.amountCents > 0
        ? { body: JSON.stringify({ amount: reais(args.amountCents) }) }
        : {}),
    });
    if (!res.ok) {
      const err = await readError(res);
      console.error("[mp] refund failed", err);
      return { ok: false, status: "error", refundedCents: 0, message: `Mercado Pago recusou o reembolso ${err}` };
    }
    const data = (await res.json()) as { amount?: number; status?: string };
    return {
      ok: true,
      status: data.status ?? "refunded",
      refundedCents: Math.round((data.amount ?? 0) * 100) || (args.amountCents ?? 0),
    };
  }

  const apiKey = args.credentials.asaasApiKey?.trim();
  if (!apiKey) return { ok: false, status: "no_credentials", refundedCents: 0, message: "API Key do Asaas não configurada." };
  const res = await asaasFetch(apiKey, `/payments/${args.chargeId}/refund`, {
    method: "POST",
    ...(args.amountCents && args.amountCents > 0 ? { body: { value: reais(args.amountCents) } } : {}),
  });
  if (!res.ok) {
    const err = await readError(res);
    console.error("[asaas] refund failed", err);
    return { ok: false, status: "error", refundedCents: 0, message: `Asaas recusou o reembolso ${err}` };
  }
  const data = (await res.json()) as { status?: string; value?: number };
  return {
    ok: true,
    status: data.status ?? "REFUNDED",
    refundedCents: args.amountCents && args.amountCents > 0 ? args.amountCents : Math.round((data.value ?? 0) * 100),
  };
}

/** Traduz o status bruto do provedor para um estado único do painel. */
export function normalizePaymentStatus(provider: GatewayProvider | string | null, raw?: string | null): {
  state: "pending" | "paid" | "refunded" | "partially_refunded" | "disputed" | "canceled" | "expired" | "unknown";
  raw: string;
} {
  const s = (raw ?? "").toLowerCase();
  if (!s) return { state: "unknown", raw: "" };
  if (["approved", "received", "confirmed", "received_in_cash"].includes(s)) return { state: "paid", raw: s };
  if (["refunded", "charged_back_refunded"].includes(s)) return { state: "refunded", raw: s };
  if (["partially_refunded", "refund_requested", "refund_in_progress"].includes(s)) return { state: "partially_refunded", raw: s };
  if (["in_mediation", "charged_back", "chargeback_requested", "chargeback_dispute", "awaiting_chargeback_reversal", "dispute"].includes(s)) return { state: "disputed", raw: s };
  if (["cancelled", "canceled", "rejected"].includes(s)) return { state: "canceled", raw: s };
  if (["expired", "overdue"].includes(s)) return { state: "expired", raw: s };
  if (["pending", "in_process", "authorized", "awaiting_risk_analysis"].includes(s)) return { state: "pending", raw: s };
  return { state: "unknown", raw: s };
}
