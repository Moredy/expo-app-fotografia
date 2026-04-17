import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { addEventFavorite, getEvents, getFavoriteEventIds, removeEventFavorite } from '../services/eventsService';
import { ApiEvent } from '../types/payment';
import { Evento } from '../data/mockData';
import { EventosScreenNavigationProp } from '../navigation/types';

interface EventosScreenProps {
  navigation: EventosScreenNavigationProp;
}

type EventListFilter = 'all' | 'favorites';

// Corrige URLs que o backend constrói prefixando MinIO sobre uma URL externa
// Ex: https://minio.host/bucket/https%3A//picsum.photos/300 → https://picsum.photos/300
function sanitizeCoverUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/https?%3A%2F%2F.+$/i) ?? url.match(/https?%3A\/\/.+$/i);
  if (match) return decodeURIComponent(match[0]);
  return url;
}

// Mapeia ApiEvent → Evento (shape esperado pela navegação)
function mapApiEvent(e: ApiEvent, isFavorite: boolean): Evento {
  const coverUrl = sanitizeCoverUrl(e.coverImageUrl);
  return {
    id: e.id,
    titulo: e.title,
    local: e.location,
    data: new Date(e.eventDate).toLocaleDateString('pt-BR'),
    dataRelativa: new Date(e.eventDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    imagem: coverUrl ? { uri: coverUrl } : require('../assets/fotos-mock/1.jpg'),
    totalFotos: e._count?.photos ?? 0,
    favorito: isFavorite,
  };
}

export default function EventosScreen({ navigation }: EventosScreenProps) {
  const { getToken } = useClerkAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritePendingIds, setFavoritePendingIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<EventListFilter>('all');

  const fetchEventos = async (isRefresh = false): Promise<void> => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const getFreshToken = async () => {
        const fresh = await getToken({ skipCache: true });
        return fresh ?? getToken();
      };

      const data = await getEvents(getFreshToken);

      let favoriteEventIds: string[] = [];
      try {
        favoriteEventIds = await getFavoriteEventIds(getFreshToken);
      } catch {
        favoriteEventIds = [];
      }

      const favoriteSet = new Set(favoriteEventIds);
      setFavoriteIds(favoriteSet);
      setEventos(data.map((event) => mapApiEvent(event, favoriteSet.has(event.id))));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar eventos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEventos();
    // O getToken do Clerk pode mudar de referência e reexecutar este efeito em loop.
    // Mantemos a primeira carga apenas no mount da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFavorite = async (eventId: string) => {
    if (favoritePendingIds.has(eventId)) return;

    const currentlyFavorite = favoriteIds.has(eventId);

    setFavoritePendingIds((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (currentlyFavorite) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

    setEventos((prev) =>
      prev.map((event) =>
        event.id === eventId ? { ...event, favorito: !currentlyFavorite } : event,
      ),
    );

    try {
      const getFreshToken = async () => {
        const fresh = await getToken({ skipCache: true });
        return fresh ?? getToken();
      };

      if (currentlyFavorite) {
        await removeEventFavorite(eventId, getFreshToken);
      } else {
        await addEventFavorite(eventId, getFreshToken);
      }
    } catch {
      // rollback em falha real de rede/servidor
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (currentlyFavorite) next.add(eventId);
        else next.delete(eventId);
        return next;
      });

      setEventos((prev) =>
        prev.map((event) =>
          event.id === eventId ? { ...event, favorito: currentlyFavorite } : event,
        ),
      );

      Alert.alert('Erro', 'Não foi possível atualizar o favorito. Tente novamente.');
    } finally {
      setFavoritePendingIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const displayedEventos = activeFilter === 'favorites'
    ? eventos.filter((event) => event.favorito)
    : eventos;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Eventos</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#D4A574" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Eventos</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={60} color="#FF8A65" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchEventos()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Eventos</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchEventos(true)}
            tintColor="#D4A574"
          />
        }
      >
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
              Todos ({eventos.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'favorites' && styles.filterChipActive]}
            onPress={() => setActiveFilter('favorites')}
          >
            <Ionicons
              name={activeFilter === 'favorites' ? 'heart' : 'heart-outline'}
              size={14}
              color={activeFilter === 'favorites' ? '#000' : '#D4A574'}
            />
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'favorites' && styles.filterChipTextActive,
              ]}
            >
              Favoritos ({eventos.filter((event) => event.favorito).length})
            </Text>
          </TouchableOpacity>
        </View>

        {displayedEventos.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons
              name={activeFilter === 'favorites' ? 'heart-outline' : 'calendar-outline'}
              size={80}
              color="#8E8E93"
            />
            <Text style={styles.emptyText}>
              {activeFilter === 'favorites'
                ? 'Você ainda não favoritou nenhum evento'
                : 'Nenhum evento disponível'}
            </Text>
          </View>
        ) : (
          displayedEventos.map((evento) => (
            <TouchableOpacity
              key={evento.id}
              style={styles.eventCard}
              onPress={() => navigation.navigate('EventoDetalhes', { evento })}
            >
              <Image source={evento.imagem} style={styles.eventImage} />
              <Pressable
                style={styles.favoriteIcon}
                onPress={(event) => {
                  event.stopPropagation();
                  void toggleFavorite(evento.id);
                }}
                disabled={favoritePendingIds.has(evento.id)}
              >
                <Ionicons
                  name={evento.favorito ? 'heart' : 'heart-outline'}
                  size={24}
                  color={evento.favorito ? '#FF3B30' : '#6B6B6B'}
                />
              </Pressable>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{evento.titulo}</Text>
                <Text style={styles.eventLocation}>{evento.local}</Text>
                <Text style={styles.eventDate}>{evento.data}</Text>
                <View style={styles.photosInfo}>
                  <Ionicons name="camera" size={16} color="#8E8E93" />
                  <Text style={styles.photosCount}>{evento.totalFotos} fotos</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  errorText: {
    color: '#FF8A65',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7C5BAA',
    backgroundColor: '#4A2F73',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: '#D4A574',
    borderColor: '#D4A574',
  },
  filterChipText: {
    color: '#D4A574',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#000',
  },
  eventCard: {
    backgroundColor: '#4A2F73',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#3A2259',
  },
  favoriteIcon: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  eventLocation: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 12,
  },
  photosInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photosCount: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 6,
  },
});
