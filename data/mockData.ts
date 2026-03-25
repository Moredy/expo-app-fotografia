// Dados mockados para Vitória Lima Fotografia

export interface Evento {
  id: string;
  titulo: string;
  local: string;
  data: string;
  dataRelativa: string;
  imagem: any;
  totalFotos: number;
  favorito: boolean;
}

export interface FotoEvento {
  id: string;
  url: any;
  comprada: boolean;
  selecionada: boolean;
}

export interface ClubInfo {
  titulo: string;
  descricao: string;
  preco: number;
  mensalidade: string;
  beneficios: string[];
}

export interface FotoComprada {
  id: string;
  url: any;
  eventoId: string;
  eventoNome: string;
  dataCompra: string;
}

export const eventos: Evento[] = [
  {
    id: '1',
    titulo: 'CSI-W Indoor 2025',
    local: 'Sociedade Hípica Paulista',
    data: '24/08/2025',
    dataRelativa: '24 de ago.',
    imagem: require('../assets/fotos-mock/1.jpg'),
    totalFotos: 45,
    favorito: true,
  },
  {
    id: '2',
    titulo: 'Copa São Paulo de Hipismo',
    local: 'Hípica Santo Amaro',
    data: '15/09/2025',
    dataRelativa: '15 de set.',
    imagem: require('../assets/fotos-mock/3.jpeg'),
    totalFotos: 67,
    favorito: false,
  },
  {
    id: '3',
    titulo: 'Campeonato Brasileiro Indoor',
    local: 'Jockey Club São Paulo',
    data: '10/10/2025',
    dataRelativa: '10 de out.',
    imagem: require('../assets/fotos-mock/5.jpeg'),
    totalFotos: 89,
    favorito: true,
  },
];

export const fotosEvento: FotoEvento[] = [
  {
    id: '1',
    url: require('../assets/fotos-mock/1.jpg'),
    comprada: true,
    selecionada: false,
  },
  {
    id: '2',
    url: require('../assets/fotos-mock/2.jpeg'),
    comprada: true,
    selecionada: false,
  },
  {
    id: '3',
    url: require('../assets/fotos-mock/3.jpeg'),
    comprada: true,
    selecionada: false,
  },
  {
    id: '4',
    url: require('../assets/fotos-mock/4.jpg'),
    comprada: false,
    selecionada: false,
  },
  {
    id: '5',
    url: require('../assets/fotos-mock/5.jpeg'),
    comprada: true,
    selecionada: false,
  },
  {
    id: '6',
    url: require('../assets/fotos-mock/6.jpeg'),
    comprada: false,
    selecionada: false,
  },
  {
    id: '7',
    url: require('../assets/fotos-mock/7.jpg'),
    comprada: true,
    selecionada: false,
  },
  {
    id: '8',
    url: require('../assets/fotos-mock/8.jpeg'),
    comprada: false,
    selecionada: false,
  },
];

export const fotosFavoritas: any[] = [
  require('../assets/fotos-mock/1.jpg'),
  require('../assets/fotos-mock/3.jpeg'),
  require('../assets/fotos-mock/5.jpeg'),
];

export const clubInfo: ClubInfo = {
  titulo: 'VL Club',
  descricao: 'Faça parte do VL Club e tenha acesso exclusivo à todos os nossos conteúdos!',  
  preco: 296.00,
  mensalidade: 'por mês',
  beneficios: [
    'Acesso a todas as fotos dos eventos',
    'Download ilimitado em alta resolução',
    'Prioridade na compra de impressões',
    'Desconto em produtos personalizados',
    'Suporte prioritário',
  ],
};

export const fotosCompradas: FotoComprada[] = [
  {
    id: '1',
    url: require('../assets/fotos-mock/1.jpg'),
    eventoId: '1',
    eventoNome: 'CSI-W Indoor 2025',
    dataCompra: '2026-03-10',
  },
  {
    id: '2',
    url: require('../assets/fotos-mock/2.jpeg'),
    eventoId: '1',
    eventoNome: 'CSI-W Indoor 2025',
    dataCompra: '2026-03-10',
  },
  {
    id: '3',
    url: require('../assets/fotos-mock/3.jpeg'),
    eventoId: '1',
    eventoNome: 'CSI-W Indoor 2025',
    dataCompra: '2026-03-10',
  },
  {
    id: '5',
    url: require('../assets/fotos-mock/5.jpeg'),
    eventoId: '2',
    eventoNome: 'Copa São Paulo de Hipismo',
    dataCompra: '2026-03-08',
  },
  {
    id: '7',
    url: require('../assets/fotos-mock/7.jpg'),
    eventoId: '3',
    eventoNome: 'Campeonato Brasileiro Indoor',
    dataCompra: '2026-03-05',
  },
];
