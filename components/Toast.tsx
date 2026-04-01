import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
}

const ICON: Record<ToastType, 'checkmark-circle' | 'alert-circle' | 'information-circle'> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const BACKGROUND: Record<ToastType, string> = {
  success: '#2E7D32',
  error: '#C62828',
  info: '#1565C0',
};

export default function Toast({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
}: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onHide?.());
  }, [visible, duration, onHide, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: BACKGROUND[type], opacity }]}
      pointerEvents="none"
    >
      <Ionicons name={ICON[type]} size={20} color="#fff" />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
