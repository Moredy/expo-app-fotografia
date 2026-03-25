import React, { createContext, useState, useContext, ReactNode } from 'react';

interface Foto {
  id: string;
  url: any;
  [key: string]: any;
}

interface Evento {
  titulo: string;
  [key: string]: any;
}

interface CartItem {
  foto: Foto;
  evento: Evento;
}

interface CartContextData {
  cartItems: CartItem[];
  addToCart: (foto: Foto, evento: Evento) => boolean;
  removeFromCart: (fotoId: string) => void;
  clearCart: () => void;
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

  const addToCart = (foto: Foto, evento: Evento): boolean => {
    const itemExists = cartItems.find(item => item.foto.id === foto.id);
    
    if (!itemExists) {
      setCartItems([...cartItems, { foto, evento }]);
      return true;
    }
    return false;
  };

  const removeFromCart = (fotoId: string): void => {
    setCartItems(cartItems.filter(item => item.foto.id !== fotoId));
  };

  const clearCart = (): void => {
    setCartItems([]);
  };

  const getCartTotal = (): number => {
    return cartItems.length * 15; // R$ 15,00 por foto
  };

  const getCartCount = (): number => {
    return cartItems.length;
  };

  const isInCart = (fotoId: string): boolean => {
    return cartItems.some(item => item.foto.id === fotoId);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        getCartTotal,
        getCartCount,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
