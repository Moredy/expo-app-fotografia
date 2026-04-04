const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

const TIMEOUT_MS = 15_000;

type GetToken = () => Promise<string | null>;

export class CartHttpError extends Error {
  status: number;
  statusText: string;
  url: string;
  rawBody: string;
  parsedBody: unknown;

  constructor(
    message: string,
    meta: {
      status: number;
      statusText: string;
      url: string;
      rawBody: string;
      parsedBody: unknown;
    },
  ) {
    super(message);
    this.name = 'CartHttpError';
    this.status = meta.status;
    this.statusText = meta.statusText;
    this.url = meta.url;
    this.rawBody = meta.rawBody;
    this.parsedBody = meta.parsedBody;
  }
}

export interface BackendCartItem {
  photoId: string;
  photoUrl: string | null;
  eventTitle: string;
  unitPrice: number;
}

export interface BackendCartState {
  userId: string | null;
  items: BackendCartItem[];
  summary: {
    itemsCount: number;
    totalAmount: number;
  };
}

interface RawCartItem {
  userId?: string;
  photoId?: string;
  addedAt?: string;
  photoUrl?: string | null;
  thumbnailUrl?: string | null;
  originalUrl?: string | null;
  url?: string | null;
  photo?: {
    id?: string;
    eventId?: string;
    priceIndividual?: string | number | null;
    isAvailable?: boolean;
    thumbnailUrl?: string | null;
    originalUrl?: string | null;
    url?: string | null;
    event?: {
      id?: string;
      title?: string | null;
      eventDate?: string;
      location?: string;
    } | null;
  } | null;
}

interface RawCartResponse {
  userId?: string;
  items?: RawCartItem[];
  summary?: {
    itemsCount?: number;
    totalAmount?: string | number;
  };
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timerId);
  }
}

async function resolveAuthHeaders(getToken: GetToken): Promise<Record<string, string>> {
  let token: string | null = null;
  try {
    token = await getToken();
  } catch (err: unknown) {
    if (__DEV__) {
      console.log('[cartService] getToken failed', {
        rawError: err,
      });
    }
    throw new Error('Falha ao obter token de autenticacao (Clerk).');
  }

  if (!token) throw new Error('Sessao expirada. Faca login novamente.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text();
  let parsedBody: any = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    const defaultMessage = `Erro ${response.status}: ${response.statusText}`;
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

    const message =
      pickMessageFromBody(parsedBody) ?? pickMessageFromRawBody(rawBody) ?? defaultMessage;

    if (__DEV__) {
      console.log('[cartService] HTTP error response', {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        rawBody,
        parsedBody,
      });
    }

    throw new CartHttpError(message, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      rawBody,
      parsedBody,
    });
  }

  if (!rawBody) {
    return undefined as T;
  }

  return (parsedBody ?? rawBody) as T;
}

function sanitizePhotoUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  const safeDecode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const encodedMatch =
    trimmedUrl.match(/https?%3A%2F%2F.+$/i) ?? trimmedUrl.match(/https?%3A\/\/.+$/i);
  if (encodedMatch) return safeDecode(encodedMatch[0]);

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  if (trimmedUrl.startsWith('//')) {
    return `https:${trimmedUrl}`;
  }

  if (trimmedUrl.startsWith('/')) {
    return `${BASE_URL}${trimmedUrl}`;
  }

  return `${BASE_URL}/${trimmedUrl.replace(/^\/+/, '')}`;
}

function toNumber(value: string | number | null | undefined, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeCartItem(item: RawCartItem): BackendCartItem | null {
  const photoId = item.photoId ?? item.photo?.id;
  if (!photoId) return null;

  const photoUrl = sanitizePhotoUrl(
    item.photo?.thumbnailUrl ??
      item.photo?.url ??
      item.photo?.originalUrl ??
      item.thumbnailUrl ??
      item.url ??
      item.originalUrl ??
      item.photoUrl,
  );

  const eventTitle = item.photo?.event?.title ?? 'Evento';
  const unitPrice = toNumber(item.photo?.priceIndividual, 0);

  return {
    photoId,
    photoUrl,
    eventTitle,
    unitPrice,
  };
}

export async function getCart(getToken: GetToken): Promise<BackendCartState> {
  const response = await fetchWithTimeout(`${BASE_URL}/cart`, {
    method: 'GET',
    headers: await resolveAuthHeaders(getToken),
  });

  const payload = await handleResponse<RawCartResponse>(response);
  const items = (payload.items ?? [])
    .map(normalizeCartItem)
    .filter((item): item is BackendCartItem => Boolean(item));

  const summaryItemsCount = payload.summary?.itemsCount ?? items.length;
  const summaryTotalAmount = toNumber(
    payload.summary?.totalAmount,
    items.reduce((acc, item) => acc + item.unitPrice, 0),
  );

  return {
    userId: payload.userId ?? null,
    items,
    summary: {
      itemsCount: summaryItemsCount,
      totalAmount: summaryTotalAmount,
    },
  };
}

export async function addCartItem(photoId: string, getToken: GetToken): Promise<void> {
  const response = await fetchWithTimeout(`${BASE_URL}/cart/items`, {
    method: 'POST',
    headers: await resolveAuthHeaders(getToken),
    body: JSON.stringify({ photoId }),
  });

  await handleResponse<unknown>(response);
}

export async function removeCartItem(photoId: string, getToken: GetToken): Promise<void> {
  const response = await fetchWithTimeout(`${BASE_URL}/cart/items/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
    headers: await resolveAuthHeaders(getToken),
  });

  await handleResponse<unknown>(response);
}

export async function clearCartItems(getToken: GetToken): Promise<void> {
  const response = await fetchWithTimeout(`${BASE_URL}/cart/items`, {
    method: 'DELETE',
    headers: await resolveAuthHeaders(getToken),
  });

  await handleResponse<unknown>(response);
}
