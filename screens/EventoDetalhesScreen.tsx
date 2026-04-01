import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { useCart } from '../contexts/CartContext';
import { Evento } from '../data/mockData';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getEventPhotos } from '../services/eventsService';
import { ApiPhoto } from '../types/payment';

const { width } = Dimensions.get('window');
const photoSize = Math.floor((width - 54) / 3);

type EventoDetalhesScreenProps = NativeStackScreenProps<RootStackParamList, 'EventoDetalhes'>;

interface FotoLocal {
  id: string;
  url: { uri: string };
  comprada: boolean;
  selecionada: boolean;
}

export default function EventoDetalhesScreen({ route, navigation }: EventoDetalhesScreenProps) {
  const { evento } = route.params;
  const { addToCart, getCartCount, isInCart } = useCart();
  const { getToken } = useClerkAuth();
  const [modoSelecao, setModoSelecao] = useState<boolean>(false);
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: ApiPhoto[] = await getEventPhotos(
        evento.id,
        () => getToken({ skipCache: true }),
      );
      setFotos(
        data.map((p) => ({
          id: p.id,
          url: { uri: p.url },
          comprada: p.isPurchased ?? false,
          selecionada: false,
        })),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fotos.');
    } finally {
      setLoading(false);
    }
  }, [evento.id, getToken]);

  useEffect(() => { fetchFotos(); }, [fetchFotos]);

  const toggleSelecao = (id: string): void => {
    setFotos(
      fotos.map((foto) =>
        foto.id === id ? { ...foto, selecionada: !foto.selecionada } : foto
      )
    );
  };

  const handleAddToCart = (): void => {
    const fotosSelecionadas = fotos.filter((f) => f.selecionada);
    let adicionadas = 0;
    let jaNoCarrinho = 0;

    fotosSelecionadas.forEach((foto) => {
      const sucesso = addToCart(foto, evento);
      if (sucesso) {
        adicionadas++;
      } else {
        jaNoCarrinho++;
      }
    });

    // Limpar seleções
    setFotos(fotos.map((f) => ({ ...f, selecionada: false })));
    setModoSelecao(false);

    if (adicionadas > 0) {
      Alert.alert(
        'Sucesso! 🎉',
        `${adicionadas} foto${adicionadas > 1 ? 's' : ''} adicionada${adicionadas > 1 ? 's' : ''} ao carrinho!${
          jaNoCarrinho > 0 ? `\n\n${jaNoCarrinho} já estava${jaNoCarrinho > 1 ? 'm' : ''} no carrinho.` : ''
        }`,
        [
          { text: 'Continuar comprando', style: 'cancel' },
          {
            text: 'Ver carrinho',
            onPress: () => navigation.navigate('Carrinho'),
          },
        ]
      );
    } else if (jaNoCarrinho > 0) {
      Alert.alert(
        'Aviso',
        'Todas as fotos selecionadas já estão no carrinho.'
      );
    }
  };

  const fotosSelecionadas = fotos.filter((f) => f.selecionada).length;
  const cartCount = getCartCount();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ImageBackground
        source={evento.imagem}
        style={styles.header}
      >
        <View style={styles.headerOverlay}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topIcons}>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="heart-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Carrinho')}
              >
                <Ionicons name="cart-outline" size={24} color="#fff" />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.eventTitle}>{evento.titulo}</Text>
            <Text style={styles.eventLocation}>{evento.local}</Text>
            <Text style={styles.eventDate}>{evento.data}</Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.photosHeader}>
        <Text style={styles.photosTitle}>Fotos ({evento.totalFotos})</Text>
        {!loading && !error && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => {
              setModoSelecao(!modoSelecao);
              if (modoSelecao) {
                setFotos(fotos.map((f) => ({ ...f, selecionada: false })));
              }
            }}
          >
            <Ionicons
              name={modoSelecao ? 'close-circle' : 'checkmark-circle-outline'}
              size={20}
              color={modoSelecao ? '#FF3B30' : '#D4A574'}
            />
            <Text style={[styles.selectText, modoSelecao && styles.selectTextActive]}>
              {modoSelecao ? 'Cancelar' : 'Selecionar fotos'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#D4A574" />
          <Text style={styles.loadingText}>Carregando fotos...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={60} color="#FF8A65" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchFotos}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.photosGrid}>
            {fotos.map((foto) => (
              <TouchableOpacity
                key={foto.id}
                style={styles.photoContainer}
                onPress={() => modoSelecao && toggleSelecao(foto.id)}
              >
                <Image source={foto.url} style={styles.photo} />
                {foto.comprada && (
                  <View style={styles.compradaBadge}>
                    <Text style={styles.compradaText}>Comprada</Text>
                  </View>
                )}
                {isInCart(foto.id) && !modoSelecao && (
                  <View style={styles.inCartBadge}>
                    <Ionicons name="cart" size={14} color="#fff" />
                  </View>
                )}
                {modoSelecao && (
                  <View style={styles.selectionOverlay}>
                    <View
                      style={[
                        styles.checkbox,
                        foto.selecionada && styles.checkboxSelected,
                      ]}
                    >
                      {foto.selecionada && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {modoSelecao && fotosSelecionadas > 0 && (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.selectedCount}>
              {fotosSelecionadas} foto{fotosSelecionadas > 1 ? 's' : ''} selecionada{fotosSelecionadas > 1 ? 's' : ''}
            </Text>
            <Text style={styles.selectedPrice}>
              R$ {(fotosSelecionadas * 15).toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={handleAddToCart}
          >
            <Ionicons name="cart" size={20} color="#000" />
            <Text style={styles.addToCartText}>Adicionar</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5B3A8F',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  loadingText: {
    color: '#B8A0D4',
    fontSize: 15,
  },
  errorText: {
    color: '#FF8A65',
    fontSize: 15,
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
  header: {
    height: 300,
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerContent: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  eventLocation: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 16,
    color: '#D4A574',
  },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#4A2F73',
  },
  photosTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 14,
    color: '#D4A574',
    marginLeft: 5,
  },
  selectTextActive: {
    color: '#FF3B30',
  },
  content: {
    flex: 1,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
  },
  photoContainer: {
    width: photoSize,
    height: photoSize,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3A2259',
  },
  compradaBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  compradaText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  inCartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#D4A574',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#D4A574',
    borderColor: '#D4A574',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4A2F73',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#5B3A8F',
  },
  selectedCount: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedPrice: {
    fontSize: 14,
    color: '#D4A574',
    fontWeight: '600',
  },
  addToCartButton: {
    flexDirection: 'row',
    backgroundColor: '#D4A574',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
