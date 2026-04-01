import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { useAuth } from './AuthContext';
import {
  addCartItem,
  BackendCartItem,
  CartHttpError,
  clearCartItems,
  getCart,
  removeCartItem,
} from '../services/cartService';

interface Foto {
  id: string;
  url: any;
  unitPrice?: number;
  [key: string]: any;
}

interface Evento {
  titulo: string;
  [key: string]: any;
}

interface CartItem {
  foto: Foto;
  evento: Evento;
  unitPrice: number;
}

interface CartContextData {
  cartItems: CartItem[];
  isLoading: boolean;
  addToCart: (foto: Foto, evento: Evento) => Promise<boolean>;
  removeFromCart: (fotoId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: (silent?: boolean) => Promise<void>;
  getCartTotal: () => number;
  getCartCount: () => number;
  isInCart: (fotoId: string) => boolean;
}

const CartContext = createContext<CartContextData | undefined>(undefined);

export const useCart = (): CartContextData => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { isAuthenticated, user } = useAuth();
  const { getToken } = useClerkAuth();

  const pendingAddIdsRef = useRef<Set<string>>(new Set());
  const tokenCacheRef = useRef<{ token: string; expiresAt: number } | null>(null);
  const tokenInFlightRef = useRef<Promise<string | null> | null>(null);

  const calculateLocalTotal = (items: CartItem[]): number => {
    return items.reduce((acc, item) => acc + item.unitPrice, 0);
  };

  const getStableToken = async (): Promise<string | null> => {
    const now = Date.now();
    if (tokenCacheRef.current && tokenCacheRef.current.expiresAt > now) {
      return tokenCacheRef.current.token;
    }

    if (tokenInFlightRef.current) {
      return tokenInFlightRef.current;
    }

    tokenInFlightRef.current = (async () => {
      try {
        let token = await getToken();

        // Single retry for transient Clerk failures on rapid sequences.
        if (!token) {
          token = await getToken({ skipCache: true });
        }

        if (token) {
          tokenCacheRef.current = {
            token,
            expiresAt: Date.now() + 45_000,
          };
        }

        return token;
      } finally {
        tokenInFlightRef.current = null;
      }
    })();

    return tokenInFlightRef.current;
  };

  const getErrorMessage = (
    err: unknown,
    fallback = 'Erro ao carregar carrinho.',
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

      if (Array.isArray(maybe.message) && maybe.message.length > 0) {
        return maybe.message.map(String).join('\n');
      }

      if (typeof maybe.error === 'string' && maybe.error.trim().length > 0) {
        return maybe.error;
      }

      const responseMessage = maybe.response?.data?.message;
      if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) {
        return responseMessage;
      }
      if (Array.isArray(responseMessage) && responseMessage.length > 0) {
        return responseMessage.map(String).join('\n');
      }

      const responseError = maybe.response?.data?.error;
      if (typeof responseError === 'string' && responseError.trim().length > 0) {
        return responseError;
      }
    }

    return fallback;
  };

  const mapBackendItemToCartItem = (item: BackendCartItem): CartItem => ({
    foto: {
      id: item.photoId,
      url: item.photoUrl ? { uri: item.photoUrl } : require('../assets/fotos-mock/1.jpg'),
    },
    evento: {
      titulo: item.eventTitle,
    },
    unitPrice: item.unitPrice,
  });

  const refreshCart = async (silent = false): Promise<void> => {
    if (!isAuthenticated || !user) {
      setCartItems([]);
      setTotalAmount(0);
      tokenCacheRef.current = null;
      return;
    }

    setIsLoading(true);
    try {
      const data = await getCart(getStableToken);
      setCartItems(data.items.map(mapBackendItemToCartItem));
      setTotalAmount(data.summary.totalAmount);
    } catch (err) {
      if (silent) return;

      const message = getErrorMessage(err);
      const isAuthNotReady = message.toLowerCase().includes('sessao expirada');
      if (!isAuthNotReady) {
        console.warn('Falha ao carregar carrinho:', message);
      }
      setCartItems([]);
      setTotalAmount(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setCartItems([]);
      setTotalAmount(0);
      tokenCacheRef.current = null;
      return;
    }

    void refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const addToCart = async (foto: Foto, evento: Evento): Promise<boolean> => {
    const itemExists = cartItems.some((item) => item.foto.id === foto.id);
    if (itemExists) return false;
    if (pendingAddIdsRef.current.has(foto.id)) return false;

    pendingAddIdsRef.current.add(foto.id);

    try {
      await addCartItem(foto.id, getStableToken);
    } catch (err: unknown) {
      if (__DEV__) {
        if (err instanceof CartHttpError) {
          console.log('[CartContext] addToCart failed', {
            photoId: foto.id,
            message: err.message,
            status: err.status,
            statusText: err.statusText,
            url: err.url,
            rawBody: err.rawBody,
            parsedBody: err.parsedBody,
          });
        } else {
          console.log('[CartContext] addToCart failed', {
            photoId: foto.id,
            rawError: err,
            message: getErrorMessage(err, 'Falha ao adicionar item no carrinho.'),
          });
        }
      }

      const message = getErrorMessage(err, 'Falha ao adicionar item no carrinho.').toLowerCase();
      const isAlreadyInCart =
        (err instanceof CartHttpError && err.status === 409) ||
        message.includes('ja esta no carrinho') ||
        message.includes('já está no carrinho') ||
        message.includes('already in cart') ||
        message.includes('duplicate') ||
        message.includes('conflict') ||
        message.includes('409');

      if (isAlreadyInCart) {
        void refreshCart(true);
        return false;
      }

      throw new Error(getErrorMessage(err, 'Falha ao adicionar item no carrinho.'));
    } finally {
      pendingAddIdsRef.current.delete(foto.id);
    }

    setCartItems((prevItems) => {
      if (prevItems.some((item) => item.foto.id === foto.id)) {
        return prevItems;
      }

      const nextItems = [
        ...prevItems,
        {
          foto,
          evento,
          unitPrice: typeof foto.unitPrice === 'number' ? foto.unitPrice : 15,
        },
      ];
      setTotalAmount(calculateLocalTotal(nextItems));
      return nextItems;
    });

    void refreshCart(true);
    return true;
  };

  const removeFromCart = async (fotoId: string): Promise<void> => {
    await removeCartItem(fotoId, getStableToken);
    setCartItems((prevItems) => {
      const nextItems = prevItems.filter((item) => item.foto.id !== fotoId);
      setTotalAmount(calculateLocalTotal(nextItems));
      return nextItems;
    });
    void refreshCart(true);
  };

  const clearCart = async (): Promise<void> => {
    await clearCartItems(getStableToken);
    setCartItems([]);
    setTotalAmount(0);
    void refreshCart(true);
  };

  const getCartTotal = (): number => totalAmount;
  const getCartCount = (): number => cartItems.length;
  const isInCart = (fotoId: string): boolean => cartItems.some((item) => item.foto.id === fotoId);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        isLoading,
        addToCart,
        removeFromCart,
        clearCart,
        refreshCart,
        getCartTotal,
        getCartCount,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
