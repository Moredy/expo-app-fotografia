import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fotosCompradas } from '../data/mockData';
import { GaleriaScreenNavigationProp } from '../navigation/types';

const { width } = Dimensions.get('window');
const photoSize = Math.floor((width - 54) / 3);

interface GaleriaScreenProps {
  navigation: GaleriaScreenNavigationProp;
}

type AbaAtiva = 'ultimas' | 'eventos';

export default function GaleriaScreen({ navigation }: GaleriaScreenProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('ultimas');

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
          <TouchableOpacity key={foto.id} style={styles.photoContainer}>
            <Image source={foto.url} style={styles.photo} />
            <View style={styles.photoOverlay}>
              <Ionicons name="download" size={24} color="#fff" />
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

    // Agrupar fotos por evento
    const fotosPorEvento = fotosCompradas.reduce((acc: any, foto) => {
      if (!acc[foto.eventoId]) {
        acc[foto.eventoId] = {
          eventoNome: foto.eventoNome,
          fotos: [],
        };
      }
      acc[foto.eventoId].fotos.push(foto);
      return acc;
    }, {});

    return (
      <View style={styles.eventosList}>
        {Object.entries(fotosPorEvento).map(([eventoId, evento]: [string, any]) => (
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
              {evento.fotos.map((foto: any) => (
                <TouchableOpacity key={foto.id} style={styles.eventoPhotoContainer}>
                  <Image source={foto.url} style={styles.eventoPhoto} />
                  <View style={styles.photoOverlay}>
                    <Ionicons name="download" size={20} color="#fff" />
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {abaAtiva === 'ultimas' ? renderFotosUltimas() : renderFotosPorEvento()}
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
