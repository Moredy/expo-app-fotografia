import { ApiEvent, ApiPhoto } from '../types/payment';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

const TIMEOUT_MS = 15_000;
const TOKEN_TIMEOUT_MS = 8_000;

type GetToken = () => Promise<string | null>;

interface RawApiPhoto {
  id: string;
  eventId: string;
  priceIndividual?: string | number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  originalUrl?: string | null;
  isPurchased?: boolean;
  createdAt: string;
}

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

async function authHeaders(getToken: GetToken): Promise<Record<string, string>> {
  const token = await Promise.race([
    getToken(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS)),
  ]);
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Erro ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.message === 'string') message = body.message;
    } catch { /* mantém mensagem genérica */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function sanitizePhotoUrl(url?: string | null): string {
  if (!url) return '';
  const match = url.match(/https?%3A%2F%2F.+$/i) ?? url.match(/https?%3A\/\/.+$/i);
  if (match) return decodeURIComponent(match[0]);
  return url;
}

function normalizePhoto(photo: RawApiPhoto): ApiPhoto {
  const parsedPrice = Number(photo.priceIndividual ?? 15);
  return {
    id: photo.id,
    eventId: photo.eventId,
    url: sanitizePhotoUrl(photo.thumbnailUrl ?? photo.url ?? photo.originalUrl),
    unitPrice: Number.isFinite(parsedPrice) ? parsedPrice : 15,
    isPurchased: photo.isPurchased ?? false,
    createdAt: photo.createdAt,
  };
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

export async function getEvents(getToken: GetToken): Promise<ApiEvent[]> {
  const response = await fetchWithTimeout(`${BASE_URL}/events`, {
    method: 'GET',
    headers: await authHeaders(getToken),
  });
  return handleResponse<ApiEvent[]>(response);
}

export async function getEventById(id: string, getToken: GetToken): Promise<ApiEvent> {
  const response = await fetchWithTimeout(`${BASE_URL}/events/${id}`, {
    method: 'GET',
    headers: await authHeaders(getToken),
  });
  return handleResponse<ApiEvent>(response);
}

// ─── Fotos do evento ──────────────────────────────────────────────────────────

export async function getEventPhotos(eventId: string, getToken: GetToken): Promise<ApiPhoto[]> {
  const headers = await authHeaders(getToken);
  const byQueryResponse = await fetchWithTimeout(
    `${BASE_URL}/photos?eventId=${encodeURIComponent(eventId)}`,
    {
      method: 'GET',
      headers,
    },
  );

  const response = byQueryResponse.status === 404
    ? await fetchWithTimeout(`${BASE_URL}/events/${eventId}/photos`, {
      method: 'GET',
      headers,
    })
    : byQueryResponse;

  const data = await handleResponse<RawApiPhoto[]>(response);

  return data.map(normalizePhoto).filter((photo) => Boolean(photo.url));
}
