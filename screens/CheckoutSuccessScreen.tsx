import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';

import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../contexts/AuthContext';
import { getOrders, getUserSubscriptions } from '../services/paymentService';
import { ApiOrder, ApiSubscription } from '../types/payment';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CheckoutSuccess'>;
  route: RouteProp<RootStackParamList, 'CheckoutSuccess'>;
};

type FetchState = 'loading' | 'success' | 'error';
const DETAIL_FETCH_TIMEOUT_MS = 12_000;

export default function CheckoutSuccessScreen({ navigation, route }: Props) {
  const { type } = route.params;
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const userId = user?.id;
  const getTokenRef = useRef(getToken);

  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [lastOrder, setLastOrder] = useState<ApiOrder | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<ApiSubscription | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const loadData = useCallback(async () => {
    if (!userId) return;

    setFetchState('loading');
    setFetchError(null);
    try {
      const getFreshToken = async () => {
        let token = await getTokenRef.current();
        if (!token) {
          token = await getTokenRef.current({ skipCache: true });
        }
        return token;
      };

      if (type === 'order') {
        const orders = await withTimeout(
          getOrders(getFreshToken),
          DETAIL_FETCH_TIMEOUT_MS,
          'A busca dos detalhes demorou mais que o esperado. Tente novamente.',
        );
        const sorted = [...orders].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setLastOrder(sorted[0] ?? null);
      } else {
        const subs = await withTimeout(
          getUserSubscriptions(userId, getFreshToken),
          DETAIL_FETCH_TIMEOUT_MS,
          'A busca dos detalhes demorou mais que o esperado. Tente novamente.',
        );
        const active = subs.find((s) => s.status === 'active') ?? subs[0] ?? null;
        setActiveSubscription(active);
      }
      setFetchState('success');
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.trim().length > 0
          ? err.message
          : 'Não foi possível buscar o status do pagamento.';
      setFetchError(message);
      setFetchState('error');
    }
  }, [type, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleGoHome() {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  function handleViewOrders() {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }, { name: 'Pedidos' }] });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ícone de sucesso */}
        <View style={styles.iconWrapper}>
          <Ionicons name="checkmark-circle" size={96} color="#8BC34A" />
        </View>

        <Text style={styles.title}>
          {type === 'order' ? 'Compra realizada!' : 'Assinatura ativada!'}
        </Text>
        <Text style={styles.subtitle}>
          {type === 'order'
            ? 'O pagamento foi processado com sucesso. Suas fotos estarão disponíveis em breve.'
            : 'Bem-vindo ao clube! Você já tem acesso a todos os benefícios.'}
        </Text>

        {/* Status do pedido / assinatura */}
        {fetchState === 'loading' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D4A574" size="small" />
            <Text style={styles.loadingText}>Buscando detalhes...</Text>
          </View>
        )}

        {fetchState === 'error' && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#FF8A65" />
            <Text style={styles.errorText}>{fetchError}</Text>
            <TouchableOpacity onPress={loadData} style={styles.retryButton}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {fetchState === 'success' && type === 'order' && lastOrder && (
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Último pedido</Text>
            <Row label="ID" value={`#${lastOrder.id}`} />
            <Row label="Status" value={formatOrderStatus(lastOrder.status)} />
            <Row
              label="Total"
              value={`R$ ${resolveOrderTotal(lastOrder).toFixed(2).replace('.', ',')}`}
            />
            <Row label="Fotos" value={String(resolveOrderPhotosCount(lastOrder))} />
            <Row label="Data" value={formatDate(lastOrder.createdAt)} />
          </View>
        )}

        {fetchState === 'success' && type === 'subscription' && activeSubscription && (
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Assinatura</Text>
            <Row label="Plano" value={activeSubscription.planName} />
            <Row label="Status" value={formatSubStatus(activeSubscription.status)} />
            <Row
              label="Ciclo"
              value={activeSubscription.interval === 'month' ? 'Mensal' : 'Anual'}
            />
            {activeSubscription.currentPeriodEnd && (
              <Row label="Renova em" value={formatDate(activeSubscription.currentPeriodEnd)} />
            )}
          </View>
        )}

        {/* Ações */}
        <View style={styles.actions}>
          {type === 'order' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleViewOrders}>
              <Ionicons name="receipt-outline" size={20} color="#000" />
              <Text style={styles.primaryButtonText}>Ver meus pedidos</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={type === 'order' ? styles.secondaryButton : styles.primaryButton}
            onPress={handleGoHome}
          >
            <Ionicons name="home-outline" size={20} color={type === 'order' ? '#D4A574' : '#000'} />
            <Text style={type === 'order' ? styles.secondaryButtonText : styles.primaryButtonText}>
              Ir para início
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-componente ───────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function formatOrderStatus(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();
  const map: Record<string, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    completed: 'Pago',
    processing: 'Processando',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
    // compatibilidade com valores em português (mock)
    processando: 'Processando',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return map[normalizedStatus] ?? status;
}

function formatSubStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Ativa',
    inactive: 'Inativa',
    cancelled: 'Cancelada',
    trialing: 'Em período de teste',
    past_due: 'Pagamento vencido',
  };
  return map[status] ?? status;
}

function resolveOrderTotal(order: ApiOrder): number {
  const raw = order.finalAmount ?? order.totalAmount ?? order.total ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveOrderPhotosCount(order: ApiOrder): number {
  if (Array.isArray(order.orderItems)) return order.orderItems.length;
  if (Array.isArray(order.photoIds)) return order.photoIds.length;
  return 0;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timerId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timerId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timerId);
        reject(error);
      });
  });
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5B3A8F',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
  },
  iconWrapper: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#B8A0D4',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  loadingText: {
    color: '#B8A0D4',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    width: '100%',
  },
  errorText: {
    color: '#FF8A65',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  retryText: {
    color: '#D4A574',
    fontSize: 14,
    fontWeight: '600',
  },
  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D4A574',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowLabel: {
    color: '#B8A0D4',
    fontSize: 14,
  },
  rowValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#D4A574',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#D4A574',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#D4A574',
    fontSize: 16,
    fontWeight: '600',
  },
});
