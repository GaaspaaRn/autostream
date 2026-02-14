import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class DashboardController {
    /**
     * Obter métricas principais do dashboard
     */
    getMetricas(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter dados do funil de vendas
     */
    getFunil(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter leads por dia (últimos 30 dias)
     */
    getLeadsPorDia(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter ranking de vendedores
     */
    getRankingVendedores(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter distribuição por categoria
     */
    getDistribuicaoCategoria(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter leads que requerem atenção
     */
    getLeadsAtencao(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const dashboardController: DashboardController;
