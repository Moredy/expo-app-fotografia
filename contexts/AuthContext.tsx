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
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresSecondFactor?: boolean }>;
  completeSecondFactor: (code: string) => Promise<{ success: boolean; error?: string }>;
  secondFactorStrategy: 'totp' | 'email_code' | null;
  resetSecondFactor: () => void;
  resendSecondFactorCode: () => Promise<{ success: boolean; error?: string }>;
  pendingSecondFactor: boolean;
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
  const { signIn: clerkSignIn, setActive: setActiveSignInSession, isLoaded: signInLoaded } = useSignIn();
  const { signOut: clerkSignOut, getToken } = useClerkAuth();
  const syncedUserIdRef = useRef<string | null>(null);
  const [phoneSyncRequired, setPhoneSyncRequired] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [pendingSecondFactor, setPendingSecondFactor] = useState(false);
  const [secondFactorStrategy, setSecondFactorStrategy] = useState<'totp' | 'email_code' | null>(null);

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

  const translateAuthErrorMessage = (raw?: string): string => {
    const message = (raw || '').trim();
    if (!message) return 'Não foi possível fazer login. Tente novamente.';

    const normalized = message.toLowerCase();

    if (normalized.includes('password is incorrect')) {
      return 'Senha incorreta. Tente novamente ou use outro método.';
    }

    if (normalized.includes('identifier') && normalized.includes('not found')) {
      return 'Não encontramos uma conta com esse e-mail.';
    }

    if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    }

    if (normalized.includes('network') || normalized.includes('fetch')) {
      return 'Falha de conexão. Verifique sua internet e tente novamente.';
    }

    return 'Não foi possível fazer login. Verifique seus dados e tente novamente.';
  };

  const translateVerificationErrorMessage = (raw?: string): string => {
    const message = (raw || '').trim();
    if (!message) return 'Não foi possível validar o código. Tente novamente.';

    const normalized = message.toLowerCase();

    if (normalized.includes('is incorrect') || normalized.includes('invalid code') || normalized.includes('code is invalid')) {
      return 'Código incorreto. Tente novamente.';
    }

    if (normalized.includes('expired') || normalized.includes('too old')) {
      return 'Código expirado. Gere um novo código e tente novamente.';
    }

    if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    }

    if (normalized.includes('required') || normalized.includes('missing')) {
      return 'Informe o código de verificação para continuar.';
    }

    return 'Não foi possível validar o código. Confira e tente novamente.';
  };

  const logClerkRawError = (scope: string, error: unknown): void => {
    const err = error as any;
    const details = {
      scope,
      message: err?.message ?? null,
      code: err?.code ?? null,
      status: err?.status ?? null,
      clerkTraceId: err?.clerkTraceId ?? null,
      errors: Array.isArray(err?.errors) ? err.errors : null,
      meta: err?.meta ?? null,
      rawType: typeof error,
    };

    try {
      console.error(`[CLERK RAW ERROR] ${scope}: ${JSON.stringify(details, null, 2)}`);
    } catch {
      console.error(`[CLERK RAW ERROR] ${scope}:`, details);
    }
  };

  const getIncompleteAuthMessage = (status?: string | null): string => {
    if (!status) {
      return 'Não foi possível concluir a autenticação. Tente novamente.';
    }

    switch (status) {
      case 'needs_first_factor':
        return 'Sua conta exige verificação adicional (primeiro fator). Conclua a etapa para entrar.';
      case 'needs_second_factor':
        return 'Sua conta exige segundo fator (MFA). Conclua a verificação para continuar.';
      case 'needs_new_password':
        return 'É necessário definir uma nova senha para concluir o login.';
      case 'needs_identifier':
        return 'Informe um identificador válido (e-mail/telefone) para continuar.';
      case 'needs_verification':
        return 'É necessário verificar sua conta para concluir o login.';
      case 'complete':
        return '';
      default:
        return `Autenticação pendente (${status}).`;
    }
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

    if (!resolvedTaxId || resolvedTaxId.length !== 11) {
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

    if (taxIdDigits.length !== 11) {
      return { success: false, error: 'Informe um CPF valido.' };
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

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; requiresSecondFactor?: boolean }> => {
    if (!signInLoaded) {
      return { success: false, error: 'Autenticação não está pronta' };
    }

    // Evita manter estado de MFA de uma tentativa anterior.
    setPendingSecondFactor(false);
    setSecondFactorStrategy(null);

    try {
      const result = await clerkSignIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActiveSignInSession?.({ session: result.createdSessionId });
        setPendingSecondFactor(false);
        setSecondFactorStrategy(null);
        return { success: true };
      } else if (result.status === 'needs_second_factor') {
        const supportedSecondFactors = Array.isArray((result as any)?.supportedSecondFactors)
          ? ((result as any).supportedSecondFactors as Array<{ strategy?: string; primary?: boolean }>)
          : [];

        try {
          console.warn(
            `[CLERK SIGNIN STATUS] needs_second_factor: ${JSON.stringify(
              {
                status: result.status,
                supportedSecondFactors,
              },
              null,
              2,
            )}`,
          );
        } catch {
          console.warn('[CLERK SIGNIN STATUS] needs_second_factor (nao serializavel)');
        }

        const primaryFactor = supportedSecondFactors.find((factor) => factor?.primary);
        const preferredStrategy =
          primaryFactor?.strategy === 'email_code' || primaryFactor?.strategy === 'totp'
            ? primaryFactor.strategy
            : supportedSecondFactors.some((factor) => factor?.strategy === 'email_code')
              ? 'email_code'
              : supportedSecondFactors.some((factor) => factor?.strategy === 'totp')
                ? 'totp'
                : null;

        if (!preferredStrategy) {
          return {
            success: false,
            requiresSecondFactor: false,
            error:
              'Sua conta exige segundo fator, mas o app nao encontrou um metodo MFA compativel. Verifique o Two-step verification do usuario no Clerk.',
          };
        }

        if (preferredStrategy === 'email_code') {
          try {
            await (clerkSignIn as any)?.prepareSecondFactor?.({ strategy: 'email_code' });
          } catch (prepareError) {
            logClerkRawError('signIn.prepareSecondFactor(email_code)', prepareError);
          }
        }

        setSecondFactorStrategy(preferredStrategy);
        setPendingSecondFactor(true);
        return {
          success: false,
          requiresSecondFactor: true,
          error: getIncompleteAuthMessage(result.status),
        };
      } else {
        setPendingSecondFactor(false);
        setSecondFactorStrategy(null);
        const statusMessage = getIncompleteAuthMessage(result.status);
        console.warn(`Login retornou status não finalizado: ${result.status}`);
        return { success: false, error: statusMessage };
      }
    } catch (error: any) {
      setPendingSecondFactor(false);
      setSecondFactorStrategy(null);
      logClerkRawError('signIn.create', error);
      const errorCode = error?.errors?.[0]?.code || error?.code || 'desconhecido';
      console.error(`Erro ao fazer login (codigo: ${errorCode})`);

      // Tratamento de erros específicos do Clerk
      const rawErrorMessage = error?.errors?.[0]?.message || error?.message;
      const errorMessage = translateAuthErrorMessage(rawErrorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const resetSecondFactor = (): void => {
    setPendingSecondFactor(false);
    setSecondFactorStrategy(null);
  };

  const resendSecondFactorCode = async (): Promise<{ success: boolean; error?: string }> => {
    if (!signInLoaded) {
      return { success: false, error: 'Autenticação não está pronta' };
    }

    if (secondFactorStrategy !== 'email_code') {
      return { success: false, error: 'Reenvio disponível apenas para código por e-mail.' };
    }

    try {
      await (clerkSignIn as any)?.prepareSecondFactor?.({ strategy: 'email_code' });
      return { success: true };
    } catch (error: any) {
      logClerkRawError('signIn.prepareSecondFactor(email_code resend)', error);
      const rawErrorMessage = error?.errors?.[0]?.message || error?.message;
      const errorMessage = translateVerificationErrorMessage(rawErrorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const completeSecondFactor = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!signInLoaded) {
      return { success: false, error: 'Autenticação não está pronta' };
    }

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return { success: false, error: 'Informe o código MFA.' };
    }

    try {
      const strategy = secondFactorStrategy ?? 'totp';
      const result = await clerkSignIn.attemptSecondFactor({
        strategy,
        code: normalizedCode,
      });

      if (result.status === 'complete') {
        await setActiveSignInSession?.({ session: result.createdSessionId });
        setPendingSecondFactor(false);
        setSecondFactorStrategy(null);
        return { success: true };
      }

      return { success: false, error: getIncompleteAuthMessage(result.status) };
    } catch (error: any) {
      logClerkRawError('signIn.attemptSecondFactor', error);
      const rawErrorMessage = error?.errors?.[0]?.message || error?.message;
      const errorMessage = translateVerificationErrorMessage(rawErrorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await clerkSignOut();
      setPhoneSyncRequired(false);
      setIsSyncingProfile(false);
      setPendingSecondFactor(false);
      setSecondFactorStrategy(null);
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
        completeSecondFactor,
        secondFactorStrategy,
        resetSecondFactor,
        resendSecondFactorCode,
        pendingSecondFactor,
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
