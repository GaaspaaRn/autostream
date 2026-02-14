import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class LeadController {
    /**
     * Listar leads com filtros e paginação
     */
    list(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter detalhes de um lead
     */
    getById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Criar novo lead (público, do site)
     */
    create(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Atualizar lead
     */
    update(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Arquivar lead (soft delete)
     */
    archive(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter recomendações de vendedores para um lead
     */
    getRecomendacoes(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Atribuir vendedor a um lead
     */
    atribuirVendedor(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Adicionar atividade a um lead
     */
    addAtividade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const leadController: LeadController;
