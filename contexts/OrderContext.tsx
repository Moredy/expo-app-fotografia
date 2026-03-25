import React, { createContext, useState, useContext, ReactNode } from 'react';

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
  createOrder: (cartItems: CartItem[], total: number) => Order;
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
  const [orders, setOrders] = useState<Order[]>([
    {
      id: '1',
      data: '2026-03-10',
      total: 45.00,
      status: 'entregue',
      items: 3,
      fotos: [
        {
          id: '1',
          url: require('../assets/fotos-mock/1.jpg'),
          eventoNome: 'Concurso Hípico Nacional',
        },
        {
          id: '2',
          url: require('../assets/fotos-mock/2.jpeg'),
          eventoNome: 'Concurso Hípico Nacional',
        },
        {
          id: '3',
          url: require('../assets/fotos-mock/3.jpeg'),
          eventoNome: 'Campeonato Regional',
        },
      ],
    },
    {
      id: '2',
      data: '2026-03-05',
      total: 30.00,
      status: 'processando',
      items: 2,
      fotos: [
        {
          id: '4',
          url: require('../assets/fotos-mock/6.jpeg'),
          eventoNome: 'Copa de Salto',
        },
        {
          id: '5',
          url: require('../assets/fotos-mock/8.jpeg'),
          eventoNome: 'Copa de Salto',
        },
      ],
    },
  ]);

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
    switch (status) {
      case 'entregue':
        return '#34C759';
      case 'processando':
        return '#FF9500';
      case 'cancelado':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'entregue':
        return 'Entregue';
      case 'processando':
        return 'Processando';
      case 'cancelado':
        return 'Cancelado';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        createOrder,
        getStatusColor,
        getStatusLabel,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};
