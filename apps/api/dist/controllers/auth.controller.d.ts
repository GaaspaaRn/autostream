import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class AuthController {
    login(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    refresh(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    logout(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    me(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    changePassword(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const authController: AuthController;
