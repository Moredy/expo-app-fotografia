import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import { Evento } from '../data/mockData';

// Definição das rotas do Tab Navigator
export type TabParamList = {
  Início: undefined;
  Eventos: undefined;
  Carrinho: undefined;
  Menu: undefined;
};

// Definição das rotas do Stack Navigator principal
export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<TabParamList>;
  Profile: undefined;
  Club: undefined;
  EventoDetalhes: {
    evento: Evento;
  };
  Galeria: undefined;
  Pedidos: undefined;
} & TabParamList; // Permite navegação direta para as tabs também

// Tipos compostos para navegação das telas do Tab
export type TabScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

// Tipos específicos para cada screen
export type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Início'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type EventosScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Eventos'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type CarrinhoScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Carrinho'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type MenuScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Menu'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export type ClubScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Club'>;

export type EventoDetalhesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EventoDetalhes'>;

export type GaleriaScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Galeria'>;

export type PedidosScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Pedidos'>;
