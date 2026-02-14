import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

export class NegociacaoController {
  /**
   * Listar negociações
   */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        vendedorId,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      const user = req.user!;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {};

      if (status) where.status = status;
      if (vendedorId) where.vendedor_id = vendedorId;

      // Restrição de permissão: vendedores só veem suas próprias negociações
      if (user.role === 'VENDEDOR') {
        where.vendedor_id = user.id;
      }

      if (search) {
        where.OR = [
          {
            lead: {
              nome: { contains: search as string },
            },
          },
          {
            veiculo: {
              modelo: { contains: search as string },
            },
          },
        ];
      }

      const [negociacoes, total] = await Promise.all([
        prisma.negociacao.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy as string]: sortOrder },
          include: {
            lead: {
              select: {
                id: true,
                nome: true,
                email: true,
                whatsapp: true,
              },
            },
            veiculo: {
              select: {
                id: true,
                marca: true,
                modelo: true,
                ano_modelo: true,
                preco_venda: true,
                fotos: {
                  where: { ordem: 0 },
                  take: 1,
                  select: { url: true },
                },
              },
            },
            vendedor: {
              select: {
                id: true,
                nome: true,
                foto_url: true,
              },
            },
            _count: {
              select: {
                propostas: true,
                atividades: true,
              },
            },
          },
        }),
        prisma.negociacao.count({ where }),
      ]);

      return res.json({
        success: true,
        data: negociacoes,
        meta: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error('List negociacoes error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter negociações para Kanban
   */
  async getKanban(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      const where: any = {};

      // Restrição de permissão
      if (user.role === 'VENDEDOR') {
        where.vendedor_id = user.id;
      }

      const negociacoes = await prisma.negociacao.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        include: {
          lead: {
            select: {
              id: true,
              nome: true,
              email: true,
              whatsapp: true,
            },
          },
          veiculo: {
            select: {
              id: true,
              marca: true,
              modelo: true,
              ano_modelo: true,
              preco_venda: true,
              fotos: {
                where: { ordem: 0 },
                take: 1,
                select: { url: true },
              },
            },
          },
          vendedor: {
            select: {
              id: true,
              nome: true,
              foto_url: true,
            },
          },
          atividades: {
            orderBy: { data: 'desc' },
            take: 1,
          },
        },
      });

      // Agrupar por status
      const kanban = {
        PROSPECCAO: negociacoes.filter((n) => n.status === 'PROSPECCAO'),
        PROPOSTA_PREPARACAO: negociacoes.filter((n) => n.status === 'PROPOSTA_PREPARACAO'),
        PROPOSTA_ENVIADA: negociacoes.filter((n) => n.status === 'PROPOSTA_ENVIADA'),
        EM_NEGOCIACAO: negociacoes.filter((n) => n.status === 'EM_NEGOCIACAO'),
        FECHAMENTO_PENDENTE: negociacoes.filter((n) => n.status === 'FECHAMENTO_PENDENTE'),
        GANHO: negociacoes.filter((n) => n.status === 'GANHO'),
        PERDIDO: negociacoes.filter((n) => n.status === 'PERDIDO'),
      };

      return res.json({
        success: true,
        data: kanban,
      });
    } catch (error) {
      console.error('Get kanban error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter detalhes de uma negociação
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;

      const negociacao = await prisma.negociacao.findUnique({
        where: { id },
        include: {
          lead: {
            include: {
              atividades: {
                orderBy: { data: 'desc' },
                include: {
                  user: {
                    select: { nome: true, foto_url: true },
                  },
                },
              },
            },
          },
          veiculo: {
            include: {
              fotos: {
                orderBy: { ordem: 'asc' },
              },
            },
          },
          vendedor: {
            select: {
              id: true,
              nome: true,
              email: true,
              telefone: true,
              foto_url: true,
            },
          },
          propostas: {
            orderBy: { data: 'desc' },
          },
          atividades: {
            orderBy: { data: 'desc' },
            include: {
              user: {
                select: { nome: true, foto_url: true },
              },
            },
          },
          documentos: {
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!negociacao) {
        return res.status(404).json({ error: 'Negociação não encontrada' });
      }

      // Verificar permissão
      if (user.role === 'VENDEDOR' && negociacao.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      return res.json({
        success: true,
        data: negociacao,
      });
    } catch (error) {
      console.error('Get negociacao error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Criar negociação a partir de lead
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { lead_id, valor_proposta, valor_entrada, parcelas, valor_parcela } = req.body;

      if (!lead_id) {
        return res.status(400).json({ error: 'ID do lead é obrigatório' });
      }

      // Verificar se lead existe
      const lead = await prisma.lead.findUnique({
        where: { id: lead_id },
        include: { veiculo: true, negociacao: true },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
      }

      // Verificar se já existe negociação para este lead
      if (lead.negociacao) {
        return res.status(409).json({
          error: 'Já existe uma negociação para este lead',
          negociacaoId: lead.negociacao.id,
        });
      }

      // Verificar permissão
      if (user.role === 'VENDEDOR' && lead.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Criar negociação
      const negociacao = await prisma.negociacao.create({
        data: {
          lead_id,
          veiculo_id: lead.veiculo_id,
          vendedor_id: lead.vendedor_id || user.id,
          valor_proposta: valor_proposta ? Number(valor_proposta) : null,
          valor_entrada: valor_entrada ? Number(valor_entrada) : null,
          parcelas: parcelas ? Number(parcelas) : null,
          valor_parcela: valor_parcela ? Number(valor_parcela) : null,
          status: 'PROSPECCAO',
        },
        include: {
          lead: {
            select: {
              nome: true,
              email: true,
              whatsapp: true,
            },
          },
          veiculo: {
            select: {
              marca: true,
              modelo: true,
            },
          },
        },
      });

      // Atualizar status do lead
      await prisma.lead.update({
        where: { id: lead_id },
        data: { status: 'EM_ATENDIMENTO' },
      });

      // Criar atividade
      await prisma.atividade.create({
        data: {
          tipo: 'SISTEMA',
          descricao: 'Negociação criada',
          lead_id,
          negociacao_id: negociacao.id,
          user_id: user.id,
        },
      });

      return res.status(201).json({
        success: true,
        data: negociacao,
      });
    } catch (error) {
      console.error('Create negociacao error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Atualizar status da negociação
   */
  async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { status, motivo } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status é obrigatório' });
      }

      const negociacao = await prisma.negociacao.findUnique({
        where: { id },
        include: { lead: true, veiculo: true },
      });

      if (!negociacao) {
        return res.status(404).json({ error: 'Negociação não encontrada' });
      }

      // Verificar permissão
      if (user.role === 'VENDEDOR' && negociacao.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Atualizar negociação
      const negociacaoAtualizada = await prisma.negociacao.update({
        where: { id },
        data: { status },
      });

      // Se status for GANHO, atualizar lead e veículo
      if (status === 'GANHO') {
        await prisma.lead.update({
          where: { id: negociacao.lead_id },
          data: { status: 'CONVERTIDO' },
        });

        await prisma.veiculo.update({
          where: { id: negociacao.veiculo_id },
          data: {
            status: 'VENDIDO',
            data_venda: new Date(),
          },
        });
      }

      // Se status for PERDIDO, atualizar lead
      if (status === 'PERDIDO') {
        await prisma.lead.update({
          where: { id: negociacao.lead_id },
          data: { status: 'PERDIDO' },
        });
      }

      // Criar atividade
      await prisma.atividade.create({
        data: {
          tipo: 'STATUS',
          descricao: `Status da negociação alterado para: ${status}${motivo ? ` - Motivo: ${motivo}` : ''}`,
          lead_id: negociacao.lead_id,
          negociacao_id: id,
          user_id: user.id,
        },
      });

      return res.json({
        success: true,
        data: negociacaoAtualizada,
      });
    } catch (error) {
      console.error('Update status error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Adicionar proposta
   */
  async addProposta(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { valor, valor_entrada, parcelas, valor_parcela, validade, observacoes } = req.body;

      const negociacao = await prisma.negociacao.findUnique({
        where: { id },
      });

      if (!negociacao) {
        return res.status(404).json({ error: 'Negociação não encontrada' });
      }

      // Verificar permissão
      if (user.role === 'VENDEDOR' && negociacao.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const proposta = await prisma.proposta.create({
        data: {
          negociacao_id: id,
          valor: Number(valor),
          valor_entrada: valor_entrada ? Number(valor_entrada) : null,
          parcelas: parcelas ? Number(parcelas) : null,
          valor_parcela: valor_parcela ? Number(valor_parcela) : null,
          validade: validade ? new Date(validade) : null,
          observacoes,
          status: 'ENVIADA',
        },
      });

      // Atualizar valores da negociação
      await prisma.negociacao.update({
        where: { id },
        data: {
          valor_proposta: Number(valor),
          valor_entrada: valor_entrada ? Number(valor_entrada) : null,
          parcelas: parcelas ? Number(parcelas) : null,
          valor_parcela: valor_parcela ? Number(valor_parcela) : null,
          status: 'PROPOSTA_ENVIADA',
        },
      });

      // Criar atividade
      await prisma.atividade.create({
        data: {
          tipo: 'PROPOSTA',
          descricao: `Proposta de R$ ${Number(valor).toLocaleString('pt-BR')} enviada`,
          negociacao_id: id,
          user_id: user.id,
        },
      });

      return res.status(201).json({
        success: true,
        data: proposta,
      });
    } catch (error) {
      console.error('Add proposta error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Adicionar atividade
   */
  async addAtividade(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { tipo, descricao } = req.body;

      const negociacao = await prisma.negociacao.findUnique({
        where: { id },
      });

      if (!negociacao) {
        return res.status(404).json({ error: 'Negociação não encontrada' });
      }

      // Verificar permissão
      if (user.role === 'VENDEDOR' && negociacao.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const atividade = await prisma.atividade.create({
        data: {
          tipo,
          descricao,
          negociacao_id: id,
          user_id: user.id,
        },
        include: {
          user: {
            select: {
              nome: true,
              foto_url: true,
            },
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: atividade,
      });
    } catch (error) {
      console.error('Add atividade error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Adicionar documento
   */
  async addDocumento(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { nome, tipo, url } = req.body;

      const negociacao = await prisma.negociacao.findUnique({
        where: { id },
      });

      if (!negociacao) {
        return res.status(404).json({ error: 'Negociação não encontrada' });
      }

      // Verificar permissão
      if (user.role === 'VENDEDOR' && negociacao.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const documento = await prisma.documento.create({
        data: {
          negociacao_id: id,
          nome,
          tipo,
          url,
        },
      });

      return res.status(201).json({
        success: true,
        data: documento,
      });
    } catch (error) {
      console.error('Add documento error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

export const negociacaoController = new NegociacaoController();