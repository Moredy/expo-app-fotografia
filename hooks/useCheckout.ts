import { useState, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { CheckoutState } from '../types/payment';
import {
  createOrderCheckout,
  createSubscriptionCheckout,
} from '../services/paymentService';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { useAuth } from '../contexts/AuthContext';

// ─── Callbacks comuns ─────────────────────────────────────────────────────────

interface CheckoutCallbacks {
  onSuccess?: () => void;
  onCancel?: (orderId?: string) => void;
}

// ─── Hook: compra avulsa ──────────────────────────────────────────────────────

interface UseOrderCheckoutOptions extends CheckoutCallbacks {
  photoIds: string[];
}

export function useOrderCheckout({ photoIds, onSuccess, onCancel }: UseOrderCheckoutOptions) {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const [state, setState] = useState<CheckoutState>('idle');
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(async () => {
    if (!user) {
      setError('Você precisa estar autenticado para realizar uma compra.');
      setState('error');
      return;
    }

    if (photoIds.length === 0) {
      setError('Nenhuma foto selecionada.');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);

    try {
      const successUrl = Linking.createURL('checkout/success');
      const cancelUrl = Linking.createURL('checkout/cancel');
      const redirectPrefix = Linking.createURL('checkout');

      const { checkoutUrl, orderId } = await createOrderCheckout({
        userId: user.id,
        photoIds,
        successUrl,
        cancelUrl,
      }, () => getToken({ skipCache: true }));

      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, redirectPrefix);

      if (result.type === 'success' && result.url.includes('/success')) {
        setState('success');
        onSuccess?.();
      } else {
        setState('idle');
        const canceledOrderId =
          result.type === 'success' ? (extractOrderIdFromUrl(result.url) ?? orderId) : orderId;
        onCancel?.(canceledOrderId);
      }
    } catch (err: unknown) {
      const message = resolveErrorMessage(err);
      setError(message);
      setState('error');
    }
  }, [user, photoIds, onSuccess, onCancel]);

  const resetState = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return { state, error, startCheckout, resetState } as const;
}

// ─── Hook: assinatura ─────────────────────────────────────────────────────────

interface UseSubscriptionCheckoutOptions extends CheckoutCallbacks {
  planName: string;
  price: number;
  interval: 'month' | 'year';
}

export function useSubscriptionCheckout({
  planName,
  price,
  interval,
  onSuccess,
  onCancel,
}: UseSubscriptionCheckoutOptions) {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const [state, setState] = useState<CheckoutState>('idle');
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(async () => {
    if (!user) {
      setError('Você precisa estar autenticado para assinar.');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);

    try {
      const successUrl = Linking.createURL('checkout/success');
      const cancelUrl = Linking.createURL('checkout/cancel');
      const redirectPrefix = Linking.createURL('checkout');

      const { checkoutUrl } = await createSubscriptionCheckout({
        userId: user.id,
        planName,
        price,
        interval,
        successUrl,
        cancelUrl,
      }, () => getToken({ skipCache: true }));

      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, redirectPrefix);

      if (result.type === 'success' && result.url.includes('/success')) {
        setState('success');
        onSuccess?.();
      } else {
        setState('idle');
        onCancel?.();
      }
    } catch (err: unknown) {
      const message = resolveErrorMessage(err);
      setError(message);
      setState('error');
    }
  }, [user, planName, price, interval, onSuccess, onCancel]);

  const resetState = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return { state, error, startCheckout, resetState } as const;
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

function resolveErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'Tempo de resposta esgotado. Verifique sua conexão e tente novamente.';
    }
    return err.message;
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

function extractOrderIdFromUrl(url: string): string | undefined {
  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) return undefined;

  const params = new URLSearchParams(url.slice(queryIndex + 1));
  const value = params.get('orderId') ?? params.get('order_id') ?? params.get('order');
  return value?.trim() || undefined;
}
