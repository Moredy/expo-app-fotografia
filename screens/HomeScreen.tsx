import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Evento } from '../data/mockData';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { getEvents } from '../services/eventsService';
import { ApiEvent } from '../types/payment';
import { HomeScreenNavigationProp } from '../navigation/types';

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

// Corrige URLs que o backend constrói prefixando MinIO sobre uma URL externa
function sanitizeCoverUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/https?%3A%2F%2F.+$/i) ?? url.match(/https?%3A\/\/.+$/i);
  if (match) return decodeURIComponent(match[0]);
  return url;
}

function mapApiEventToEvento(e: ApiEvent): Evento {
  return {
    id: e.id,
    titulo: e.title,
    local: e.location,
    data: new Date(e.eventDate).toLocaleDateString('pt-BR'),
    dataRelativa: new Date(e.eventDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    }),
    imagem: (() => {
      const u = sanitizeCoverUrl(e.coverImageUrl);
      return u ? { uri: u } : require('../assets/fotos-mock/1.jpg');
    })(),
    totalFotos: e._count?.photos ?? 0,
    favorito: false,
  };
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const { getCartCount } = useCart();
  const tabBarHeight = useBottomTabBarHeight();
  const cartCount = getCartCount();
  const { getToken } = useClerkAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;

    getEvents(async () => {
      const fresh = await getTokenRef.current({ skipCache: true });
      return fresh ?? getTokenRef.current();
    })
      .then((data: ApiEvent[]) => {
        if (cancelled) return;
        setEventos(data.map((event) => mapApiEventToEvento(event)));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const androidStatusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { paddingTop: 20 + androidStatusBarOffset }]}>
        <Text style={styles.greeting}>{getGreeting()}, {user?.name?.split(' ')[0] || 'Usuário'}!</Text>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => navigation.navigate('Carrinho')}
        >
          <Ionicons name="cart-outline" size={28} color="#fff" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Card do Clube */}
        <TouchableOpacity
          style={styles.clubCard}
          onPress={() => navigation.navigate('Club')}
        >
          <Image
            source={require('../assets/logos/logo_branca.png')}
            style={styles.clubLogo}
            resizeMode="contain"
          />
          <View style={styles.clubContent}>
            <Text style={styles.clubTitle}>VL Club</Text>
            <Text style={styles.clubDescription}>
              Faça parte do nosso clube e tenha acesso à todas as nossas fotos!
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#8E8E93" />
        </TouchableOpacity>

        {/* Card da Galeria */}
        <TouchableOpacity
          style={styles.galeriaCard}
          onPress={() => navigation.navigate('Galeria')}
        >
          <View style={styles.galeriaIcon}>
            <Ionicons name="images" size={32} color="#fff" />
          </View>
          <View style={styles.galeriaContent}>
            <Text style={styles.galeriaTitle}>Minhas Fotos</Text>
            <Text style={styles.galeriaDescription}>
              Acesse suas fotos compradas
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#8E8E93" />
        </TouchableOpacity>

        {/* Seção de Eventos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Eventos</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Eventos')}>
              <Text style={styles.seeAll}>Ver tudo</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScroll}
          >
            {eventos.map((evento) => (
              <TouchableOpacity
                key={evento.id}
                style={styles.eventCard}
                onPress={() => navigation.navigate('EventoDetalhes', { evento })}
              >
                <Image source={evento.imagem} style={styles.eventImage} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle} numberOfLines={2}>
                    {evento.titulo}
                  </Text>
                  <Text style={styles.eventDate}>{evento.dataRelativa}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
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
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cartButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A2F73',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A2F73',
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 20,
    borderRadius: 16,
  },
  clubLogo: {
    width: 80,
    height: 40,
    marginRight: 15,
  },
  clubContent: {
    flex: 1,
  },
  clubTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  clubDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  galeriaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4A574',
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 20,
    borderRadius: 16,
  },
  galeriaIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#5B3A8F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  galeriaContent: {
    flex: 1,
  },
  galeriaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 5,
  },
  galeriaDescription: {
    fontSize: 14,
    color: '#5B3A8F',
    lineHeight: 18,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  seeAll: {
    fontSize: 16,
    color: '#8E8E93',
  },
  horizontalScroll: {
    paddingLeft: 20,
  },
  eventCard: {
    width: width * 0.7,
    marginRight: 15,
    backgroundColor: '#4A2F73',
    borderRadius: 16,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#3A2259',
  },
  favoriteIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    padding: 15,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  favoriteCard: {
    width: width * 0.35,
    height: width * 0.35,
    marginRight: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  favoriteImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3A2259',
  },
});
