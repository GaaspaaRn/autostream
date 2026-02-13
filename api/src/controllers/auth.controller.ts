import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-change-in-production';

// Helper to parse/stringify fields
const parseUserFields = (user: any) => {
  if (!user) return null;
  return {
    ...user,
    especialidades: user.especialidades ? JSON.parse(user.especialidades) : [],
    regras_atribuicao: user.regras_atribuicao ? JSON.parse(user.regras_atribuicao) : null,
  };
};

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      // Buscar usuário
      const userRaw = await prisma.user.findUnique({
        where: { email },
      });

      if (!userRaw) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      // Verificar se usuário está ativo
      if (userRaw.status !== 'ATIVO') {
        return res.status(401).json({ error: 'Usuário inativo ou em férias' });
      }

      // Verificar senha
      const isValidPassword = await bcrypt.compare(password, userRaw.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const user = parseUserFields(userRaw);

      // Gerar tokens
      const accessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          nome: user.nome,
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        REFRESH_SECRET,
        { expiresIn: rememberMe ? '30d' : '7d' }
      );

      // Retornar dados do usuário e tokens
      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            nome: user.nome,
            telefone: user.telefone,
            foto_url: user.foto_url,
            role: user.role,
            nivel: user.nivel,
            // Add parsed fields if needed in frontend login response, usually yes
            especialidades: user.especialidades,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token não fornecido' });
      }

      // Verificar refresh token
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string };

      // Buscar usuário
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.status !== 'ATIVO') {
        return res.status(401).json({ error: 'Usuário inválido ou inativo' });
      }

      // Gerar novo access token
      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          nome: user.nome,
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      return res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
        },
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Refresh token expirado' });
      }
      return res.status(401).json({ error: 'Token inválido' });
    }
  }

  async logout(req: Request, res: Response) {
    // Em uma implementação mais completa, invalidaríamos o token no banco
    // Por enquanto, apenas retornamos sucesso
    return res.json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  }

  async me(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          nome: true,
          telefone: true,
          foto_url: true,
          role: true,
          nivel: true,
          status: true,
          especialidades: true,
          meta_mensal_unidades: true,
          meta_mensal_valor: true,
          capacidade_max_leads: true,
          regras_atribuicao: true,
          created_at: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      return res.json({
        success: true,
        data: parseUserFields(user),
      });
    } catch (error) {
      console.error('Me error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
      }

      // Buscar usuário com senha
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Verificar senha atual
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isValid) {
        return res.status(400).json({ error: 'Senha atual incorreta' });
      }

      // Hash nova senha
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Atualizar senha
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password_hash: newPasswordHash },
      });

      return res.json({
        success: true,
        message: 'Senha alterada com sucesso',
      });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

export const authController = new AuthController();