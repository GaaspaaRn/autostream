import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class VeiculoController {
    /**
     * Listar veículos (público - catálogo)
     */
    listPublic(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter detalhes de um veículo (público)
     */
    getBySlug(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Listar veículos (admin)
     */
    listAdmin(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter detalhes de um veículo (admin)
     */
    getById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Criar veículo
     */
    create(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Atualizar veículo
     */
    update(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Arquivar veículo
     */
    archive(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter marcas disponíveis
     */
    getMarcas(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter faixas de preço
     */
    getFaixaPrecos(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obter veículos em destaque
     */
    getDestaques(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const veiculoController: VeiculoController;
