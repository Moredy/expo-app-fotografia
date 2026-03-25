import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventos } from '../data/mockData';
import { EventosScreenNavigationProp } from '../navigation/types';

interface EventosScreenProps {
  navigation: EventosScreenNavigationProp;
}

export default function EventosScreen({ navigation }: EventosScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Eventos</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {eventos.map((evento) => (
          <TouchableOpacity
            key={evento.id}
            style={styles.eventCard}
            onPress={() => navigation.navigate('EventoDetalhes', { evento })}
          >
            <Image source={evento.imagem} style={styles.eventImage} />
            {evento.favorito && (
              <View style={styles.favoriteIcon}>
                <Ionicons name="heart" size={24} color="#FF3B30" />
              </View>
            )}
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
        ))}
        
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
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
