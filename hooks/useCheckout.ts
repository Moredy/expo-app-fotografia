import { useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

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
  quantity?: number;
  planName: string;
  price: number;
  interval: 'month';
}

type GetToken = () => Promise<string | null>;

const SUBSCRIPTION_POLL_ATTEMPTS = 8;
const SUBSCRIPTION_POLL_INTERVAL_MS = 1500;
const CHECKOUT_DEEP_LINK_TIMEOUT_MS = 15 * 60 * 1000;
const CHECKOUT_RETURN_SETTLE_MS = 1200;
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
      const { successUrl, cancelUrl, appSuccessUrl, appCancelUrl } = resolveCheckoutReturnUrls();

      const { checkoutUrl, orderId } = await createOrderCheckout(
        {
          userId: user.id,
          photoIds,
          successUrl,
          cancelUrl,
        },
        getCheckoutToken,
      );

      const checkoutReturnUrlPromise = waitForCheckoutReturnSignal(
        appSuccessUrl,
        appCancelUrl,
        CHECKOUT_DEEP_LINK_TIMEOUT_MS,
      );

      // Nao bloqueia no fechamento do navegador; esperamos callback ou retorno manual ao app.
      void WebBrowser.openBrowserAsync(checkoutUrl);
      const returnUrl = await checkoutReturnUrlPromise;

      if (returnUrl && isSuccessfulCheckoutReturnUrl(returnUrl)) {
        setState('success');
        onSuccess?.();
      } else if (returnUrl && isCanceledCheckoutReturnUrl(returnUrl)) {
        setState('idle');
        const canceledOrderId = extractOrderIdFromUrl(returnUrl) ?? orderId;
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
  quantity = 1,
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
      const appSuccessUrl = resolveSubscriptionReturnUrl('success');
      const appCancelUrl = resolveSubscriptionReturnUrl('cancel');

      const { checkoutUrl } = await createSubscriptionCheckout(
        {
          successUrl: appSuccessUrl,
          cancelUrl: appCancelUrl,
          interval,
          quantity,
          planName,
          price: String(price),
        },
        getCheckoutToken,
      );

      const checkoutReturnUrlPromise = waitForCheckoutReturnSignal(
        appSuccessUrl,
        appCancelUrl,
        CHECKOUT_DEEP_LINK_TIMEOUT_MS,
      );

      // Nao bloqueia no fechamento do navegador; esperamos callback ou retorno manual ao app.
      void WebBrowser.openBrowserAsync(checkoutUrl);
      const returnUrl = await checkoutReturnUrlPromise;

      if (returnUrl && isSuccessfulCheckoutReturnUrl(returnUrl)) {
        const isConfirmed = await waitForSubscriptionConfirmation(user.id, getCheckoutToken);
        if (isConfirmed) {
          setState('success');
          onSuccess?.();
        } else {
          setError('Pagamento confirmado, mas a assinatura ainda está pendente. Tente novamente em instantes.');
          setState('error');
        }
      } else if (returnUrl && isCanceledCheckoutReturnUrl(returnUrl)) {
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
  }, [user, quantity, planName, price, interval, onSuccess, onCancel, getCheckoutToken]);

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
  appSuccessUrl: string;
  appCancelUrl: string;
} {
  const configuredSuccess = process.env.EXPO_PUBLIC_CHECKOUT_SUCCESS_URL?.trim();
  const configuredCancel = process.env.EXPO_PUBLIC_CHECKOUT_CANCEL_URL?.trim();
  const returnBaseUrl =
    process.env.EXPO_PUBLIC_CHECKOUT_RETURN_BASE_URL?.replace(/\/$/, '').trim() ??
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '').trim();
  const returnPath =
    (process.env.EXPO_PUBLIC_CHECKOUT_RETURN_PATH?.trim() || '/payments/abacate/return').replace(/\s+/g, '');

  const appSuccessUrl = Linking.createURL('checkout/success');
  const appCancelUrl = Linking.createURL('checkout/cancel');

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

  return { successUrl, cancelUrl, appSuccessUrl, appCancelUrl };
}

function resolveSubscriptionReturnUrl(type: 'success' | 'cancel'): string {
  const configuredUrl =
    type === 'success'
      ? process.env.EXPO_PUBLIC_CHECKOUT_SUCCESS_URL?.trim()
      : process.env.EXPO_PUBLIC_CHECKOUT_CANCEL_URL?.trim();

  if (configuredUrl) return configuredUrl;

  return Linking.createURL(type === 'success' ? 'checkout/success' : 'checkout/cancel');
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

function waitForCheckoutReturnSignal(
  appSuccessUrl: string,
  appCancelUrl: string,
  timeoutMs: number,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    let appWasBackgrounded = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (url?: string) => {
      if (settled) return;
      settled = true;
      urlSubscription.remove();
      appStateSubscription.remove();
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      clearTimeout(timeoutId);
      resolve(url);
    };

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      if (!isExpectedCheckoutReturnUrl(url, appSuccessUrl, appCancelUrl)) {
        return;
      }
      finish(url);
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        appWasBackgrounded = true;
        return;
      }

      if (!appWasBackgrounded) {
        return;
      }

      // Ao voltar para o app sem deep link, libera o fluxo para fallback no backend.
      settleTimer = setTimeout(() => {
        finish(undefined);
      }, CHECKOUT_RETURN_SETTLE_MS);
    });

    const timeoutId = setTimeout(() => {
      finish(undefined);
    }, timeoutMs);
  });
}

function isExpectedCheckoutReturnUrl(url: string, appSuccessUrl: string, appCancelUrl: string): boolean {
  const normalizedUrl = normalizeUrlForMatch(url);
  const successPrefix = normalizeUrlForMatch(appSuccessUrl);
  const cancelPrefix = normalizeUrlForMatch(appCancelUrl);

  if (normalizedUrl.startsWith(successPrefix) || normalizedUrl.startsWith(cancelPrefix)) {
    return true;
  }

  return isSuccessfulCheckoutReturnUrl(url) || isCanceledCheckoutReturnUrl(url);
}

function normalizeUrlForMatch(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
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
