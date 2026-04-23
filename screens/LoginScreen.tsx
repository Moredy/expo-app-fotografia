import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  ImageBackground,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useSignUp, useOAuth, useSignIn } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const LOGIN_CONTAINER_PURPLE = '#4A2F73';

const getOAuthRedirectUrl = (): string => {
  const envRedirectUrl = process.env.EXPO_PUBLIC_CLERK_OAUTH_REDIRECT_URL?.trim();

  if (envRedirectUrl) {
    return envRedirectUrl;
  }

  // Avoid leading slash so custom schemes resolve to scheme://oauth-callback.
  return Linking.createURL('oauth-callback');
};

const translateClerkUiError = (raw?: string): string => {
  const message = (raw || '').trim();
  if (!message) return 'Não foi possível concluir a operação. Tente novamente.';

  const normalized = message.toLowerCase();

  if (normalized.includes('is incorrect') || normalized.includes('invalid code') || normalized.includes('code is invalid')) {
    return 'Código incorreto. Verifique e tente novamente.';
  }

  if (normalized.includes('expired') || normalized.includes('too old')) {
    return 'Código expirado. Solicite um novo código.';
  }

  if (normalized.includes('already exists')) {
    return 'Já existe uma conta com esse e-mail.';
  }

  if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }

  return 'Não foi possível concluir a operação. Verifique os dados e tente novamente.';
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);
  const [isResetPasswordMode, setIsResetPasswordMode] = useState<boolean>(false);
  const [pendingEmailVerification, setPendingEmailVerification] = useState<boolean>(false);
  const [resetCode, setResetCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const oauthRedirectUrl = getOAuthRedirectUrl();
  const {
    signIn,
    completeSecondFactor,
    secondFactorStrategy,
    resetSecondFactor,
    resendSecondFactorCode,
    pendingSecondFactor,
    isLoading,
  } = useAuth();
  const {
    signIn: clerkResetSignIn,
    setActive: setActiveResetSession,
    isLoaded: resetSignInLoaded,
  } = useSignIn();
  const { signUp, setActive, isLoaded: signUpLoaded } = useSignUp();
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuth } = useOAuth({ strategy: 'oauth_apple' });
  const isMfaMode = !isSignUpMode && !isResetPasswordMode && pendingSecondFactor;

  const resetToLoginMode = (): void => {
    setIsSignUpMode(false);
    setIsResetPasswordMode(false);
    setPendingEmailVerification(false);
    resetSecondFactor();
    setVerificationCode('');
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setFullName('');
    setPassword('');
  };

  const resetForgotPasswordState = (): void => {
    setIsResetPasswordMode(false);
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
  };

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        if (result.requiresSecondFactor) {
          setVerificationCode('');
        }
        if (!result.requiresSecondFactor) {
          Alert.alert('Erro', result.error || 'Falha ao fazer login');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSecondFactor = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await completeSecondFactor(verificationCode);
      if (!result.success) {
        Alert.alert('Erro', result.error || 'Não foi possível validar o MFA.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendSecondFactorCode = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await resendSecondFactorCode();
      if (!result.success) {
        Alert.alert('Erro', result.error || 'Nao foi possivel reenviar o codigo.');
        return;
      }

      Alert.alert('Codigo reenviado', 'Enviamos um novo codigo para o seu e-mail.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartForgotPassword = async (): Promise<void> => {
    if (!email.trim()) {
      Alert.alert('Erro', 'Informe seu e-mail para recuperar a senha.');
      return;
    }

    if (!resetSignInLoaded) {
      Alert.alert('Erro', 'Sistema de recuperação de senha não está pronto. Tente novamente.');
      return;
    }

    setLoading(true);
    try {
      const result = await clerkResetSignIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });

      if (result.status === 'needs_first_factor') {
        setIsResetPasswordMode(true);
        setResetCode('');
        Alert.alert('Código enviado', 'Enviamos um código de recuperação para seu e-mail.');
        return;
      }

      Alert.alert('Erro', 'Não foi possível iniciar a recuperação de senha agora.');
    } catch (error: any) {
      const rawMessage =
        error?.errors?.[0]?.message ||
        error?.errors?.[0]?.longMessage ||
        error?.message ||
        'Não foi possível iniciar a recuperação de senha.';
      const errorMessage = translateClerkUiError(rawMessage);
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (): Promise<void> => {
    if (!resetCode.trim()) {
      Alert.alert('Erro', 'Informe o código enviado para seu e-mail.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Erro', 'A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Erro', 'As senhas não conferem.');
      return;
    }

    if (!resetSignInLoaded) {
      Alert.alert('Erro', 'Sistema de recuperação de senha não está pronto. Tente novamente.');
      return;
    }

    setLoading(true);
    try {
      const result = await clerkResetSignIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode.trim(),
        password: newPassword,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActiveResetSession?.({ session: result.createdSessionId });
        Alert.alert('Senha redefinida', 'Sua senha foi atualizada com sucesso.');
        resetForgotPasswordState();
        setPassword('');
        return;
      }

      Alert.alert('Atenção', 'Não foi possível concluir a redefinição de senha. Tente novamente.');
    } catch (error: any) {
      const rawMessage =
        error?.errors?.[0]?.message ||
        error?.errors?.[0]?.longMessage ||
        error?.message ||
        'Não foi possível redefinir a senha.';
      const errorMessage = translateClerkUiError(rawMessage);
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (): Promise<void> => {
    if (!fullName.trim() || !email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (!signUpLoaded) {
      Alert.alert('Erro', 'Sistema de cadastro não está pronto. Aguarde alguns segundos e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      const normalizedFullName = fullName.trim().replace(/\s+/g, ' ');
      const nameParts = normalizedFullName.split(' ');
      const firstName = nameParts[0] || normalizedFullName;
      const lastName = nameParts.slice(1).join(' ') || undefined;

      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
        unsafeMetadata: {
          fullName: normalizedFullName,
        },
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        Alert.alert('Conta criada!', 'Sua conta foi criada e autenticada com sucesso.');
        resetToLoginMode();
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingEmailVerification(true);
      setVerificationCode('');
      Alert.alert('Código enviado', 'Enviamos um código de verificação para seu e-mail.');
    } catch (error: any) {
      console.error('Erro ao criar conta:', error);

      let errorMessage = 'Erro ao criar conta. Tente novamente.';

      if (error?.errors && error.errors.length > 0) {
        errorMessage = error.errors[0].message || error.errors[0].longMessage || errorMessage;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      errorMessage = translateClerkUiError(errorMessage);
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailCode = async (): Promise<void> => {
    if (!verificationCode.trim()) {
      Alert.alert('Erro', 'Informe o código enviado para seu e-mail.');
      return;
    }

    if (!signUpLoaded) {
      Alert.alert('Erro', 'Sistema de cadastro não está pronto. Aguarde e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive?.({ session: attempt.createdSessionId });
        Alert.alert('E-mail verificado', 'Sua conta foi confirmada com sucesso.');
        resetToLoginMode();
        return;
      }

      Alert.alert('Verificação pendente', 'Não foi possível concluir a verificação. Tente novamente.');
    } catch (error: any) {
      const rawMessage =
        error?.errors?.[0]?.message ||
        error?.errors?.[0]?.longMessage ||
        error?.message ||
        'Código inválido ou expirado. Solicite um novo código.';
      const errorMessage = translateClerkUiError(rawMessage);
      Alert.alert('Erro ao verificar código', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async (): Promise<void> => {
    if (!signUpLoaded) {
      Alert.alert('Erro', 'Sistema de cadastro não está pronto. Aguarde e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      Alert.alert('Código reenviado', 'Verifique seu e-mail para o novo código.');
    } catch (error: any) {
      const rawMessage =
        error?.errors?.[0]?.message ||
        error?.errors?.[0]?.longMessage ||
        error?.message ||
        'Não foi possível reenviar o código agora.';
      const errorMessage = translateClerkUiError(rawMessage);
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (isSignUpMode) {
      if (pendingEmailVerification) {
        await handleVerifyEmailCode();
      } else {
        await handleSignUp();
      }
    } else if (isResetPasswordMode) {
      await handleResetPassword();
    } else if (isMfaMode) {
      await handleCompleteSecondFactor();
    } else {
      await handleLogin();
    }
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    try {
      const { createdSessionId, setActive } = await startGoogleOAuth({
        redirectUrl: oauthRedirectUrl,
      });
      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
      }
    } catch (err) {
      console.error('Google OAuth error:', err);
      Alert.alert('Erro', 'Não foi possível fazer login com Google. Tente novamente.');
    }
  };

  const handleAppleSignIn = async (): Promise<void> => {
    try {
      const { createdSessionId, setActive } = await startAppleOAuth({
        redirectUrl: oauthRedirectUrl,
      });
      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
      }
    } catch (err) {
      console.error('Apple OAuth error:', err);
      Alert.alert('Erro', 'Não foi possível fazer login com Apple. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ImageBackground
          source={require('../assets/fotos-mock/1.jpg')}
          style={styles.background}
          blurRadius={3}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.overlay}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/logos/logo_branca.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <View style={[styles.formContainer, { paddingBottom: 30 + Math.max(insets.bottom, 16) }]}>
                <Text style={styles.title}>
                  {isSignUpMode
                    ? pendingEmailVerification
                      ? 'Verificar E-mail'
                      : 'Criar Conta'
                    : isResetPasswordMode
                      ? 'Redefinir Senha'
                    : isMfaMode
                      ? secondFactorStrategy === 'email_code'
                        ? 'Verificação por E-mail'
                        : 'Verificação MFA'
                      : 'Login'}
                </Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading && !isLoading && !pendingEmailVerification}
              />
            </View>

            {isSignUpMode && !pendingEmailVerification && (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Nome completo"
                  placeholderTextColor="#999"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  editable={!loading && !isLoading}
                />
              </View>
            )}

            {isSignUpMode && pendingEmailVerification ? (
              <>
                <Text style={styles.infoText}>Digite o código de 6 dígitos enviado para seu e-mail.</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Código de verificação"
                    placeholderTextColor="#999"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!loading && !isLoading}
                  />
                </View>
              </>
            ) : isResetPasswordMode ? (
              <>
                <Text style={styles.infoText}>
                  Digite o código recebido por e-mail e informe sua nova senha.
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Código de recuperação"
                    placeholderTextColor="#999"
                    value={resetCode}
                    onChangeText={setResetCode}
                    keyboardType="number-pad"
                    editable={!loading && !isLoading}
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Nova senha (mínimo 8 caracteres)"
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    editable={!loading && !isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={24}
                      color="#999"
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirmar nova senha"
                    placeholderTextColor="#999"
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    secureTextEntry={!showNewPassword}
                    editable={!loading && !isLoading}
                  />
                </View>
              </>
            ) : isMfaMode ? (
              <>
                <Text style={styles.infoText}>
                  {secondFactorStrategy === 'email_code'
                    ? 'Digite o codigo enviado para seu e-mail para concluir o login.'
                    : 'Digite o codigo do seu app autenticador para concluir o login.'}
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder={secondFactorStrategy === 'email_code' ? 'Codigo recebido por e-mail' : 'Codigo MFA'}
                    placeholderTextColor="#999"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    editable={!loading && !isLoading}
                  />
                </View>
              </>
            ) : (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={isSignUpMode ? 'Senha (mínimo 8 caracteres)' : 'Digite sua senha'}
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading && !isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={24}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, (loading || isLoading) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || isLoading}
            >
              {(loading || isLoading) ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUpMode
                    ? pendingEmailVerification
                      ? 'Verificar código'
                      : 'Criar Conta'
                    : isResetPasswordMode
                      ? 'Redefinir senha'
                    : isMfaMode
                      ? 'Validar codigo'
                      : 'Continuar'}
                </Text>
              )}
            </TouchableOpacity>

            {isMfaMode && secondFactorStrategy === 'email_code' && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleResendSecondFactorCode}
                disabled={loading || isLoading}
              >
                <Text style={styles.linkText}>Reenviar codigo</Text>
              </TouchableOpacity>
            )}

            {isResetPasswordMode && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleStartForgotPassword}
                disabled={loading || isLoading}
              >
                <Text style={styles.linkText}>Reenviar código</Text>
              </TouchableOpacity>
            )}

            {isSignUpMode && pendingEmailVerification && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleResendCode}
                disabled={loading || isLoading}
              >
                <Text style={styles.linkText}>Reenviar código</Text>
              </TouchableOpacity>
            )}

            {!isSignUpMode && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={isMfaMode ? resetToLoginMode : isResetPasswordMode ? resetForgotPasswordState : handleStartForgotPassword}
                disabled={loading || isLoading}
              >
                <Text style={styles.linkText}>
                  {isMfaMode ? 'Voltar ao login' : isResetPasswordMode ? 'Voltar ao login' : 'Esqueceu a senha?'}
                </Text>
              </TouchableOpacity>
            )}

            {!pendingEmailVerification && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou continue com</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
                  <AntDesign name="google" size={20} color="#111" />
                  <Text style={styles.socialButtonText}>Continuar com Google</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={[styles.socialButton, styles.appleButton]} onPress={handleAppleSignIn}>
                    <AntDesign name="apple" size={22} color="#000" />
                    <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continuar com Apple</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.createAccountButton}
              onPress={() => {
                if (isSignUpMode) {
                  resetToLoginMode();
                } else {
                  resetForgotPasswordState();
                  setIsSignUpMode(true);
                  setPendingEmailVerification(false);
                  setVerificationCode('');
                  setFullName('');
                  setPassword('');
                }
              }}
            >
              <Text style={styles.createAccountText}>
                {isSignUpMode
                  ? pendingEmailVerification
                    ? 'Usar outro e-mail'
                    : 'Já tem conta? Fazer login'
                  : 'Criar conta'}
              </Text>
            </TouchableOpacity>

                <Text style={styles.terms}>
                  Ao acessar ou criar a sua conta, você concorda com nossos{' '}
                  <Text style={styles.termsLink}>Termos e Condições Gerais</Text> e leu e aceitou a{' '}
                  <Text style={styles.termsLink}>Política de privacidade</Text>.
                </Text>
              </View>
            </View>
          </ScrollView>
        </ImageBackground>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LOGIN_CONTAINER_PURPLE,
  },
  keyboardView: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  overlay: {
    flexGrow: 1,
    backgroundColor: 'rgba(91, 58, 143, 0.85)',
    justifyContent: 'space-between',
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 100,
  },
  formContainer: {
    backgroundColor: LOGIN_CONTAINER_PURPLE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
  },
  infoText: {
    color: '#D7C5EE',
    fontSize: 14,
    marginBottom: 12,
  },
  inputWrapper: {
    marginBottom: 20,
    position: 'relative',
  },
  input: {
    backgroundColor: '#5B3A8F',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#7B5BA8',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 16,
  },
  button: {
    backgroundColor: '#D4A574',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  linkText: {
    color: '#fff',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#7B5BA8',
  },
  dividerText: {
    color: '#8E8E93',
    marginHorizontal: 10,
    fontSize: 14,
  },
  createAccountButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  createAccountText: {
    color: '#fff',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
  },
  socialButtonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButton: {
    backgroundColor: '#fff',
  },
  appleButtonText: {
    color: '#000',
  },
  terms: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
});
