import { useState, useCallback, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';

import { CheckoutState, ApiSubscription } from '../types/payment';
import {
  createOrderCheckout,
  createSubscriptionCheckout,
  getSubscriptions,
  getUserSubscriptions,
} from '../services/paymentService';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { useAuth } from '../contexts/AuthContext';

interface CheckoutCallbacks {
  onSuccess?: () => void;
  onCancel?: (orderId?: string) => void;
}

interface UseOrderCheckoutOptions extends CheckoutCallbacks {
  photoIds: string[];
}

interface UseSubscriptionCheckoutOptions extends CheckoutCallbacks {
  planName: string;
  price: number;
  interval: 'month' | 'year';
}

type GetToken = () => Promise<string | null>;

const SUBSCRIPTION_POLL_ATTEMPTS = 8;
const SUBSCRIPTION_POLL_INTERVAL_MS = 1500;
const CONFIRMED_SUBSCRIPTION_STATUSES = ['active', 'paid', 'approved', 'success', 'succeeded', 'completed'];

export function useOrderCheckout({ photoIds, onSuccess, onCancel }: UseOrderCheckoutOptions) {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const [state, setState] = useState<CheckoutState>('idle');
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const getCheckoutToken = useCallback(async (): Promise<string | null> => {
    let token = await getToken();
    if (!token) {
      token = await getToken({ skipCache: true });
    }
    return token;
  }, [getToken]);

  const startCheckout = useCallback(async () => {
    if (inFlightRef.current) return;

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
    inFlightRef.current = true;

    try {
      const { successUrl, cancelUrl, redirectPrefix } = resolveCheckoutReturnUrls();

      const { checkoutUrl, orderId } = await createOrderCheckout(
        {
          userId: user.id,
          photoIds,
          successUrl,
          cancelUrl,
        },
        getCheckoutToken,
      );

      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, redirectPrefix);

      if (result.type === 'success' && isSuccessfulCheckoutReturnUrl(result.url)) {
        setState('success');
        onSuccess?.();
      } else if (result.type === 'success' && isCanceledCheckoutReturnUrl(result.url)) {
        setState('idle');
        const canceledOrderId = extractOrderIdFromUrl(result.url) ?? orderId;
        onCancel?.(canceledOrderId);
      } else {
        // Fechou o navegador (X/back) ou retorno não conclusivo: apenas volta ao app.
        setState('idle');
      }
    } catch (err: unknown) {
      const message = resolveErrorMessage(err);
      setError(message);
      setState('error');
    } finally {
      inFlightRef.current = false;
    }
  }, [user, photoIds, onSuccess, onCancel, getCheckoutToken]);

  const resetState = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return { state, error, startCheckout, resetState } as const;
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
  const inFlightRef = useRef(false);

  const getCheckoutToken = useCallback(async (): Promise<string | null> => {
    let token = await getToken();
    if (!token) {
      token = await getToken({ skipCache: true });
    }
    return token;
  }, [getToken]);

  const startCheckout = useCallback(async () => {
    if (inFlightRef.current) return;

    if (!user) {
      setError('Você precisa estar autenticado para assinar.');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);
    inFlightRef.current = true;

    try {
      const { successUrl, cancelUrl, redirectPrefix } = resolveCheckoutReturnUrls();

      const { checkoutUrl } = await createSubscriptionCheckout(
        {
          userId: user.id,
          planName,
          price,
          interval,
          successUrl,
          cancelUrl,
        },
        getCheckoutToken,
      );

      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, redirectPrefix);

      if (result.type === 'success' && isSuccessfulCheckoutReturnUrl(result.url)) {
        const isConfirmed = await waitForSubscriptionConfirmation(user.id, getCheckoutToken);
        if (isConfirmed) {
          setState('success');
          onSuccess?.();
        } else {
          setError('Pagamento confirmado, mas a assinatura ainda está pendente. Tente novamente em instantes.');
          setState('error');
        }
      } else if (result.type === 'success' && isCanceledCheckoutReturnUrl(result.url)) {
        setState('idle');
        onCancel?.();
      } else {
        // Fechou o navegador (X/back) ou retorno não conclusivo: valida no backend antes de decidir.
        const isConfirmed = await waitForSubscriptionConfirmation(user.id, getCheckoutToken);
        if (isConfirmed) {
          setState('success');
          onSuccess?.();
        } else {
          setState('idle');
        }
      }
    } catch (err: unknown) {
      const message = resolveErrorMessage(err);
      setError(message);
      setState('error');
    } finally {
      inFlightRef.current = false;
    }
  }, [user, planName, price, interval, onSuccess, onCancel, getCheckoutToken]);

  const resetState = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return { state, error, startCheckout, resetState } as const;
}

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

function resolveCheckoutReturnUrls(): {
  successUrl: string;
  cancelUrl: string;
  redirectPrefix: string;
} {
  const configuredSuccess = process.env.EXPO_PUBLIC_CHECKOUT_SUCCESS_URL?.trim();
  const configuredCancel = process.env.EXPO_PUBLIC_CHECKOUT_CANCEL_URL?.trim();
  const returnBaseUrl =
    process.env.EXPO_PUBLIC_CHECKOUT_RETURN_BASE_URL?.replace(/\/$/, '').trim() ??
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '').trim();
  const returnPath =
    (process.env.EXPO_PUBLIC_CHECKOUT_RETURN_PATH?.trim() || '/payments/abacate/return').replace(/\s+/g, '');

  const appSuccessUrl =
    AuthSession.makeRedirectUri({ path: 'checkout/success' }) || Linking.createURL('checkout/success');
  const appCancelUrl =
    AuthSession.makeRedirectUri({ path: 'checkout/cancel' }) || Linking.createURL('checkout/cancel');

  const successUrl =
    configuredSuccess && isHttpUrl(configuredSuccess)
      ? configuredSuccess
      : buildBackendReturnUrl(returnBaseUrl, returnPath, 'success', appSuccessUrl);

  const cancelUrl =
    configuredCancel && isHttpUrl(configuredCancel)
      ? configuredCancel
      : buildBackendReturnUrl(returnBaseUrl, returnPath, 'cancel', appCancelUrl);

  if (!isHttpUrl(successUrl) || !isHttpUrl(cancelUrl)) {
    throw new Error(
      'AbacatePay exige returnUrl em http/https. Configure EXPO_PUBLIC_CHECKOUT_RETURN_BASE_URL ou EXPO_PUBLIC_CHECKOUT_SUCCESS_URL/EXPO_PUBLIC_CHECKOUT_CANCEL_URL no .env.',
    );
  }

  const redirectPrefix = getCommonPrefix(appSuccessUrl, appCancelUrl);
  return { successUrl, cancelUrl, redirectPrefix };
}

function buildBackendReturnUrl(
  returnBaseUrl: string | undefined,
  returnPath: string,
  result: 'success' | 'cancel',
  appRedirect: string,
): string {
  if (!returnBaseUrl || !isHttpUrl(returnBaseUrl)) return '';

  const normalizedPath = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
  const url = new URL(`${returnBaseUrl}${normalizedPath}`);
  url.searchParams.set('result', result);
  url.searchParams.set('redirect', appRedirect);
  return url.toString();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function getCommonPrefix(firstUrl: string, secondUrl: string): string {
  const minLength = Math.min(firstUrl.length, secondUrl.length);
  let index = 0;

  while (index < minLength && firstUrl[index] === secondUrl[index]) {
    index += 1;
  }

  return firstUrl.slice(0, index) || firstUrl;
}

function isSuccessfulCheckoutReturnUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('/success') || lowerUrl.includes('/checkout/success')) {
    return true;
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) return false;

  const params = new URLSearchParams(url.slice(queryIndex + 1));
  const rawStatus =
    params.get('status') ??
    params.get('paymentStatus') ??
    params.get('payment_status') ??
    params.get('result');

  const normalizedStatus = rawStatus?.trim().toLowerCase();
  if (!normalizedStatus) return false;

  return ['paid', 'approved', 'success', 'succeeded', 'completed'].includes(normalizedStatus);
}

function isCanceledCheckoutReturnUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('/cancel') || lowerUrl.includes('/checkout/cancel')) {
    return true;
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) return false;

  const params = new URLSearchParams(url.slice(queryIndex + 1));
  const rawStatus =
    params.get('status') ??
    params.get('paymentStatus') ??
    params.get('payment_status') ??
    params.get('result');

  const normalizedStatus = rawStatus?.trim().toLowerCase();
  if (!normalizedStatus) return false;

  return ['cancel', 'canceled', 'cancelled', 'failed', 'expired'].includes(normalizedStatus);
}

function hasConfirmedSubscription(subscriptions: ApiSubscription[]): boolean {
  return subscriptions.some((subscription) =>
    CONFIRMED_SUBSCRIPTION_STATUSES.includes(subscription.status?.trim().toLowerCase() ?? ''),
  );
}

async function waitForSubscriptionConfirmation(userId: string, getToken: GetToken): Promise<boolean> {
  for (let attempt = 0; attempt < SUBSCRIPTION_POLL_ATTEMPTS; attempt += 1) {
    try {
      let subscriptions = await getSubscriptions(getToken);
      if (!subscriptions?.length) {
        subscriptions = await getUserSubscriptions(userId, getToken);
      }

      if (hasConfirmedSubscription(subscriptions)) {
        return true;
      }
    } catch {
      // Ignora erro transitório durante polling e tenta novamente.
    }

    if (attempt < SUBSCRIPTION_POLL_ATTEMPTS - 1) {
      await delay(SUBSCRIPTION_POLL_INTERVAL_MS);
    }
  }

  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
