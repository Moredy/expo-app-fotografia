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
import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const { signIn, isLoading } = useAuth();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuth } = useOAuth({ strategy: 'oauth_apple' });

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        Alert.alert('Erro', result.error || 'Falha ao fazer login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (): Promise<void> => {
    console.log('handleSignUp iniciado');
    
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (!signUpLoaded) {
      Alert.alert('Erro', 'Sistema de cadastro não está pronto. Aguarde alguns segundos e tente novamente.');
      console.log('signUpLoaded:', signUpLoaded);
      return;
    }

    setLoading(true);
    try {
      console.log('Criando conta com email:', email);
      
      // Criar conta com Clerk
      const result = await signUp.create({
        emailAddress: email,
        password,
      });

      console.log('Conta criada, status:', result.status);

      // Se a conta foi criada com sucesso
      if (result.status === 'complete' || result.status === 'missing_requirements') {
        // Tentar preparar verificação de email
        try {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          
          Alert.alert(
            'Verificação necessária',
            'Um código de verificação foi enviado para seu e-mail. Por favor, verifique sua conta no painel do Clerk.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setIsSignUpMode(false);
                  setEmail('');
                  setPassword('');
                },
              },
            ]
          );
        } catch (verifyError) {
          // Se a verificação não for obrigatória
          Alert.alert(
            'Conta criada!',
            'Sua conta foi criada com sucesso. Você já pode fazer login.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setIsSignUpMode(false);
                },
              },
            ]
          );
        }
      }
    } catch (error: any) {
      console.error('Erro ao criar conta:', error);
      console.error('Erro completo:', JSON.stringify(error, null, 2));
      
      let errorMessage = 'Erro ao criar conta. Tente novamente.';
      
      if (error?.errors && error.errors.length > 0) {
        errorMessage = error.errors[0].message || error.errors[0].longMessage || errorMessage;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    console.log('handleSubmit chamado, isSignUpMode:', isSignUpMode);
    if (isSignUpMode) {
      await handleSignUp();
    } else {
      await handleLogin();
    }
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    try {
      const { createdSessionId, setActive } = await startGoogleOAuth({
        redirectUrl: Linking.createURL('/'),
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
        redirectUrl: Linking.createURL('/'),
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
                <Text style={styles.title}>{isSignUpMode ? 'Criar Conta' : 'Login'}</Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading && !isLoading}
              />
            </View>

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

            <TouchableOpacity
              style={[styles.button, (loading || isLoading) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || isLoading}
            >
              {(loading || isLoading) ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>{isSignUpMode ? 'Criar Conta' : 'Continuar'}</Text>
              )}
            </TouchableOpacity>

            {!isSignUpMode && (
              <TouchableOpacity style={styles.linkButton}>
                <Text style={styles.linkText}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            )}

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

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.createAccountButton}
              onPress={() => {
                console.log('Alternando modo. Atual:', isSignUpMode, '-> Novo:', !isSignUpMode);
                setIsSignUpMode(!isSignUpMode);
                setEmail('');
                setPassword('');
              }}
            >
              <Text style={styles.createAccountText}>
                {isSignUpMode ? 'Já tem conta? Fazer login' : 'Criar conta'}
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
    backgroundColor: '#2B174B',
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
    backgroundColor: '#4A2F73',
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
