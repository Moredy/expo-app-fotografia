import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  unitPrice: number;
  comprada: boolean;
  selecionada: boolean;
}

export default function EventoDetalhesScreen({ route, navigation }: EventoDetalhesScreenProps) {
  const insets = useSafeAreaInsets();
  const { evento } = route.params;
  const { addToCart, getCartCount, isInCart } = useCart();
  const { getToken } = useClerkAuth();
  const [modoSelecao, setModoSelecao] = useState<boolean>(false);
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<boolean>(false);
  const [fotoPreview, setFotoPreview] = useState<FotoLocal | null>(null);
  const addLockRef = useRef(false);

  const fetchFotos = async (): Promise<void> => {
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
          unitPrice: p.unitPrice,
          comprada: p.isPurchased ?? false,
          selecionada: false,
        })),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fotos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFotos();
    // O getToken do Clerk pode mudar de referência entre renders e causar loop no efeito.
    // Mantemos o carregamento vinculado ao evento atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento.id]);

  const toggleSelecao = (id: string): void => {
    setFotos((prevFotos) =>
      prevFotos.map((foto) =>
        foto.id === id ? { ...foto, selecionada: !foto.selecionada } : foto
      )
    );
  };

  const handleAddToCart = async (): Promise<void> => {
    if (addLockRef.current || addingToCart) return;
    addLockRef.current = true;

    const fotosSelecionadas = fotos.filter((f) => f.selecionada);
    let adicionadas = 0;
    let jaNoCarrinho = 0;
    let falhas = 0;
    let primeiraMensagemErro = '';
    const fotosComFalha: string[] = [];

    setAddingToCart(true);

    try {
      for (const foto of fotosSelecionadas) {
        try {
          const sucesso = await addToCart(foto, evento);
          if (sucesso) {
            adicionadas++;
          } else {
            jaNoCarrinho++;
          }
        } catch (err: unknown) {
          falhas++;
          fotosComFalha.push(foto.id);
          const message = err instanceof Error && err.message.trim().length > 0
            ? err.message
            : String(err || '').trim();
          if (!primeiraMensagemErro && message.length > 0) {
            primeiraMensagemErro = message;
          }
        }
      }
    } finally {
      setAddingToCart(false);
      addLockRef.current = false;
    }

    if (adicionadas > 0) {
      // Limpar seleções ao menos quando houver sucesso parcial/total
      setFotos((prevFotos) => prevFotos.map((f) => ({ ...f, selecionada: false })));
      setModoSelecao(false);

      const detalhes = [
        jaNoCarrinho > 0 ? `${jaNoCarrinho} ja estava${jaNoCarrinho > 1 ? 'm' : ''} no carrinho.` : '',
        falhas > 0
          ? `${falhas} falhou${falhas > 1 ? 'ram' : ''}.${primeiraMensagemErro ? `\nMotivo: ${primeiraMensagemErro}` : ''}${fotosComFalha.length > 0 ? `\nFotos: ${fotosComFalha.join(', ')}` : ''}`
          : '',
      ].filter(Boolean).join('\n\n');

      Alert.alert(
        'Sucesso! 🎉',
        `${adicionadas} foto${adicionadas > 1 ? 's' : ''} adicionada${adicionadas > 1 ? 's' : ''} ao carrinho!${
          detalhes ? `\n\n${detalhes}` : ''
        }`,
        [
          { text: 'Continuar comprando', style: 'cancel' },
          {
            text: 'Ver carrinho',
            onPress: () => navigation.navigate('Carrinho'),
          },
        ]
      );
    } else if (jaNoCarrinho > 0 && falhas === 0) {
      Alert.alert(
        'Aviso',
        'Todas as fotos selecionadas já estão no carrinho.'
      );
    } else {
      Alert.alert(
        'Erro',
        primeiraMensagemErro || 'Nao foi possivel adicionar ao carrinho.'
      );
    }
  };

  const handleOpenPreview = (foto: FotoLocal): void => {
    if (addingToCart) return;
    if (modoSelecao) {
      toggleSelecao(foto.id);
      return;
    }
    setFotoPreview(foto);
  };

  const handleAddPreviewToCart = async (): Promise<void> => {
    if (!fotoPreview || addLockRef.current || addingToCart) return;
    if (fotoPreview.comprada) {
      Alert.alert('Foto indisponivel', 'Essa foto ja foi comprada.');
      return;
    }

    setAddingToCart(true);
    addLockRef.current = true;

    try {
      const sucesso = await addToCart(fotoPreview, evento);

      if (sucesso) {
        Alert.alert('Sucesso! 🎉', 'Foto adicionada ao carrinho!', [
          { text: 'Continuar comprando', style: 'cancel' },
          {
            text: 'Ver carrinho',
            onPress: () => {
              setFotoPreview(null);
              navigation.navigate('Carrinho');
            },
          },
        ]);
      } else {
        Alert.alert('Aviso', 'Essa foto ja esta no carrinho.');
      }

      setFotoPreview(null);
    } catch (err: unknown) {
      Alert.alert(
        'Erro',
        err instanceof Error && err.message.trim().length > 0
          ? err.message
          : 'Nao foi possivel adicionar ao carrinho.',
      );
    } finally {
      setAddingToCart(false);
      addLockRef.current = false;
    }
  };

  const fotosSelecionadas = fotos.filter((f) => f.selecionada).length;
  const totalSelecionado = fotos
    .filter((f) => f.selecionada)
    .reduce((acc, foto) => acc + foto.unitPrice, 0);
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
        <Text style={styles.photosTitle}>Fotos ({fotos.length})</Text>
        {!loading && !error && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => {
              setModoSelecao((prevModoSelecao) => {
                if (prevModoSelecao) {
                  setFotos((prevFotos) => prevFotos.map((f) => ({ ...f, selecionada: false })));
                }
                return !prevModoSelecao;
              });
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
                onPress={() => handleOpenPreview(foto)}
                disabled={addingToCart}
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
        <View style={[styles.bottomBar, { paddingBottom: Math.max(15, insets.bottom + 10) }]}>
          <View>
            <Text style={styles.selectedCount}>
              {fotosSelecionadas} foto{fotosSelecionadas > 1 ? 's' : ''} selecionada{fotosSelecionadas > 1 ? 's' : ''}
            </Text>
            <Text style={styles.selectedPrice}>
              R$ {totalSelecionado.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() => { void handleAddToCart(); }}
            disabled={addingToCart}
          >
            <Ionicons name="cart" size={20} color="#000" />
            <Text style={styles.addToCartText}>{addingToCart ? 'Adicionando...' : 'Adicionar'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={Boolean(fotoPreview)}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoPreview(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setFotoPreview(null)}
              disabled={addingToCart}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            {fotoPreview && (
              <>
                <Image source={fotoPreview.url} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewPrice}>
                    R$ {fotoPreview.unitPrice.toFixed(2).replace('.', ',')}
                  </Text>

                  {fotoPreview.comprada ? (
                    <View style={styles.previewStatusRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#4CD964" />
                      <Text style={styles.previewStatusText}>Foto ja comprada</Text>
                    </View>
                  ) : isInCart(fotoPreview.id) ? (
                    <View style={styles.previewStatusRow}>
                      <Ionicons name="cart" size={18} color="#D4A574" />
                      <Text style={styles.previewStatusText}>Foto ja esta no carrinho</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.previewAddButton,
                      (fotoPreview.comprada || isInCart(fotoPreview.id) || addingToCart) &&
                        styles.previewAddButtonDisabled,
                    ]}
                    onPress={() => { void handleAddPreviewToCart(); }}
                    disabled={fotoPreview.comprada || isInCart(fotoPreview.id) || addingToCart}
                  >
                    <Ionicons name="cart" size={20} color="#000" />
                    <Text style={styles.previewAddText}>
                      {addingToCart ? 'Adicionando...' : 'Adicionar ao carrinho'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  previewCard: {
    backgroundColor: '#2E1A4A',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#5B3A8F',
  },
  previewCloseButton: {
    position: 'absolute',
    zIndex: 2,
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#3A2259',
  },
  previewInfo: {
    padding: 16,
    gap: 12,
  },
  previewPrice: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  previewStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewStatusText: {
    color: '#D8C8ED',
    fontSize: 14,
    marginLeft: 8,
  },
  previewAddButton: {
    backgroundColor: '#D4A574',
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  previewAddButtonDisabled: {
    opacity: 0.5,
  },
  previewAddText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
});
