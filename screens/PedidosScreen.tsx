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
import { useOrders } from '../contexts/OrderContext';
import { PedidosScreenNavigationProp } from '../navigation/types';

interface PedidosScreenProps {
  navigation: PedidosScreenNavigationProp;
}

export default function PedidosScreen({ navigation }: PedidosScreenProps) {
  const { orders, getStatusColor, getStatusLabel } = useOrders();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Meus Pedidos</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={80} color="#8E8E93" />
            <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
            <Text style={styles.emptyDescription}>
              Seus pedidos aparecerão aqui após a compra
            </Text>
          </View>
        ) : (
          orders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>Pedido #{order.id}</Text>
                  <Text style={styles.orderDate}>{order.data}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(order.status) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(order.status) },
                    ]}
                  >
                    {getStatusLabel(order.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.orderPhotos}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photosScroll}
                >
                  {order.fotos.map((foto, index) => (
                    <Image
                      key={index}
                      source={foto.url}
                      style={styles.orderPhoto}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.orderFooter}>
                <View style={styles.orderInfo}>
                  <Ionicons name="images-outline" size={16} color="#8E8E93" />
                  <Text style={styles.orderInfoText}>
                    {order.items} {order.items === 1 ? 'foto' : 'fotos'}
                  </Text>
                </View>
                <Text style={styles.orderTotal}>
                  R$ {order.total.toFixed(2).replace('.', ',')}
                </Text>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  orderCard: {
    backgroundColor: '#4A2F73',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 16,
    padding: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  orderId: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderPhotos: {
    marginBottom: 15,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  orderPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#3A2259',
    marginRight: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#7B5BA8',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderInfoText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 6,
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4A574',
  },
});
