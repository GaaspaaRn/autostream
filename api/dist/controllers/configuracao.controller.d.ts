import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class ConfiguracaoController {
    /**
     * Listar todas as configurações
     */
    list(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter configuração por chave
     */
    getByChave(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Criar ou atualizar configuração
     */
    upsert(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Atualizar múltiplas configurações
     */
    bulkUpdate(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Deletar configuração
     */
    delete(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter configurações públicas (para o site)
     */
    getPublic(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const configuracaoController: ConfiguracaoController;
