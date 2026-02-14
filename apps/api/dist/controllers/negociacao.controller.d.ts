import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class NegociacaoController {
    /**
     * Listar negociações
     */
    list(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter negociações para Kanban
     */
    getKanban(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter detalhes de uma negociação
     */
    getById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Criar negociação a partir de lead
     */
    create(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Atualizar status da negociação
     */
    updateStatus(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Adicionar proposta
     */
    addProposta(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Adicionar atividade
     */
    addAtividade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Adicionar documento
     */
    addDocumento(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const negociacaoController: NegociacaoController;
