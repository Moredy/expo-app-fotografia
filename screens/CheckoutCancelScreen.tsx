import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { RootStackParamList } from '../navigation/types';
import { cancelOrderCheckout } from '../services/paymentService';
import { useOrders } from '../contexts/OrderContext';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CheckoutCancel'>;
  route: RouteProp<RootStackParamList, 'CheckoutCancel'>;
}

export default function CheckoutCancelScreen({ navigation, route }: Props) {
  const orderId = route.params?.orderId;
  const { getToken } = useClerkAuth();
  const { refreshOrders } = useOrders();
  const [isSyncing, setIsSyncing] = React.useState<boolean>(Boolean(orderId));
  const [syncMessage, setSyncMessage] = React.useState<string>('');
  const getTokenRef = React.useRef(getToken);
  const syncedOrderIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  React.useEffect(() => {
    if (!orderId) {
      setIsSyncing(false);
      setSyncMessage('');
      syncedOrderIdRef.current = undefined;
      return;
    }

    if (syncedOrderIdRef.current === orderId) {
      setIsSyncing(false);
      return;
    }

    syncedOrderIdRef.current = orderId;

    let cancelled = false;

    const syncCancelledOrder = async () => {
      try {
        await cancelOrderCheckout(orderId, async () => {
          const fresh = await getTokenRef.current({ skipCache: true });
          return fresh ?? getTokenRef.current();
        });

        await refreshOrders();
        if (!cancelled) setSyncMessage('Pedido atualizado como cancelado.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nao foi possivel atualizar o pedido.';
        if (!cancelled) setSyncMessage(message);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };

    void syncCancelledOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId, refreshOrders]);

  function handleGoBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }

  function handleGoHome() {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name="close-circle" size={96} color="#FF8A65" />
        </View>

        <Text style={styles.title}>Pagamento cancelado</Text>
        <Text style={styles.subtitle}>
          O pagamento não foi concluído. Nenhum valor foi cobrado.{'\n'}Você pode tentar novamente
          quando quiser.
        </Text>

        {isSyncing && (
          <View style={styles.syncBox}>
            <ActivityIndicator size="small" color="#D4A574" />
            <Text style={styles.syncText}>Atualizando status do pedido...</Text>
          </View>
        )}

        {!isSyncing && syncMessage.length > 0 && (
          <View style={styles.syncBox}>
            <Text style={styles.syncText}>{syncMessage}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={20} color="#000" />
            <Text style={styles.primaryButtonText}>Voltar e tentar novamente</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleGoHome}>
            <Ionicons name="home-outline" size={20} color="#D4A574" />
            <Text style={styles.secondaryButtonText}>Ir para início</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5B3A8F',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconWrapper: {
    marginBottom: 24,
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
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  syncBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  syncText: {
    color: '#E6D7FF',
    fontSize: 14,
    textAlign: 'center',
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
