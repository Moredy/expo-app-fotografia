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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { clubInfo } from '../data/mockData';
import { ClubScreenNavigationProp } from '../navigation/types';
import { useSubscriptionCheckout } from '../hooks/useCheckout';
import Toast from '../components/Toast';

interface ClubScreenProps {
  navigation: ClubScreenNavigationProp;
}

export default function ClubScreen({ navigation }: ClubScreenProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { state: checkoutState, error: checkoutError, startCheckout } = useSubscriptionCheckout({
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
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="close" size={32} color="#fff" />
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

          <TouchableOpacity
              style={[styles.subscribeButton, isLoading && styles.subscribeButtonDisabled]}
              onPress={startCheckout}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
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
    top: 10,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
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
