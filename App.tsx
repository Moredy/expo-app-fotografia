import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
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
  const safeAreaColor = '#2B174B';

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const hasSmallBottomSafeArea = (insets.bottom ?? 0) <= 8;

    if (hasSmallBottomSafeArea) {
      NavigationBar.setPositionAsync('absolute').catch(() => {});
      NavigationBar.setBackgroundColorAsync('#00000000').catch(() => {});
      NavigationBar.setBorderColorAsync('#00000000').catch(() => {});
      NavigationBar.setButtonStyleAsync('light').catch(() => {});
      return;
    }

    NavigationBar.setPositionAsync('relative').catch(() => {});
    NavigationBar.setBackgroundColorAsync(safeAreaColor).catch(() => {});
    NavigationBar.setBorderColorAsync(safeAreaColor).catch(() => {});
    NavigationBar.setButtonStyleAsync('light').catch(() => {});
  }, [insets.bottom]);

  return null;
}

export default function App() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
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
