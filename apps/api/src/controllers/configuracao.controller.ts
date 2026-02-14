import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

export class ConfiguracaoController {
  /**
   * Listar todas as configurações
   */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const configuracoes = await prisma.configuracao.findMany({
        orderBy: { chave: 'asc' },
      });

      return res.json({
        success: true,
        data: configuracoes,
      });
    } catch (error) {
      console.error('List configuracoes error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter configuração por chave
   */
  async getByChave(req: Request, res: Response) {
    try {
      const { chave } = req.params;

      const configuracao = await prisma.configuracao.findUnique({
        where: { chave },
      });

      if (!configuracao) {
        return res.status(404).json({ error: 'Configuração não encontrada' });
      }

      return res.json({
        success: true,
        data: configuracao,
      });
    } catch (error) {
      console.error('Get configuracao error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Criar ou atualizar configuração
   */
  async upsert(req: AuthenticatedRequest, res: Response) {
    try {
      const { chave, valor, descricao } = req.body;

      if (!chave || valor === undefined) {
        return res.status(400).json({ error: 'Chave e valor são obrigatórios' });
      }

      const configuracao = await prisma.configuracao.upsert({
        where: { chave },
        update: {
          valor: String(valor),
          descricao,
        },
        create: {
          chave,
          valor: String(valor),
          descricao,
        },
      });

      return res.json({
        success: true,
        data: configuracao,
      });
    } catch (error) {
      console.error('Upsert configuracao error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Atualizar múltiplas configurações
   */
  async bulkUpdate(req: AuthenticatedRequest, res: Response) {
    try {
      const { configuracoes } = req.body;

      if (!Array.isArray(configuracoes)) {
        return res.status(400).json({ error: 'Configurações devem ser um array' });
      }

      const resultados = await Promise.all(
        configuracoes.map(async (config) => {
          return prisma.configuracao.upsert({
            where: { chave: config.chave },
            update: {
              valor: String(config.valor),
              descricao: config.descricao,
            },
            create: {
              chave: config.chave,
              valor: String(config.valor),
              descricao: config.descricao,
            },
          });
        })
      );

      return res.json({
        success: true,
        data: resultados,
      });
    } catch (error) {
      console.error('Bulk update configuracoes error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Deletar configuração
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { chave } = req.params;

      await prisma.configuracao.delete({
        where: { chave },
      });

      return res.json({
        success: true,
        message: 'Configuração removida com sucesso',
      });
    } catch (error) {
      console.error('Delete configuracao error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter configurações públicas (para o site)
   */
  async getPublic(req: Request, res: Response) {
    try {
      const configuracoes = await prisma.configuracao.findMany({
        where: {
          chave: {
            in: [
              'nome_revenda',
              'telefone_revenda',
              'whatsapp_revenda',
              'email_revenda',
              'endereco_revenda',
            ],
          },
        },
      });

      const configMap = configuracoes.reduce((acc, config) => {
        acc[config.chave] = config.valor;
        return acc;
      }, {} as Record<string, string>);

      return res.json({
        success: true,
        data: configMap,
      });
    } catch (error) {
      console.error('Get public configuracoes error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

export const configuracaoController = new ConfiguracaoController();