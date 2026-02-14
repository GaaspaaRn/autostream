import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload } from '../types';
export declare const authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const authorize: (...roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const generateTokens: (payload: JwtPayload) => {
    accessToken: string;
    refreshToken: string;
};
