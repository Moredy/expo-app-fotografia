import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useRef } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { useAuth } from './AuthContext';
import { getOrders } from '../services/paymentService';
import { ApiOrder } from '../types/payment';

interface OrderFoto {
  id: string;
  url: any;
  eventoNome: string;
}

interface Order {
  id: string;
  data: string;
  total: number;
  status: string;
  items: number;
  fotos: OrderFoto[];
}

interface CartItem {
  foto: {
    id: string;
    url: any;
  };
  evento: {
    titulo: string;
  };
}

interface OrderContextData {
  orders: Order[];
  isLoading: boolean;
  createOrder: (cartItems: CartItem[], total: number) => Order;
  refreshOrders: () => Promise<void>;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
}

const OrderContext = createContext<OrderContextData | undefined>(undefined);

export const useOrders = (): OrderContextData => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

interface OrderProviderProps {
  children: ReactNode;
}

export const OrderProvider: React.FC<OrderProviderProps> = ({ children }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { getToken } = useClerkAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isRefreshingRef = useRef(false);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const mapOrderFromApi = (order: ApiOrder): Order => {
    const photos = (order.orderItems ?? [])
      .map((item) => {
        const imageUrl = item.photo?.thumbnailUrl;
        if (!imageUrl) return null;

        return {
          id: item.id,
          url: { uri: imageUrl },
          eventoNome: item.photo?.event?.title ?? 'Evento',
        };
      })
      .filter((item): item is OrderFoto => item !== null);

    const totalValue = Number(order.finalAmount ?? order.totalAmount ?? order.total ?? 0);

    return {
      id: order.orderNumber ?? order.id,
      data: new Date(order.createdAt).toLocaleDateString('pt-BR'),
      total: Number.isFinite(totalValue) ? totalValue : 0,
      status: order.status,
      items: order.orderItems?.length ?? order.photoIds?.length ?? photos.length,
      fotos: photos,
    };
  };

  const getErrorMessage = (
    err: unknown,
    fallback = 'Erro ao buscar pedidos.',
  ): string => {
    if (err instanceof Error && err.message.trim().length > 0) return err.message;
    if (typeof err === 'string' && err.trim().length > 0) return err;

    if (err && typeof err === 'object') {
      const maybe = err as {
        message?: unknown;
        error?: unknown;
        response?: { data?: { message?: unknown; error?: unknown } };
      };

      if (typeof maybe.message === 'string' && maybe.message.trim().length > 0) {
        return maybe.message;
      }

      if (typeof maybe.error === 'string' && maybe.error.trim().length > 0) {
        return maybe.error;
      }

      const responseMessage = maybe.response?.data?.message;
      if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) {
        return responseMessage;
      }

      const responseError = maybe.response?.data?.error;
      if (typeof responseError === 'string' && responseError.trim().length > 0) {
        return responseError;
      }
    }

    return fallback;
  };

  const refreshOrders = useCallback(async () => {
    if (isRefreshingRef.current) return;
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    isRefreshingRef.current = true;
    setIsLoading(true);
    try {
      const backendOrders = await getOrders(async () => {
        const freshToken = await getTokenRef.current({ skipCache: true });
        return freshToken ?? getTokenRef.current();
      });
      const mappedOrders = [...backendOrders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(mapOrderFromApi);

      setOrders(mappedOrders);
    } catch (error) {
      const message = getErrorMessage(error);
      const normalizedMessage = message
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const isAuthNotReady =
        normalizedMessage.includes('sessao expirada') ||
        normalizedMessage.includes('token de autenticacao');

      if (!isAuthNotReady) {
        console.warn(`Falha ao buscar pedidos: ${message}`);
      }
      setOrders([]);
    } finally {
      isRefreshingRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const createOrder = (cartItems: CartItem[], total: number): Order => {
    const newOrder: Order = {
      id: String(orders.length + 1),
      data: new Date().toISOString().split('T')[0],
      total,
      status: 'processando',
      items: cartItems.length,
      fotos: cartItems.map(item => ({
        id: item.foto.id,
        url: item.foto.url,
        eventoNome: item.evento.titulo,
      })),
    };

    setOrders([newOrder, ...orders]);
    return newOrder;
  };

  const getStatusColor = (status: string): string => {
    const normalizedStatus = status.trim().toLowerCase();

    switch (normalizedStatus) {
      case 'paid':
      case 'pago':
      case 'approved':
      case 'completed':
      case 'entregue':
      case 'delivered':
        return '#34C759';
      case 'processando':
      case 'processing':
      case 'pending':
      case 'created':
      case 'waiting_payment':
        return '#FF9500';
      case 'cancelado':
      case 'cancelled':
      case 'canceled':
      case 'failed':
      case 'expired':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusLabel = (status: string): string => {
    const normalizedStatus = status.trim().toLowerCase();

    switch (normalizedStatus) {
      case 'delivered':
      case 'entregue':
        return 'Entregue';
      case 'processando':
      case 'processing':
      case 'pending':
      case 'created':
      case 'waiting_payment':
        return 'Processando';
      case 'paid':
      case 'pago':
      case 'approved':
      case 'completed':
        return 'Pago';
      case 'cancelado':
      case 'cancelled':
      case 'canceled':
        return 'Cancelado';
      case 'failed':
        return 'Falhou';
      case 'expired':
        return 'Expirado';
      default:
        return status;
    }
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        isLoading,
        createOrder,
        refreshOrders,
        getStatusColor,
        getStatusLabel,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};
