import React, { createContext, useContext, useEffect, useRef, ReactNode, useState, useCallback } from 'react';
import { useUser, useSignIn, useSignUp, useAuth as useClerkAuth } from '@clerk/clerk-expo';

interface User {
  id: string;
  email: string;
  name: string;
  abacateCustomerId?: string | null;
}

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  phoneSyncRequired: boolean;
  isSyncingProfile: boolean;
  submitPhoneForSync: (phone: string, taxId: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { signIn: clerkSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signOut: clerkSignOut, getToken } = useClerkAuth();
  const syncedUserIdRef = useRef<string | null>(null);
  const [phoneSyncRequired, setPhoneSyncRequired] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);

  const parseSyncErrorMessage = (raw: string, fallback: string): string => {
    if (!raw || raw.trim().length === 0) return fallback;

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.message === 'string' && parsed.message.trim().length > 0) {
        const normalized = parsed.message.toLowerCase();
        if (normalized.includes("expected property 'taxid'")) {
          return 'CPF/CNPJ obrigatório. Informe seu documento para concluir o cadastro.';
        }
        return parsed.message;
      }
      if (typeof parsed?.error === 'string' && parsed.error.trim().length > 0) {
        return parsed.error;
      }
    } catch {
      // resposta não é JSON
    }

    return raw.trim();
  };

  const normalizePhoneConflictMessage = (raw: string): string => {
    const text = (raw || '').toLowerCase();
    const phoneConflictPatterns = [
      'phone already',
      'phone exists',
      'telefone ja',
      'telefone já',
      'telefone existente',
      'telefone cadastrado',
      'telefone em uso',
      'already in use',
      'duplicate',
      'unique',
    ];

    if (phoneConflictPatterns.some((pattern) => text.includes(pattern))) {
      return 'Este telefone já está em uso por outro usuário.';
    }

    return raw;
  };

  const syncUser = useCallback(async (phoneOverride?: string, taxIdOverride?: string): Promise<void> => {
    if (!clerkUser) return;

    const metadata = {
      ...(clerkUser.publicMetadata as Record<string, unknown>),
      ...(clerkUser.unsafeMetadata as Record<string, unknown>),
    };
    const metadataCustomerId =
      typeof metadata.abacateCustomerId === 'string' ? metadata.abacateCustomerId.trim() : '';
    if (metadataCustomerId.length > 0) {
      setPhoneSyncRequired(false);
      syncedUserIdRef.current = clerkUser.id;
      return;
    }

    const metadataPhone =
      typeof metadata.phone === 'string'
        ? metadata.phone
        : typeof metadata.phoneNumber === 'string'
          ? metadata.phoneNumber
          : null;

    const rawPhone = phoneOverride ?? clerkUser.primaryPhoneNumber?.phoneNumber ?? metadataPhone ?? null;
    const metadataTaxId =
      typeof metadata.taxId === 'string'
        ? metadata.taxId
        : typeof metadata.cpfCnpj === 'string'
          ? metadata.cpfCnpj
          : typeof metadata.document === 'string'
            ? metadata.document
            : null;

    const rawTaxId = taxIdOverride?.trim() || metadataTaxId || null;
    const resolvedPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
    const resolvedTaxId = rawTaxId ? String(rawTaxId).replace(/\D/g, '') : null;

    if (!resolvedPhone || resolvedPhone.length < 10) {
      setPhoneSyncRequired(true);
      return;
    }

    if (!resolvedTaxId || (resolvedTaxId.length !== 11 && resolvedTaxId.length !== 14)) {
      setPhoneSyncRequired(true);
      return;
    }

    const token = await getToken({ skipCache: true });
    if (!token) return;

    const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/users/me/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
        name: clerkUser.fullName ?? clerkUser.firstName ?? 'Usuário',
        phone: resolvedPhone,
        taxId: resolvedTaxId,
        document: resolvedTaxId,
        cpfCnpj: resolvedTaxId,
        avatar_url: clerkUser.imageUrl ?? null,
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      const message = parseSyncErrorMessage(raw, `Erro ${response.status}: ${response.statusText}`);
      throw new Error(message);
    }

    // Persiste dados para evitar solicitar CPF/telefone novamente no próximo boot.
    try {
      await clerkUser.update({
        unsafeMetadata: {
          ...(clerkUser.unsafeMetadata as Record<string, unknown>),
          taxId: resolvedTaxId,
          cpfCnpj: resolvedTaxId,
          phone: resolvedPhone,
        },
      });
    } catch {
      // Se não conseguir persistir metadata, não bloqueia fluxo de login.
    }

    setPhoneSyncRequired(false);
    syncedUserIdRef.current = clerkUser.id;
  }, [clerkUser, getToken]);

  // Sincroniza o usuário Clerk com o backend logo após o login.
  // Idempotente: o backend cria ou confirma o vínculo clerkId → User.
  useEffect(() => {
    if (!userLoaded || !clerkUser) return;
    if (syncedUserIdRef.current === clerkUser.id) return; // já sincronizou nesta sessão

    const syncUserOnLogin = async () => {
      try {
        await syncUser();
      } catch (err) {
        // Falha silenciosa — o sync será tentado novamente na próxima sessão
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`Clerk sync falhou: ${message}`);
      }
    };

    void syncUserOnLogin();
  }, [clerkUser?.id, userLoaded, syncUser]);

  const submitPhoneForSync = useCallback(async (phone: string, taxId: string): Promise<{ success: boolean; error?: string }> => {
    const phoneDigits = phone.trim().replace(/\D/g, '');
    const taxIdDigits = taxId.trim().replace(/\D/g, '');

    if (phoneDigits.length < 10) {
      return { success: false, error: 'Informe um telefone válido com DDD.' };
    }

    if (taxIdDigits.length !== 11 && taxIdDigits.length !== 14) {
      return { success: false, error: 'Informe um CPF/CNPJ valido.' };
    }

    setIsSyncingProfile(true);
    try {
      await syncUser(phoneDigits, taxIdDigits);
      return { success: true };
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : 'Nao foi possivel sincronizar seu cadastro.';
      const message = normalizePhoneConflictMessage(rawMessage);
      return { success: false, error: message };
    } finally {
      setIsSyncingProfile(false);
    }
  }, [syncUser]);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!signInLoaded) {
      return { success: false, error: 'Autenticação não está pronta' };
    }

    try {
      const result = await clerkSignIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        return { success: true };
      } else {
        return { success: false, error: 'Autenticação incompleta' };
      }
    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      
      // Tratamento de erros específicos do Clerk
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Erro ao fazer login';
      return { success: false, error: errorMessage };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await clerkSignOut();
      setPhoneSyncRequired(false);
      setIsSyncingProfile(false);
      syncedUserIdRef.current = null;
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Mapear usuário do Clerk para o formato esperado
  const metadata = (clerkUser?.publicMetadata ?? {}) as Record<string, unknown>;
  const abacateCustomerId =
    typeof metadata.abacateCustomerId === 'string' ? metadata.abacateCustomerId : null;

  const user: User | null = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        name: clerkUser.fullName || clerkUser.firstName || 'Usuário',
        abacateCustomerId,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: !userLoaded || !signInLoaded,
        signIn,
        signOut,
        isAuthenticated: !!clerkUser,
        phoneSyncRequired,
        isSyncingProfile,
        submitPhoneForSync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextData => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
