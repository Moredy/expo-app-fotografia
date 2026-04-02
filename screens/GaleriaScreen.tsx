import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { GaleriaScreenNavigationProp } from '../navigation/types';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import Constants from 'expo-constants';
import {
  authorizePhotoDownload,
  getUserLibrary,
  logPhotoDownload,
  UserLibraryPhoto,
} from '../services/eventsService';

const { width } = Dimensions.get('window');
const photoSize = Math.floor((width - 54) / 3);

interface GaleriaScreenProps {
  navigation: GaleriaScreenNavigationProp;
}

type AbaAtiva = 'ultimas' | 'eventos';

export default function GaleriaScreen({ navigation }: GaleriaScreenProps) {
  const { getToken } = useClerkAuth();
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('ultimas');
  const [fotosCompradas, setFotosCompradas] = useState<UserLibraryPhoto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);
  const isExpoGo = Constants.appOwnership === 'expo';

  const getFileExtension = (url: string): string => {
    const noQuery = url.split('?')[0];
    const maybeExt = noQuery.split('.').pop()?.toLowerCase();
    if (maybeExt && /^[a-z0-9]{2,5}$/.test(maybeExt)) return maybeExt;
    return 'jpg';
  };

  const fotosPorEvento = useMemo(() => {
    return fotosCompradas.reduce((acc: Record<string, { eventoNome: string; fotos: UserLibraryPhoto[] }>, foto) => {
      if (!acc[foto.eventId]) {
        acc[foto.eventId] = {
          eventoNome: foto.eventName,
          fotos: [],
        };
      }
      acc[foto.eventId].fotos.push(foto);
      return acc;
    }, {});
  }, [fotosCompradas]);

  const fetchLibrary = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const data = await getUserLibrary(() => getToken({ skipCache: true }));
      setFotosCompradas(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar galeria.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePhoto = async (photoId: string): Promise<void> => {
    if (savingPhotoId) return;

    setSavingPhotoId(photoId);
    try {
      const downloadUrl = await authorizePhotoDownload(photoId, () => getToken({ skipCache: true }));

      try {
        await logPhotoDownload(photoId, () => getToken({ skipCache: true }));
      } catch {
        // Falha de log não deve interromper o download para o usuário.
      }

      if (Platform.OS === 'web' || isExpoGo) {
        await Linking.openURL(downloadUrl);
        if (isExpoGo) {
          Alert.alert(
            'Abrindo download',
            'No Expo Go o salvamento direto na galeria e limitado. O arquivo foi aberto no navegador para voce salvar no dispositivo.',
          );
        }
        return;
      }

      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (!permission.granted) {
        throw new Error('Permissao para salvar na galeria foi negada.');
      }

      const extension = getFileExtension(downloadUrl);
      const fileUri = `${FileSystem.cacheDirectory}foto-${photoId}-${Date.now()}.${extension}`;
      const downloaded = await FileSystem.downloadAsync(downloadUrl, fileUri);

      await MediaLibrary.saveToLibraryAsync(downloaded.uri);

      Alert.alert('Foto salva', 'A imagem foi salva no seu dispositivo.');
    } catch (err: unknown) {
      Alert.alert(
        'Falha no download',
        err instanceof Error ? err.message : 'Nao foi possivel salvar a foto.',
      );
    } finally {
      setSavingPhotoId(null);
    }
  };

  useEffect(() => {
    fetchLibrary();
    // O getToken do Clerk pode mudar de referência e causar loop no efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderFotosUltimas = (): React.ReactElement => {
    if (fotosCompradas.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={100} color="#3A2259" />
          <Text style={styles.emptyTitle}>Você ainda não possui nenhuma foto comprada</Text>
        </View>
      );
    }

    return (
      <View style={styles.photosGrid}>
        {fotosCompradas.map((foto) => (
          <TouchableOpacity
            key={foto.id}
            style={styles.photoContainer}
            onPress={() => handleSavePhoto(foto.id)}
            disabled={savingPhotoId === foto.id}
          >
            <Image source={{ uri: foto.imageUrl }} style={styles.photo} />
            <View style={styles.photoOverlay}>
              {savingPhotoId === foto.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download" size={24} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderFotosPorEvento = (): React.ReactElement => {
    if (fotosCompradas.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={100} color="#3A2259" />
          <Text style={styles.emptyTitle}>Você ainda não possui nenhuma foto comprada</Text>
        </View>
      );
    }

    return (
      <View style={styles.eventosList}>
        {Object.entries(fotosPorEvento).map(([eventoId, evento]) => (
          <View key={eventoId} style={styles.eventoSection}>
            <View style={styles.eventoHeader}>
              <Ionicons name="calendar" size={20} color="#D4A574" />
              <Text style={styles.eventoNome}>{evento.eventoNome}</Text>
              <Text style={styles.eventoCount}>{evento.fotos.length} fotos</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {evento.fotos.map((foto) => (
                <TouchableOpacity
                  key={foto.id}
                  style={styles.eventoPhotoContainer}
                  onPress={() => handleSavePhoto(foto.id)}
                  disabled={savingPhotoId === foto.id}
                >
                  <Image source={{ uri: foto.imageUrl }} style={styles.eventoPhoto} />
                  <View style={styles.photoOverlay}>
                    {savingPhotoId === foto.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="download" size={20} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="images" size={28} color="#fff" />
          <Text style={styles.title}>Galeria</Text>
        </View>
        <TouchableOpacity style={styles.cartButton}>
          <Ionicons name="cart-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, abaAtiva === 'ultimas' && styles.tabActive]}
          onPress={() => setAbaAtiva('ultimas')}
        >
          <Ionicons
            name="time-outline"
            size={20}
            color={abaAtiva === 'ultimas' ? '#D4A574' : '#B8A0D4'}
          />
          <Text
            style={[styles.tabText, abaAtiva === 'ultimas' && styles.tabTextActive]}
          >
            Últimas Compras
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, abaAtiva === 'eventos' && styles.tabActive]}
          onPress={() => setAbaAtiva('eventos')}
        >
          <Ionicons
            name="grid-outline"
            size={20}
            color={abaAtiva === 'eventos' ? '#D4A574' : '#B8A0D4'}
          />
          <Text
            style={[styles.tabText, abaAtiva === 'eventos' && styles.tabTextActive]}
          >
            Por Evento
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#D4A574" />
        </View>
      ) : error ? (
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={60} color="#FF8A65" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchLibrary}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {abaAtiva === 'ultimas' ? renderFotosUltimas() : renderFotosPorEvento()}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A2F73',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A2F73',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4A2F73',
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#3A2259',
    borderWidth: 1,
    borderColor: '#D4A574',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#B8A0D4',
  },
  tabTextActive: {
    color: '#D4A574',
  },
  content: {
    flex: 1,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    color: '#FF8A65',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#B8A0D4',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
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
  photoOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventosList: {
    paddingHorizontal: 20,
  },
  eventoSection: {
    marginBottom: 30,
  },
  eventoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  eventoNome: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  eventoCount: {
    fontSize: 14,
    color: '#B8A0D4',
  },
  horizontalScroll: {
    marginLeft: -5,
  },
  eventoPhotoContainer: {
    width: width * 0.35,
    height: width * 0.35,
    marginRight: 10,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  eventoPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3A2259',
  },
});
