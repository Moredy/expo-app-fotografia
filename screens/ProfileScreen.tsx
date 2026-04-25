import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { ProfileScreenNavigationProp } from '../navigation/types';

interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, signOut, submitPhoneForSync } = useAuth();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { getToken } = useClerkAuth();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

  const extractTaxId = (): string | null => {
    if (!clerkUser) return null;
    const metadata = {
      ...(clerkUser.publicMetadata as Record<string, unknown>),
      ...(clerkUser.unsafeMetadata as Record<string, unknown>),
    };

    const rawTaxId =
      typeof metadata.taxId === 'string'
        ? metadata.taxId
        : typeof metadata.cpfCnpj === 'string'
          ? metadata.cpfCnpj
          : typeof metadata.document === 'string'
            ? metadata.document
            : null;

    return rawTaxId ? rawTaxId.replace(/\D/g, '') : null;
  };

  const extractPhone = (): string => {
    if (!clerkUser) return '';
    const metadata = {
      ...(clerkUser.publicMetadata as Record<string, unknown>),
      ...(clerkUser.unsafeMetadata as Record<string, unknown>),
    };

    const rawPhone =
      clerkUser.primaryPhoneNumber?.phoneNumber ??
      (typeof metadata.phone === 'string'
        ? metadata.phone
        : typeof metadata.phoneNumber === 'string'
          ? metadata.phoneNumber
          : '');

    return String(rawPhone ?? '').replace(/\D/g, '');
  };

  const formatPhone = (digits: string): string => {
    const d = digits.replace(/\D/g, '');
    if (d.length === 11) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    return digits;
  };

  const openEditProfile = () => {
    if (!clerkUser) return;
    setFirstName(clerkUser.firstName ?? '');
    setLastName(clerkUser.lastName ?? '');
    setPhone(extractPhone());
    setIsEditModalVisible(true);
  };

  const saveProfile = async () => {
    if (!clerkUser) return;

    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();
    const phoneDigits = phone.replace(/\D/g, '');

    if (!nextFirstName && !nextLastName && !phoneDigits) {
      Alert.alert('Dados inválidos', 'Informe pelo menos nome, sobrenome ou telefone.');
      return;
    }

    if (phoneDigits && phoneDigits.length < 10) {
      Alert.alert('Telefone inválido', 'Informe um telefone com DDD válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const taxId = extractTaxId();
      const currentPhoneDigits = extractPhone();
      const hasPhoneChanged = phoneDigits.length > 0 && phoneDigits !== currentPhoneDigits;

      if (hasPhoneChanged) {
        if (!taxId || (taxId.length !== 11 && taxId.length !== 14)) {
          Alert.alert(
            'Telefone não pôde ser validado',
            'Para alterar o telefone, complete antes seu CPF/CNPJ para validação de unicidade.'
          );
          return;
        }

        const syncResult = await submitPhoneForSync(phoneDigits, taxId);
        if (!syncResult.success) {
          Alert.alert('Telefone indisponível', syncResult.error ?? 'Este telefone já está em uso por outro usuário.');
          return;
        }
      }

      await clerkUser.update({
        firstName: nextFirstName || null,
        lastName: nextLastName || null,
        unsafeMetadata: {
          ...(clerkUser.unsafeMetadata as Record<string, unknown>),
          phone: phoneDigits || null,
          phoneNumber: phoneDigits || null,
        },
      });

      setIsEditModalVisible(false);
      Alert.alert('Perfil atualizado', 'Seus dados foram atualizados com sucesso.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.';
      Alert.alert('Erro ao atualizar perfil', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const changePassword = async () => {
    if (!clerkUser) return;

    if (newPassword.length < 8) {
      Alert.alert('Senha inválida', 'A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Senhas diferentes', 'A confirmação da senha não confere.');
      return;
    }

    setIsSubmitting(true);
    try {
      await clerkUser.updatePassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword,
        signOutOfOtherSessions: false,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordModalVisible(false);
      Alert.alert('Senha alterada', 'Sua senha foi atualizada com sucesso.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível alterar sua senha.';
      Alert.alert('Erro ao alterar senha', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const performDeleteAccount = async () => {
    if (isDeletingAccount) return;

    setIsDeletingAccount(true);
    try {
      const token = await getToken({ skipCache: true });
      if (!token) {
        Alert.alert('Sessão expirada', 'Faça login novamente para excluir sua conta.');
        return;
      }

      const response = await fetch(`${baseUrl}/users/me/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: 'Exclusão solicitada pelo usuário no app',
        }),
      });

      if (!response.ok) {
        let message = `Erro ${response.status}: ${response.statusText}`;
        try {
          const rawBody = await response.text();
          const parsed = rawBody ? JSON.parse(rawBody) : null;
          if (typeof parsed?.message === 'string' && parsed.message.trim()) {
            message = parsed.message;
          } else if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            message = parsed.error;
          } else if (rawBody.trim()) {
            message = rawBody.trim();
          }
        } catch {
          // Mantém mensagem padrão quando a resposta não é JSON
        }

        throw new Error(message);
      }

      Alert.alert('Conta excluída', 'Sua conta e seus dados foram removidos com sucesso.', [
        {
          text: 'OK',
          onPress: () => {
            void signOut();
          },
        },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir sua conta.';
      Alert.alert('Erro ao excluir conta', message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Excluir minha conta',
      'Essa ação é permanente e removerá seu acesso e dados. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmação final',
              'Tem certeza absoluta? Esta ação não pode ser desfeita.',
              [
                { text: 'Voltar', style: 'cancel' },
                {
                  text: 'Excluir definitivamente',
                  style: 'destructive',
                  onPress: () => {
                    void performDeleteAccount();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  if (!isClerkLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D4A574" />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backIconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#F4E8FF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Perfil</Text>
          <View style={styles.topBarRightSpacer} />
        </View>

        <View style={styles.headerCard}>
          <View style={styles.avatarHalo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{user?.name || 'Usuário'}</Text>
          <Text style={styles.email}>{user?.email || 'email@example.com'}</Text>
        </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações da Conta</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome:</Text>
            <Text style={styles.infoValue}>{user?.name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Telefone:</Text>
            <Text style={styles.infoValue}>{formatPhone(extractPhone()) || 'Não informado'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações</Text>
        
        <TouchableOpacity style={styles.actionButton} onPress={openEditProfile}>
          <View style={styles.actionButtonLeft}>
            <View style={styles.actionIconBadge}>
              <Ionicons name="create-outline" size={16} color="#D4A574" />
            </View>
            <Text style={styles.actionButtonText}>Editar Perfil</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#B8A0D4" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setIsPasswordModalVisible(true)}
        >
          <View style={styles.actionButtonLeft}>
            <View style={styles.actionIconBadge}>
              <Ionicons name="lock-closed-outline" size={16} color="#D4A574" />
            </View>
            <Text style={styles.actionButtonText}>Alterar Senha</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#B8A0D4" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteActionButton, isDeletingAccount && styles.disabledButton]}
          onPress={confirmDeleteAccount}
          disabled={isDeletingAccount}
        >
          <View style={styles.actionButtonLeft}>
            <View style={styles.deleteActionIconBadge}>
              <Ionicons name="trash-outline" size={16} color="#FF8A80" />
            </View>
            <Text style={styles.deleteActionButtonText}>
              {isDeletingAccount ? 'Excluindo conta...' : 'Excluir Minha Conta'}
            </Text>
          </View>
          {isDeletingAccount ? (
            <ActivityIndicator size="small" color="#FFB4AE" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#FFB4AE" />
          )}
        </TouchableOpacity>
        
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={signOut}
      >
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Perfil</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              style={styles.input}
              placeholder="Nome"
              placeholderTextColor="#B8A0D4"
            />
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              style={styles.input}
              placeholder="Sobrenome"
              placeholderTextColor="#B8A0D4"
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              placeholder="Telefone"
              placeholderTextColor="#B8A0D4"
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => setIsEditModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => { void saveProfile(); }}
                disabled={isSubmitting}
              >
                <Text style={styles.modalPrimaryText}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isPasswordModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Alterar Senha</Text>

            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              style={styles.input}
              placeholder="Senha atual (se houver)"
              placeholderTextColor="#B8A0D4"
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={styles.input}
              placeholder="Nova senha"
              placeholderTextColor="#B8A0D4"
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={styles.input}
              placeholder="Confirmar nova senha"
              placeholderTextColor="#B8A0D4"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => setIsPasswordModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => { void changePassword(); }}
                disabled={isSubmitting}
              >
                <Text style={styles.modalPrimaryText}>{isSubmitting ? 'Salvando...' : 'Atualizar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3E2366',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  topBarTitle: {
    color: '#F4E8FF',
    fontSize: 18,
    fontWeight: '700',
  },
  topBarRightSpacer: {
    width: 40,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#59368F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 16,
  },
  avatarHalo: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: 'rgba(212,165,116,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#F6EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#3E2366',
  },
  name: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  email: {
    fontSize: 15,
    color: '#E8D9FA',
    textAlign: 'center',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#F4E8FF',
  },
  infoCard: {
    backgroundColor: '#4F2F80',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: '#BDA4DA',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    backgroundColor: '#4F2F80',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212,165,116,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteActionButton: {
    borderColor: 'rgba(255,138,128,0.45)',
    backgroundColor: 'rgba(94,28,28,0.45)',
  },
  deleteActionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,138,128,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFCDC9',
  },
  disabledButton: {
    opacity: 0.7,
  },
  logoutButton: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#4A2F73',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#5B3A8F',
    borderWidth: 1,
    borderColor: '#7B5BA8',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalPrimaryButton: {
    backgroundColor: '#D4A574',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalPrimaryText: {
    color: '#000',
    fontWeight: '700',
  },
  modalSecondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalSecondaryText: {
    color: '#fff',
    fontWeight: '600',
  },
});
