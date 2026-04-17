import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { clubInfo } from '../data/mockData';
import { ClubScreenNavigationProp } from '../navigation/types';
import { useSubscriptionCheckout } from '../hooks/useCheckout';
import Toast from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { ApiSubscription } from '../types/payment';
import { cancelSubscription, getSubscriptions, getUserSubscriptions } from '../services/paymentService';

interface ClubScreenProps {
  navigation: ClubScreenNavigationProp;
}

export default function ClubScreen({ navigation }: ClubScreenProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { getToken } = useClerkAuth();
  const userId = user?.id;
  const getTokenRef = React.useRef(getToken);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoadingSubscription, setIsLoadingSubscription] = useState<boolean>(true);
  const [activeSubscription, setActiveSubscription] = useState<ApiSubscription | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const { state: checkoutState, error: checkoutError, startCheckout } = useSubscriptionCheckout({
    quantity: 1,
    planName: clubInfo.titulo,
    price: clubInfo.preco,
    interval: 'month',
    onSuccess: () => {
      navigation.replace('CheckoutSuccess', { type: 'subscription' });
    },
    onCancel: () => {
      navigation.replace('CheckoutCancel');
    },
  });

  const isLoading = checkoutState === 'loading';

  React.useEffect(() => {
    if (checkoutState === 'error' && checkoutError) {
      setToastMessage(checkoutError);
      setToastVisible(true);
    }
  }, [checkoutState, checkoutError]);

  React.useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const getStableToken = React.useCallback(async (): Promise<string | null> => {
    let token = await getTokenRef.current();
    if (!token) {
      token = await getTokenRef.current({ skipCache: true });
    }
    return token;
  }, []);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim().length > 0) return error.message;
    if (typeof error === 'string' && error.trim().length > 0) return error;
    return 'Nao foi possivel verificar a assinatura ativa';
  };

  const loadActiveSubscription = React.useCallback(async () => {
    if (isAuthLoading) return;

    if (!userId) {
      setActiveSubscription(null);
      setIsLoadingSubscription(false);
      return;
    }

    setIsLoadingSubscription(true);
    try {
      let subscriptions: ApiSubscription[] = [];

      try {
        subscriptions = await getSubscriptions(getStableToken);
      } catch {
        subscriptions = await getUserSubscriptions(userId, getStableToken);
      }

      const normalized = subscriptions.find(
        (subscription) => subscription.status?.trim().toLowerCase() === 'active',
      ) ?? null;

      setActiveSubscription(normalized);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const normalizedMessage = message
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const isAuthNotReady =
        normalizedMessage.includes('sessao expirada') ||
        normalizedMessage.includes('token de autenticacao');

      if (!isAuthNotReady) {
        setToastMessage(message);
        setToastVisible(true);
      }
      setActiveSubscription(null);
    } finally {
      setIsLoadingSubscription(false);
    }
  }, [getStableToken, isAuthLoading, userId]);

  React.useEffect(() => {
    void loadActiveSubscription();
  }, [loadActiveSubscription]);

  const handleCancelSubscription = () => {
    if (!activeSubscription || isCancelling) return;

    Alert.alert(
      'Cancelar assinatura',
      'Deseja cancelar sua assinatura ativa agora?',
      [
        { text: 'Manter', style: 'cancel' },
        {
          text: 'Cancelar assinatura',
          style: 'destructive',
          onPress: () => { void confirmCancelSubscription(activeSubscription.id); },
        },
      ],
    );
  };

  const confirmCancelSubscription = async (subscriptionId: string) => {
    setIsCancelling(true);
    try {
      await cancelSubscription(subscriptionId, async () => {
        return getStableToken();
      });
      await loadActiveSubscription();
      setToastMessage('Assinatura cancelada com sucesso.');
      setToastVisible(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Nao foi possivel cancelar a assinatura.';
      setToastMessage(message);
      setToastVisible(true);
    } finally {
      setIsCancelling(false);
    }
  };

  const shouldDisableCheckout =
    isLoading || isLoadingSubscription || isAuthLoading || Boolean(activeSubscription);

  const formatDate = (value?: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>

      <ScrollView>
        <ImageBackground
          source={require('../assets/fotos-mock/2.jpeg')}
          style={styles.header}
          blurRadius={2}
        >
          <View style={styles.headerOverlay}>
            <Image
              source={require('../assets/logos/logo_branca.png')}
              style={styles.clubLogo}
              resizeMode="contain"
            />
            <Text style={styles.clubDescription}>{clubInfo.descricao}</Text>

            <View style={styles.imagePreview}>
              <Image
                source={require('../assets/fotos-mock/4.jpg')}
                style={styles.previewImage}
              />
              <View style={[styles.floatingIcon, { top: 10, right: 10 }]}>
                <Ionicons name="heart" size={24} color="#FF3B30" />
              </View>
              <View style={[styles.floatingIcon, { top: 50, right: -10 }]}>
                <Ionicons name="share-social" size={24} color="#FF3B30" />
              </View>
              <View style={[styles.floatingIcon, { bottom: 30, right: 10 }]}>
                <Ionicons name="download" size={24} color="#8BC34A" />
              </View>
              <View style={[styles.floatingIcon, { bottom: -10, left: 20 }]}>
                <Ionicons name="star" size={24} color="#D4A574" />
              </View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.content}>
          <Text style={styles.priceLabel}>{clubInfo.mensalidade}</Text>
          <Text style={styles.price}>R$ {clubInfo.preco.toFixed(2)}</Text>

          {isLoadingSubscription ? (
            <View style={styles.subscriptionStateBox}>
              <ActivityIndicator color="#D4A574" size="small" />
              <Text style={styles.subscriptionStateText}>Verificando assinatura ativa...</Text>
            </View>
          ) : activeSubscription ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeCardTitle}>Assinatura ativa</Text>
              <Text style={styles.activeCardPlan}>{activeSubscription.planName}</Text>
              <Text style={styles.activeCardMeta}>
                Expira em: {formatDate(activeSubscription.currentPeriodEnd ?? activeSubscription.nextBillingDate ?? activeSubscription.endDate)}
              </Text>
              <TouchableOpacity
                style={[styles.cancelSubscriptionButton, isCancelling && styles.subscribeButtonDisabled]}
                onPress={handleCancelSubscription}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="#FFB4A8" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color="#FFB4A8" />
                    <Text style={styles.cancelSubscriptionButtonText}>Cancelar assinatura</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
              style={[styles.subscribeButton, shouldDisableCheckout && styles.subscribeButtonDisabled]}
              onPress={startCheckout}
              disabled={shouldDisableCheckout}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : activeSubscription ? (
                <Text style={styles.subscribeButtonText}>Você já possui assinatura ativa</Text>
              ) : (
                <Text style={styles.subscribeButtonText}>Assinar {clubInfo.titulo}</Text>
              )}
            </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Mensalidade recorrente, cancele quando quiser
          </Text>

          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>Benefícios inclusos:</Text>
            {clubInfo.beneficios.map((beneficio, index) => (
              <View key={index} style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#8BC34A" />
                <Text style={styles.benefitText}>{beneficio}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

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
  closeButton: {
    position: 'absolute',
    top: 30,
    left: 14,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 500,
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  clubLogo: {
    width: 200,
    height: 80,
    marginBottom: 20,
  },
  clubDescription: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 20,
    overflow: 'visible',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  floatingIcon: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    padding: 30,
    paddingTop: 40,
  },
  priceLabel: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 5,
  },
  price: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  subscribeButton: {
    backgroundColor: '#D4A574',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    minHeight: 58,
    justifyContent: 'center',
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  disclaimer: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
  },
  subscriptionStateBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  subscriptionStateText: {
    color: '#CBB7E4',
    fontSize: 13,
  },
  activeCard: {
    backgroundColor: 'rgba(139, 195, 74, 0.16)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 195, 74, 0.5)',
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  activeCardTitle: {
    color: '#D1F0A6',
    fontSize: 14,
    fontWeight: '700',
  },
  activeCardPlan: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  activeCardMeta: {
    color: '#DDECC9',
    fontSize: 13,
    marginBottom: 8,
  },
  cancelSubscriptionButton: {
    borderWidth: 1,
    borderColor: '#FF8A80',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelSubscriptionButtonText: {
    color: '#FFB4A8',
    fontSize: 14,
    fontWeight: '600',
  },
  benefitsSection: {
    marginTop: 20,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  benefitText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 15,
    flex: 1,
  },
});
