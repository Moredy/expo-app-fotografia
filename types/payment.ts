// ─── Estados de UI ───────────────────────────────────────────────────────────

export type CheckoutState = 'idle' | 'loading' | 'success' | 'error';

// ─── Pedido avulso ────────────────────────────────────────────────────────────

export interface CreateOrderCheckoutRequest {
  userId: string;
  photoIds?: string[];
  successUrl: string;
  cancelUrl: string;
  currency?: string; // default: 'brl'
}

export interface CreateOrderCheckoutResponse {
  orderId: string;
  sessionId: string;
  checkoutUrl: string;
}

// ─── Assinatura ───────────────────────────────────────────────────────────────

export interface CreateSubscriptionCheckoutRequest {
  userId: string;
  planName: string;
  price: number | string;
  interval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
  currency?: string; // default: 'brl'
}

export interface CreateSubscriptionCheckoutResponse {
  sessionId: string;
  checkoutUrl: string;
}

// ─── Recursos da API ──────────────────────────────────────────────────────────

export interface ApiOrder {
  id: string;
  userId: string;
  status: string;
  total: number;
  photoIds: string[];
  createdAt: string;
}

export interface ApiSubscription {
  id: string;
  userId: string;
  status: string;
  planName: string;
  interval: 'month' | 'year';
  currentPeriodEnd: string;
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

export interface ApiEvent {
  id: string;
  title: string;
  description?: string;
  location: string;
  eventDate: string;
  coverImageUrl: string | null;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt?: string;
  _count?: { photos: number; eventFavorites: number };
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

export interface ApiPhoto {
  id: string;
  url: string;
  eventId: string;
  unitPrice: number;
  isPurchased?: boolean;
  createdAt: string;
}
