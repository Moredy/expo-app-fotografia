import { ApiEvent, ApiPhoto } from '../types/payment';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

const TIMEOUT_MS = 15_000;

type GetToken = () => Promise<string | null>;

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
  const token = await getToken();
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
  const response = await fetchWithTimeout(`${BASE_URL}/events/${eventId}/photos`, {
    method: 'GET',
    headers: await authHeaders(getToken),
  });
  return handleResponse<ApiPhoto[]>(response);
}
