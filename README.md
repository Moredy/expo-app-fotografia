# Vitória Lima Fotografia

Aplicativo React Native criado com Expo para visualização e compra de fotos de eventos hípicos.

## 📱 Funcionalidades

- ✅ **Autenticação com Clerk**: Sistema de login e cadastro seguro com verificação de email
- ✅ **Home**: Exibição de eventos recentes e fotos favoritas
- ✅ **Eventos**: Lista completa de eventos hípicos
- ✅ **Detalhes do Evento**: Galeria de fotos com opção de seleção e compra
- ✅ **VL Club**: Tela de assinatura premium com benefícios
- ✅ **Carrinho**: Gerenciamento de fotos selecionadas
- ✅ **Menu/Perfil**: Configurações e informações do usuário
- ✅ **Navegação por Tabs**: Interface intuitiva com Bottom Navigation

## 🎨 Design

- Tema roxo elegante (#5B3A8F)
- Cores douradas (#D4A574) para destaques
- Imagens de alta qualidade de eventos hípicos
- Interface responsiva e animada

## 🚀 Como Executar

### Pré-requisitos

- Node.js instalado
- npm ou yarn
- Expo Go instalado no seu celular (iOS ou Android)

### Instalação

As dependências já foram instaladas. Se precisar reinstalar:

```bash
npm install --legacy-peer-deps
```

### Configuração do Clerk

1. Crie uma conta em [https://clerk.com](https://clerk.com)
2. Crie um novo aplicativo no dashboard do Clerk
3. Copie a chave publicável (Publishable Key)
4. O arquivo `.env` já está configurado com a chave:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhwZXJ0LXNoYXJrLTExLmNsZXJrLmFjY291bnRzLmRldiQ
```

5. Configure as opções de autenticação no dashboard do Clerk:
   - Ative **Email** como método de autenticação
   - Configure a verificação de email se desejar
   - Personalize os templates de email (opcional)

### Executar

```bash
npm start
```

Depois escaneie o QR code com o **Expo Go**:
- **Android**: Abra o Expo Go e escaneie o QR code
- **iOS**: Use a câmera nativa do iPhone para escanear

Ou pressione:
- **`a`** - Abrir no emulador Android
- **`i`** - Abrir no simulador iOS (apenas Mac)
- **`w`** - Abrir no navegador web

## 🔐 Autenticação com Clerk

O aplicativo usa **Clerk** para autenticação segura. Você pode:

### Fazer Login
1. Digite seu email e senha
2. Clique em "Continuar"

### Criar Conta
1. Clique em "Criar conta"
2. Digite seu email e senha
3. Um código de verificação será enviado para o seu email (se a verificação estiver ativada)
4. Verifique sua conta e faça login

### Funcionalidades do Clerk
- ✅ Autenticação segura com hash de senha
- ✅ Verificação de email
- ✅ Gerenciamento de sessões
- ✅ Token cache seguro com Expo SecureStore
- ✅ Proteção contra força bruta

## 📂 Estrutura do Projeto

```
vitoria-lima-fotografia/
├── contexts/
│   └── AuthContext.js              # Contexto de autenticação
├── data/
│   └── mockData.js                 # Dados mockados (eventos, fotos, clube)
├── navigation/
│   └── index.js                    # Configuração de navegação (Stack + Tabs)
├── screens/
│   ├── LoginScreen.js              # Tela de login
│   ├── HomeScreen.js               # Tela inicial com eventos e favoritos
│   ├── EventosScreen.js            # Lista completa de eventos
│   ├── EventoDetalhesScreen.js     # Galeria de fotos do evento
│   ├── ClubScreen.js               # Assinatura VL Club
│   ├── CarrinhoScreen.js           # Carrinho de compras
│   ├── MenuScreen.js               # Menu e perfil
│   └── ProfileScreen.js            # Detalhes do perfil
├── App.js                          # Componente raiz
└── package.json                    # Dependências
```

## 🛠️ Tecnologias

- **React Native** - Framework mobile
- **Expo SDK 54** - Plataforma de desenvolvimento
- **React Navigation 6** - Navegação (Stack + Bottom Tabs)
- **React Context API** - Gerenciamento de estado
- **Clerk** - Autenticação e gerenciamento de usuários
- **Expo SecureStore** - Armazenamento seguro de tokens
- **Expo Vector Icons** - Ícones do Ionicons

## 🎯 Funcionalidades Principais

### Navegação

O app usa navegação híbrida:
- **Stack Navigator**: Para telas modais e de detalhes
- **Bottom Tab Navigator**: Para navegação principal (4 tabs)

```
Tabs:
├── Início (Home)
├── Eventos
├── Carrinho
└── Menu
```

### Telas Protegidas

Todas as telas principais requerem autenticação. Usuários não autenticados veem apenas a tela de login.

### Galeria de Fotos

- Visualização em grid (3 colunas)
- Modo de seleção múltipla
- Marcação de fotos já compradas
- Adição ao carrinho

## 💡 Próximos Passos

Para um app em produção, considere adicionar:

- [ ] Integração com API real (backend)
- [ ] Processamento de pagamentos (Stripe, MercadoPago)
- [ ] Upload de fotos por fotógrafos
- [ ] Sistema de notificações
- [ ] Compartilhamento social
- [ ] Filtros e busca avançada
- [ ] Cache de imagens
- [ ] Modo offline
- [ ] Deep linking
- [ ] Analytics

## 📝 Notas de Desenvolvimento

- As imagens usam Unsplash como placeholder
- A autenticação é simulada - qualquer credencial funciona
- Os dados são mockados no arquivo `data/mockData.js`
- O tema escuro é aplicado em todas as telas
- A navegação respeita as guidelines do iOS e Android

## 🎨 Paleta de Cores

- **Fundo Principal**: `#5B3A8F` (Roxo)
- **Fundo Secundário**: `#4A2F73` (Roxo escuro)
- **Fundo Terciário**: `#3A2259` (Roxo mais escuro)
- **Destaque**: `#D4A574` (Dourado)
- **Texto Principal**: `#FFFFFF` (Branco)
- **Texto Secundário**: `#B8A0D4` (Roxo claro)
- **Perigo**: `#FF3B30` (Vermelho)
- **Sucesso**: `#8BC34A` (Verde)

## 📱 Compatibilidade

- **Expo SDK**: 54
- **React**: 19.1.0
- **React Native**: 0.81.5
- **iOS**: 13.0+
- **Android**: 5.0+ (API 21+)

---

Desenvolvido por Vitória Lima Fotografia
