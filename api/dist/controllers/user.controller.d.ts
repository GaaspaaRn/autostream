import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class UserController {
    /**
     * Listar usuários
     */
    list(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter detalhes de um usuário
     */
    getById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Criar usuário (apenas admin)
     */
    create(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Atualizar usuário
     */
    update(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Desativar usuário
     */
    deactivate(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter performance do vendedor
     */
    getPerformance(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter leads atuais do vendedor
     */
    getLeadsAtuais(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const userController: UserController;
