import { Request } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        nome: string;
    };
}
export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    nome: string;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
}
export interface LeadFilters {
    status?: string;
    dataInicio?: string;
    dataFim?: string;
    origem?: string;
    vendedorId?: string;
    categoria?: string;
    search?: string;
}
export interface VeiculoFilters {
    categoria?: string;
    marca?: string;
    modelo?: string;
    anoMin?: number;
    anoMax?: number;
    precoMin?: number;
    precoMax?: number;
    kmMin?: number;
    kmMax?: number;
    combustivel?: string;
    transmissao?: string;
    cor?: string;
    status?: string;
    destaque?: boolean;
}
export interface MatchingInput {
    lead: {
        veiculo_interesse_id: string;
        tipo_negociacao: string;
        valor_entrada?: number;
        prazo_meses?: number;
    };
    veiculo: {
        categoria: string;
        preco_venda: number;
        marca: string;
    };
    vendedores: any[];
}
export interface VendedorScore {
    vendedor: any;
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
