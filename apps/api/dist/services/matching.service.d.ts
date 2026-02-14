import { VendedorScore } from '../types';
export declare class MatchingService {
    /**
     * Calcula o score de compatibilidade para cada vendedor disponível
     */
    calcularScores(veiculoId: string): Promise<VendedorScore[]>;
    /**
     * Calcula o score individual de um vendedor
     */
    private calcularScoreVendedor;
    /**
     * Calcula match de categoria (30%)
     */
    private calcularCategoriaMatch;
    /**
     * Calcula match de valor (25%)
     */
    private calcularValorMatch;
    /**
     * Calcula match de nível (20%)
     */
    private calcularNivelMatch;
    /**
     * Calcula match de carga de trabalho (15%)
     */
    private calcularCargaMatch;
    /**
     * Calcula match de desempenho (10%)
     */
    private calcularDesempenhoMatch;
    /**
     * Retorna os top 3 vendedores recomendados
     */
    getTopRecomendacoes(veiculoId: string, limit?: number): Promise<VendedorScore[]>;
    /**
     * Verifica se deve fazer atribuição automática
     */
    deveAtribuirAutomaticamente(veiculoId: string): Promise<{
        deveAtribuir: boolean;
        vendedorId?: string;
    }>;
}
export declare const matchingService: MatchingService;
