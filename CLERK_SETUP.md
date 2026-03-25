# Configuração do Clerk

## Status Atual
✅ Clerk instalado  
✅ ClerkProvider configurado  
✅ Token cache configurado  
✅ Chave publicável configurada

## Configurações Necessárias no Dashboard do Clerk

Para que o cadastro funcione corretamente, você precisa configurar o Clerk:

### 1. Acesse o Dashboard
Vá para [https://dashboard.clerk.com](https://dashboard.clerk.com)

### 2. Configure a Autenticação por Email/Senha

1. No menu lateral, clique em **"Configure"** → **"Email & SMS"**
2. Ative **"Email address"** se não estiver ativo
3. Em **"Authentication strategies"**, certifique-se de que **"Password"** está ativado

### 3. Configure Sign Up

1. Vá em **"Configure"** → **"Settings"** → **"Sign-up and sign-in"**
2. Em **"Sign-up"**, verifique:
   - ✅ **Email address** está habilitado como método de sign-up
   - ✅ **Password** está habilitado
3. Em **"Verification"**:
   - Você pode escolher se deseja **verificação obrigatória** ou não
   - Se ativar verificação, um código será enviado por email

### 4. Teste no Modo Development

- Por padrão, o Clerk funciona em modo **Development**
- Você pode usar qualquer email para teste
- Se a verificação estiver ativada, o código aparecerá nos logs

### 5. Emails Reais (Produção)

Para enviar emails reais:
1. Vá em **"Configure"** → **"Email, SMS"**
2. Configure um provedor de email (Clerk tem providers gratuitos)

## Testando o Cadastro

### Passo 1: Abra o Console
Execute o app com:
```bash
npm start
```

### Passo 2: Verifique os Logs
Olhe o console para mensagens como:
- `"Alternando modo. Atual: false -> Novo: true"` (quando clicar em "Criar conta")
- `"handleSubmit chamado, isSignUpMode: true"` (quando clicar no botão principal)
- `"handleSignUp iniciado"`
- `"Criando conta com email: ..."`
- `"Conta criada, status: ..."`

### Passo 3: Teste o Cadastro
1. Clique em **"Criar conta"** (botão inferior)
2. Digite um email válido (ex: `teste@exemplo.com`)
3. Digite uma senha com pelo menos 8 caracteres
4. Clique em **"Criar Conta"** (botão principal laranja)

### Possíveis Erros

**"Sistema de cadastro não está pronto"**
- O Clerk ainda está carregando
- Espere 2-3 segundos e tente novamente

**"A senha deve ter pelo menos 8 caracteres"**
- Use uma senha mais longa

**"Email address already exists"**
- Este email já foi cadastrado
- Use outro email ou faça login

**Erros de Configuração**
- Verifique se a chave do Clerk está correta no `.env`
- Reinicie o app: pressione `r` no terminal do Expo

## Debug

### Ver logs completos
Abra as DevTools do navegador (se estiver rodando no web) ou use o console do terminal.

### Verificar se Clerk está carregado
Os logs mostrarão `"signUpLoaded: true/false"`

### Verificar dashboard do Clerk
Vá em **"Users"** no dashboard para ver se o usuário foi criado

## Próximos Passos

Após criar uma conta com sucesso:
1. A conta aparecerá no dashboard do Clerk em **"Users"**
2. Você pode fazer login com as credenciais criadas
3. O perfil do usuário será sincronizado automaticamente

## Suporte

Se continuar tendo problemas:
1. Verifique se está usando a chave correta no `.env`
2. Reinicie o servidor Expo
3. Limpe o cache: `npx expo start -c`
4. Verifique os logs do console para erros específicos
