import { useEffect } from 'react';
import { Platform, View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded, ClerkLoading } from '@clerk/clerk-expo';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { OrderProvider } from './contexts/OrderContext';
import Navigation from './navigation';
import { tokenCache } from './utils/tokenCache';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env');
}

function AndroidNavigationBarController() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // In edge-to-edge mode, Android ignores position/background/border APIs.
    // Keep only button style to avoid runtime warnings from unsupported calls.
    NavigationBar.setButtonStyleAsync('light').catch(() => {});
  }, [insets.bottom]);

  return null;
}

function BrandLoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Image
        source={require('./assets/logos/logo_branca.png')}
        style={styles.loadingLogo}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color="#D4A574" style={styles.loadingSpinner} />
      <Text style={styles.loadingText}>Carregando...</Text>
      <StatusBar style="light" translucent backgroundColor="transparent" />
    </View>
  );
}

export default function App() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoading>
        <BrandLoadingScreen />
      </ClerkLoading>
      <ClerkLoaded>
        <SafeAreaProvider>
          <AndroidNavigationBarController />
          <AuthProvider>
            <CartProvider>
              <OrderProvider>
                <Navigation />
                <StatusBar style="auto" translucent backgroundColor="transparent" />
              </OrderProvider>
            </CartProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B3A8F',
    paddingHorizontal: 24,
  },
  loadingLogo: {
    width: 220,
    height: 110,
  },
  loadingSpinner: {
    marginTop: 18,
  },
  loadingText: {
    marginTop: 10,
    color: '#D9C8EF',
    fontSize: 15,
    fontWeight: '500',
  },
});
