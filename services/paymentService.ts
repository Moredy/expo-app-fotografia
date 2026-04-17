import {
  CreateOrderCheckoutRequest,
  CreateOrderCheckoutResponse,
  CreateSubscriptionCheckoutRequest,
  CreateSubscriptionCheckoutResponse,
  ApiOrder,
  ApiSubscription,
} from '../types/payment';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

const TIMEOUT_MS = 15_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timerId);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Erro ${response.status}: ${response.statusText}`;

    const pickMessageFromRawBody = (text: string): string | null => {
      if (!text || !text.trim()) return null;
      const match = text.match(/mensagem\s*:\s*(.+)$/im);
      if (match?.[1]?.trim()) return match[1].trim();
      return text.trim();
    };

    const pickMessageFromBody = (body: any): string | null => {
      if (!body || typeof body !== 'object') return null;

      const asString = (value: unknown): string | null => {
        if (typeof value === 'string' && value.trim().length > 0) return value.trim();
        if (Array.isArray(value) && value.length > 0) return value.map(String).join('\n');
        return null;
      };

      return (
        asString(body.message) ??
        asString(body.mensagem) ??
        asString(body.error) ??
        asString(body.details) ??
        asString(body.detail)
      );
    };

    try {
      const rawBody = await response.text();
      let parsedBody: any = null;

      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = null;
        }
      }

      message = pickMessageFromBody(parsedBody) ?? pickMessageFromRawBody(rawBody) ?? message;
    } catch {
      // corpo não é JSON; mantém mensagem genérica
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

type GetToken = () => Promise<string | null>;
function normalizeCheckoutResponse<T extends { checkoutUrl?: string; orderId?: string }>(
  response: any,
): T {
  const data = response?.data && typeof response.data === 'object' ? response.data : null;

  const checkoutUrl =
    response?.checkoutUrl ??
    response?.paymentUrl ??
    response?.billingUrl ??
    response?.redirectUrl ??
    response?.url ??
    data?.checkoutUrl ??
    data?.paymentUrl ??
    data?.billingUrl ??
    data?.redirectUrl ??
    data?.url;

  const orderId = response?.orderId ?? response?.externalId ?? response?.id ?? data?.orderId ?? data?.externalId;

  if (!checkoutUrl || typeof checkoutUrl !== 'string') {
    throw new Error('Resposta de checkout invalida: URL de pagamento ausente.');
  }

  return {
    ...response,
    checkoutUrl,
    orderId,
  } as T;
}

// ─── Helpers de header ────────────────────────────────────────────────────────

async function resolveAuthHeaders(getToken: GetToken): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * Cria uma sessão de checkout para compra avulsa de fotos.
 * Retorna a URL de checkout do provedor de pagamento para redirecionamento.
 */
export async function createOrderCheckout(
  payload: CreateOrderCheckoutRequest,
  getToken: GetToken,
): Promise<CreateOrderCheckoutResponse> {
  const response = await fetchWithTimeout(`${BASE_URL}/payments/checkout/order`, {
    method: 'POST',
    headers: await resolveAuthHeaders(getToken),
    body: JSON.stringify({ currency: 'brl', ...payload }),
  });
  const raw = await handleResponse<any>(response);
  return normalizeCheckoutResponse<CreateOrderCheckoutResponse>(raw);
}

/**
 * Cria uma sessão de checkout para assinatura mensal.
 * Retorna a URL de checkout do provedor de pagamento para redirecionamento.
 */
export async function createSubscriptionCheckout(
  payload: CreateSubscriptionCheckoutRequest,
  getToken: GetToken,
): Promise<CreateSubscriptionCheckoutResponse> {
  const response = await fetchWithTimeout(`${BASE_URL}/payments/checkout/subscription`, {
    method: 'POST',
    headers: await resolveAuthHeaders(getToken),
    body: JSON.stringify({
      successUrl: payload.successUrl,
      cancelUrl: payload.cancelUrl,
    }),
  });
  const raw = await handleResponse<any>(response);
  return normalizeCheckoutResponse<CreateSubscriptionCheckoutResponse>(raw);
}

/**
 * Busca todos os pedidos de um usuário.
 */
export async function getUserOrders(userId: string, getToken: GetToken): Promise<ApiOrder[]> {
  const url = `${BASE_URL}/orders?userId=${encodeURIComponent(userId)}`;
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: await resolveAuthHeaders(getToken),
  });
  return handleResponse<ApiOrder[]>(response);
}

/**
 * Busca pedidos do usuário autenticado.
 */
export async function getOrders(getToken: GetToken): Promise<ApiOrder[]> {
  const response = await fetchWithTimeout(`${BASE_URL}/orders`, {
    method: 'GET',
    headers: await resolveAuthHeaders(getToken),
  });
  return handleResponse<ApiOrder[]>(response);
}

/**
 * Cancela um pedido criado no checkout e sincroniza o status no backend.
 */
export async function cancelOrderCheckout(orderId: string, getToken: GetToken): Promise<void> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/payments/checkout/order/${encodeURIComponent(orderId)}/cancel`,
    {
      method: 'POST',
      headers: await resolveAuthHeaders(getToken),
    },
  );

  await handleResponse<unknown>(response);
}

/**
 * Busca todas as assinaturas de um usuário.
 */
export async function getUserSubscriptions(userId: string, getToken: GetToken): Promise<ApiSubscription[]> {
  const url = `${BASE_URL}/subscriptions?userId=${encodeURIComponent(userId)}`;
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: await resolveAuthHeaders(getToken),
  });
  return handleResponse<ApiSubscription[]>(response);
}

/**
 * Busca assinaturas do usuário autenticado.
 */
export async function getSubscriptions(getToken: GetToken): Promise<ApiSubscription[]> {
  const response = await fetchWithTimeout(`${BASE_URL}/subscriptions`, {
    method: 'GET',
    headers: await resolveAuthHeaders(getToken),
  });
  return handleResponse<ApiSubscription[]>(response);
}

/**
 * Cancela uma assinatura ativa.
 */
export async function cancelSubscription(subscriptionId: string, getToken: GetToken): Promise<void> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: 'POST',
      headers: await resolveAuthHeaders(getToken),
    },
  );

  await handleResponse<unknown>(response);
}
