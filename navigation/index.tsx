import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer>
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
});
