export interface User {
  id: string;
  email: string;
  nome: string;
  telefone: string;
  foto_url?: string;
  role: 'ADMIN' | 'GERENTE' | 'VENDEDOR';
  nivel?: 'JUNIOR' | 'PLENO' | 'SENIOR';
  status: 'ATIVO' | 'FERIAS' | 'INATIVO';
  especialidades: string[];
  meta_mensal_unidades: number;
  meta_mensal_valor: number;
  capacidade_max_leads: number;
  regras_atribuicao?: {
    valor_minimo?: number;
    valor_maximo?: number;
    categorias_permitidas: string[];
    prioridade: number;
  };
}

export interface Lead {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  tipo_negociacao: 'AVISTA' | 'PARCELADO' | 'ENTRADA_PARCELAS';
  valor_entrada?: number;
  prazo_meses?: number;
  mensagem?: string;
  preferencia_contato: string[];
  status: 'NOVO' | 'EM_ATENDIMENTO' | 'PROPOSTA_ENVIADA' | 'NEGOCIANDO' | 'CONVERTIDO' | 'PERDIDO' | 'ARQUIVADO';
  veiculo_id: string;
  veiculo: {
    id: string;
    marca: string;
    modelo: string;
    ano_modelo: number;
    preco_venda: number;
    categoria: string;
    fotos: { url: string }[];
  };
  vendedor_id?: string;
  vendedor?: {
    id: string;
    nome: string;
    foto_url?: string;
    nivel?: string;
  };
  atribuicao_tipo: 'SISTEMA' | 'MANUAL' | 'REATRIBUICAO';
  created_at: string;
  updated_at: string;
  urgente?: boolean;
  slaVencendo?: boolean;
}

export interface Veiculo {
  id: string;
  codigo_interno: string;
  slug: string;
  status: 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'MANUTENCAO';
  destaque: boolean;
  categoria: string;
  marca: string;
  modelo: string;
  versao: string;
  ano_fabricacao: number;
  ano_modelo: number;
  cor: string;
  motor: string;
  combustivel: string;
  transmissao: string;
  tracao: string;
  portas: number;
  lugares: number;
  quilometragem: number;
  preco_venda: number;
  preco_custo?: number;
  preco_minimo?: number;
  fotos: { url: string; principal?: boolean }[];
  descricao: string;
  opcionais: string[];
}

export interface Negociacao {
  id: string;
  status: string;
  valor_proposta?: number;
  valor_entrada?: number;
  parcelas?: number;
  valor_parcela?: number;
  lead_id: string;
  lead: {
    id: string;
    nome: string;
    email: string;
    whatsapp: string;
  };
  veiculo_id: string;
  veiculo: {
    id: string;
    marca: string;
    modelo: string;
    ano_modelo: number;
    preco_venda: number;
    fotos: { url: string }[];
  };
  vendedor_id: string;
  vendedor: {
    id: string;
    nome: string;
    foto_url?: string;
  };
  propostas: Proposta[];
  atividades: Atividade[];
  created_at: string;
  updated_at: string;
}

export interface Proposta {
  id: string;
  valor: number;
  valor_entrada?: number;
  parcelas?: number;
  valor_parcela?: number;
  status: string;
  observacoes?: string;
  created_at: string;
  validade?: string;
}

export interface Atividade {
  id: string;
  tipo: string;
  descricao: string;
  vendedor?: {
    nome: string;
    foto_url?: string;
  };
  created_at: string;
}

export interface DashboardMetrics {
  leads: {
    hoje: number;
    ontem: number;
    variacaoDia: number;
    mes: number;
    mesAnterior: number;
    variacaoMes: number;
    naoAtribuidos: number;
    meta: number;
    progressoMeta: number;
  };
  conversao: {
    taxa: number;
    convertidosMes: number;
    totalLeadsMes: number;
  };
  veiculos: {
    estoque: number;
    vendidosMes: number;
  };
  faturamento: {
    mes: number;
  };
  negociacoes: Record<string, number>;
}

export interface VendedorScore {
  vendedor: User;
  score: number;
  detalhes: {
    categoriaMatch: number;
    valorMatch: number;
    nivelMatch: number;
    cargaMatch: number;
    desempenhoMatch: number;
  };
  motivos: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}