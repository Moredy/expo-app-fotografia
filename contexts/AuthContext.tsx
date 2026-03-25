import React, { createContext, useContext, ReactNode } from 'react';
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
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { signIn: clerkSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signOut: clerkSignOut } = useClerkAuth();

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
