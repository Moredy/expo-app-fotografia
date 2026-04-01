import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../contexts/CartContext';
import { useOrderCheckout } from '../hooks/useCheckout';
import { CarrinhoScreenNavigationProp } from '../navigation/types';
import Toast from '../components/Toast';

interface CarrinhoScreenProps {
  navigation: CarrinhoScreenNavigationProp;
}

export default function CarrinhoScreen({ navigation }: CarrinhoScreenProps) {
  const { cartItems, removeFromCart, clearCart, getCartTotal, getCartCount } = useCart();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [removingPhotoIds, setRemovingPhotoIds] = useState<string[]>([]);
  const [isClearingCart, setIsClearingCart] = useState(false);

  const photoIds = cartItems.map((item) => item.foto.id);

  const { state: checkoutState, error: checkoutError, startCheckout } = useOrderCheckout({
    photoIds,
    onSuccess: () => {
      void clearCart();
      navigation.navigate('CheckoutSuccess', { type: 'order' });
    },
    onCancel: () => {
      navigation.navigate('CheckoutCancel');
    },
  });

  const isProcessing = checkoutState === 'loading';
  const isMutatingCart = isClearingCart || removingPhotoIds.length > 0;

  // Exibe toast quando houver erro no checkout
  React.useEffect(() => {
    if (checkoutState === 'error' && checkoutError) {
      setToastMessage(checkoutError);
      setToastVisible(true);
    }
  }, [checkoutState, checkoutError]);

  const handleRemoveItemConfirm = async (fotoId: string): Promise<void> => {
    if (removingPhotoIds.includes(fotoId)) return;

    setRemovingPhotoIds((prev) => [...prev, fotoId]);
    try {
      await removeFromCart(fotoId);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message.trim().length > 0
        ? err.message
        : 'Nao foi possivel remover a foto do carrinho.';
      setToastMessage(message);
      setToastVisible(true);
    } finally {
      setRemovingPhotoIds((prev) => prev.filter((id) => id !== fotoId));
    }
  };

  const handleClearCartConfirm = async (): Promise<void> => {
    if (isClearingCart) return;

    setIsClearingCart(true);
    try {
      await clearCart();
    } catch (err: unknown) {
      const message = err instanceof Error && err.message.trim().length > 0
        ? err.message
        : 'Nao foi possivel limpar o carrinho.';
      setToastMessage(message);
      setToastVisible(true);
    } finally {
      setIsClearingCart(false);
    }
  };

  const handleRemoveItem = (fotoId: string): void => {
    Alert.alert(
      'Remover foto',
      'Deseja remover esta foto do carrinho?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => { void handleRemoveItemConfirm(fotoId); },
        },
      ]
    );
  };

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Carrinho</Text>
        </View>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={120} color="#8E8E93" />
          <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
          <Text style={styles.emptySubtitle}>
            Adicione fotos dos eventos para comprar
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('Eventos')}
          >
            <Text style={styles.exploreButtonText}>Explorar Eventos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Carrinho</Text>
        <TouchableOpacity
          disabled={isClearingCart}
          onPress={() => {
            Alert.alert(
              'Limpar Carrinho',
              'Deseja remover todas as fotos do carrinho?',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Limpar',
                  style: 'destructive',
                  onPress: () => { void handleClearCartConfirm(); },
                },
              ]
            );
          }}
        >
          <Text style={[styles.clearButton, isClearingCart && styles.clearButtonDisabled]}>
            {isClearingCart ? 'Limpando...' : 'Limpar'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.itemsContainer}>
          {cartItems.map((item) => (
            <View key={item.foto.id} style={styles.cartItem}>
              <Image source={item.foto.url} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemEvento} numberOfLines={1}>
                  {item.evento.titulo}
                </Text>
                <Text style={styles.itemPrice}>R$ {item.unitPrice.toFixed(2).replace('.', ',')}</Text>
              </View>
              {removingPhotoIds.includes(item.foto.id) ? (
                <View style={styles.removeButton}>
                  <ActivityIndicator size="small" color="#FF3B30" />
                </View>
              ) : (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveItem(item.foto.id)}
              >
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumo do Pedido</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fotos ({getCartCount()})</Text>
            <Text style={styles.summaryValue}>
              R$ {getCartTotal().toFixed(2).replace('.', ',')}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>
              R$ {getCartTotal().toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerTotal}>
            R$ {getCartTotal().toFixed(2).replace('.', ',')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, isProcessing && styles.checkoutButtonDisabled]}
          onPress={startCheckout}
          disabled={isProcessing || isMutatingCart}
        >
          {isProcessing || isMutatingCart ? (
            <Text style={styles.checkoutButtonText}>Aguarde...</Text>
          ) : (
            <>
              <Text style={styles.checkoutButtonText}>Finalizar Pedido</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="error"
        onHide={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5B3A8F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
  },
  clearButton: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  clearButtonDisabled: {
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 30,
  },
  exploreButton: {
    backgroundColor: '#D4A574',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 10,
  },
  exploreButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  itemsContainer: {
    paddingHorizontal: 20,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#4A2F73',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#3A2259',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemEvento: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D4A574',
  },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3A2259',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  summaryCard: {
    backgroundColor: '#4A2F73',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  summaryValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#7B5BA8',
    marginVertical: 16,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4A574',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#4A2F73',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#7B5BA8',
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  footerTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  checkoutButton: {
    backgroundColor: '#D4A574',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
});
