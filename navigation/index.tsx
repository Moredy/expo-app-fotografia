import React from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { RootStackParamList, TabParamList } from './types';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import EventosScreen from '../screens/EventosScreen';
import CarrinhoScreen from '../screens/CarrinhoScreen';
import MenuScreen from '../screens/MenuScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ClubScreen from '../screens/ClubScreen';
import EventoDetalhesScreen from '../screens/EventoDetalhesScreen';
import GaleriaScreen from '../screens/GaleriaScreen';
import PedidosScreen from '../screens/PedidosScreen';
import CheckoutSuccessScreen from '../screens/CheckoutSuccessScreen';
import CheckoutCancelScreen from '../screens/CheckoutCancelScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const appDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#000000',
    border: '#000000',
  },
};

interface CartIconWithBadgeProps {
  color: string;
  size: number;
}

function CartIconWithBadge({ color, size }: CartIconWithBadgeProps) {
  const { getCartCount } = useCart();
  const count = getCartCount();

  return (
    <View style={{ width: size, height: size }}>
      <Ionicons name="cart" size={size} color={color} />
      {count > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'relative',
          backgroundColor: '#4A2F73',
          borderTopWidth: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#D4A574',
        tabBarInactiveTintColor: '#B8A0D4',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Início"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Eventos"
        component={EventosScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Carrinho"
        component={CarrinhoScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <CartIconWithBadge color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const {
    isAuthenticated,
    phoneSyncRequired,
    submitPhoneForSync,
    isSyncingProfile,
  } = useAuth();
  const [phoneInput, setPhoneInput] = React.useState('');
  const [taxIdInput, setTaxIdInput] = React.useState('');

  const handleSubmitPhone = async () => {
    const result = await submitPhoneForSync(phoneInput, taxIdInput);
    if (!result.success) {
      Alert.alert('Dados inválidos', result.error ?? 'Nao foi possivel salvar seus dados.');
      return;
    }
    setPhoneInput('');
    setTaxIdInput('');
  };

  return (
    <NavigationContainer theme={appDarkTheme}>
      <>
        <Stack.Navigator>
          {!isAuthenticated ? (
            // Auth Stack - Telas para usuários não autenticados
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          ) : (
            // App Stack - Telas protegidas que requerem autenticação
            <>
              <Stack.Screen
                name="Main"
                component={TabNavigator}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Club"
                component={ClubScreen}
                options={{
                  headerShown: false,
                  presentation: 'modal',
                }}
              />
              <Stack.Screen
                name="EventoDetalhes"
                component={EventoDetalhesScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Galeria"
                component={GaleriaScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Pedidos"
                component={PedidosScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="CheckoutSuccess"
                component={CheckoutSuccessScreen}
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="CheckoutCancel"
                component={CheckoutCancelScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>

        <Modal visible={isAuthenticated && phoneSyncRequired} transparent animationType="fade">
          <View style={styles.phoneModalBackdrop}>
            <View style={styles.phoneModalCard}>
              <Text style={styles.phoneModalTitle}>Complete seu cadastro</Text>
              <Text style={styles.phoneModalText}>
                Para concluir seu cadastro no sistema, informe seu telefone e CPF/CNPJ.
              </Text>

              <TextInput
                style={styles.phoneInput}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="Ex: (11) 99999-9999"
                placeholderTextColor="#9F8ABF"
                keyboardType="phone-pad"
                editable={!isSyncingProfile}
              />

              <TextInput
                style={styles.phoneInput}
                value={taxIdInput}
                onChangeText={setTaxIdInput}
                placeholder="CPF/CNPJ"
                placeholderTextColor="#9F8ABF"
                keyboardType="number-pad"
                editable={!isSyncingProfile}
              />

              <TouchableOpacity
                style={[styles.phoneSubmitButton, isSyncingProfile && styles.phoneSubmitButtonDisabled]}
                onPress={() => { void handleSubmitPhone(); }}
                disabled={isSyncingProfile}
              >
                {isSyncingProfile ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.phoneSubmitButtonText}>Salvar telefone</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBadge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  phoneModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  phoneModalCard: {
    width: '100%',
    backgroundColor: '#4A2F73',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  phoneModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  phoneModalText: {
    color: '#CDB8E6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  phoneInput: {
    backgroundColor: '#5B3A8F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7C5BAA',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  phoneSubmitButton: {
    backgroundColor: '#D4A574',
    borderRadius: 10,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneSubmitButtonDisabled: {
    opacity: 0.7,
  },
  phoneSubmitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
