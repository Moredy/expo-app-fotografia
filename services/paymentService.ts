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
    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // corpo não é JSON; mantém mensagem genérica
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

type GetToken = () => Promise<string | null>;

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
 * Retorna a URL do Stripe Hosted Checkout para redirecionamento.
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
  return handleResponse<CreateOrderCheckoutResponse>(response);
}

/**
 * Cria uma sessão de checkout para assinatura mensal ou anual.
 * Retorna a URL do Stripe Hosted Checkout para redirecionamento.
 */
export async function createSubscriptionCheckout(
  payload: CreateSubscriptionCheckoutRequest,
  getToken: GetToken,
): Promise<CreateSubscriptionCheckoutResponse> {
  const response = await fetchWithTimeout(`${BASE_URL}/payments/checkout/subscription`, {
    method: 'POST',
    headers: await resolveAuthHeaders(getToken),
    body: JSON.stringify({ currency: 'brl', ...payload }),
  });
  return handleResponse<CreateSubscriptionCheckoutResponse>(response);
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
