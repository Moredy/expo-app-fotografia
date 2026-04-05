import React, { createContext, useContext, useEffect, useRef, ReactNode, useState, useCallback } from 'react';
import { useUser, useSignIn, useSignUp, useAuth as useClerkAuth } from '@clerk/clerk-expo';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  phoneSyncRequired: boolean;
  isSyncingProfile: boolean;
  submitPhoneForSync: (phone: string) => Promise<{ success: boolean; error?: string }>;
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

  const syncUser = useCallback(async (phoneOverride?: string): Promise<void> => {
    if (!clerkUser) return;

    const resolvedPhone = phoneOverride ?? clerkUser.primaryPhoneNumber?.phoneNumber ?? null;
    if (!resolvedPhone) {
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
        avatar_url: clerkUser.imageUrl ?? null,
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      const message = raw?.trim().length > 0
        ? raw.trim()
        : `Erro ${response.status}: ${response.statusText}`;
      throw new Error(message);
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

  const submitPhoneForSync = useCallback(async (phone: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedPhone = phone.trim();
    const digits = normalizedPhone.replace(/\D/g, '');

    if (digits.length < 10) {
      return { success: false, error: 'Informe um telefone válido com DDD.' };
    }

    setIsSyncingProfile(true);
    try {
      await syncUser(normalizedPhone);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel sincronizar o telefone.';
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
  const user: User | null = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        name: clerkUser.fullName || clerkUser.firstName || 'Usuário',
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
