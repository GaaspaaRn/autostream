import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, LeadFilters } from '../types';
import { matchingService } from '../services/matching.service';
import { addHours, isAfter } from 'date-fns';

export class LeadController {
  /**
   * Listar leads com filtros e paginação
   */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        dataInicio,
        dataFim,
        vendedorId,
        categoria,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      const user = req.user!;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Construir where clause
      const where: any = {};

      // Filtro por status
      if (status) {
        where.status = status;
      }

      // Filtro por data
      if (dataInicio || dataFim) {
        where.created_at = {};
        if (dataInicio) {
          where.created_at.gte = new Date(dataInicio as string);
        }
        if (dataFim) {
          where.created_at.lte = new Date(dataFim as string);
        }
      }

      // Filtro por vendedor
      if (vendedorId) {
        where.vendedor_id = vendedorId;
      }

      // Filtro por categoria (via veículo)
      if (categoria) {
        where.veiculo = {
          categoria: categoria,
        };
      }

      // Busca por nome, email ou telefone
      if (search) {
        where.OR = [
          { nome: { contains: search as string } },
          { email: { contains: search as string } },
          { whatsapp: { contains: search as string } },
        ];
      }

      // Restrição de permissão: vendedores só veem seus próprios leads
      if (user.role === 'VENDEDOR') {
        where.vendedor_id = user.id;
      }

      // Buscar leads
      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy as string]: sortOrder },
          include: {
            veiculo: {
              select: {
                id: true,
                marca: true,
                modelo: true,
                ano_modelo: true,
                preco_venda: true,
                categoria: true,
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
                nivel: true,
              },
            },
            negociacao: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        }),
        prisma.lead.count({ where }),
      ]);

      // Adicionar flag de urgência (lead novo há menos de 2h)
      const leadsComUrgencia = leads.map((lead) => ({
        ...lead,
        urgente: lead.status === 'NOVO' && isAfter(addHours(new Date(lead.created_at), 2), new Date()),
        slaVencendo: lead.status === 'NOVO' && isAfter(addHours(new Date(lead.created_at), 4), new Date()),
      }));

      return res.json({
        success: true,
        data: leadsComUrgencia,
        meta: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error('List leads error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter detalhes de um lead
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
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
              nivel: true,
            },
          },
          negociacao: {
            include: {
              propostas: {
                orderBy: { data: 'desc' },
              },
              documentos: true,
            },
          },
          atividades: {
            orderBy: { data: 'desc' },
            include: {
              user: {
                select: {
                  nome: true,
                  foto_url: true,
                },
              },
            },
          },
        },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
      }

      // Verificar permissão
      if (user.role === 'VENDEDOR' && lead.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      return res.json({
        success: true,
        data: lead,
      });
    } catch (error) {
      console.error('Get lead error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Criar novo lead (público, do site)
   */
  async create(req: Request, res: Response) {
    try {
      const {
        nome,
        email,
        whatsapp,
        tipo_negociacao,
        valor_entrada,
        prazo_meses,
        mensagem,
        preferencia_contato,
        veiculo_id,
        aceita_privacidade,
      } = req.body;

      // Validações
      if (!nome || nome.length < 3) {
        return res.status(400).json({ error: 'Nome é obrigatório (mínimo 3 caracteres)' });
      }

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Email inválido' });
      }

      if (!whatsapp || whatsapp.length < 10) {
        return res.status(400).json({ error: 'WhatsApp inválido' });
      }

      if (!veiculo_id) {
        return res.status(400).json({ error: 'Veículo de interesse é obrigatório' });
      }

      if (!aceita_privacidade) {
        return res.status(400).json({ error: 'É necessário aceitar a política de privacidade' });
      }

      // Verificar se veículo existe
      const veiculo = await prisma.veiculo.findUnique({
        where: { id: veiculo_id },
      });

      if (!veiculo) {
        return res.status(404).json({ error: 'Veículo não encontrado' });
      }

      // Verificar lead duplicado (mesmo email + whatsapp + veículo em menos de 24h)
      const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const leadExistente = await prisma.lead.findFirst({
        where: {
          email,
          whatsapp,
          veiculo_id,
          created_at: {
            gte: vinteQuatroHorasAtras,
          },
        },
      });

      if (leadExistente) {
        return res.status(409).json({
          error: 'Você já enviou uma proposta para este veículo nas últimas 24 horas',
          leadId: leadExistente.id,
        });
      }

      // Criar lead
      const lead = await prisma.lead.create({
        data: {
          nome,
          email,
          whatsapp,
          tipo_negociacao,
          valor_entrada: valor_entrada ? Number(valor_entrada) : null,
          prazo_meses: prazo_meses ? Number(prazo_meses) : null,
          mensagem,
          preferencia_contato: preferencia_contato || ['WHATSAPP'],
          veiculo_id,
          ip_origem: req.ip,
          user_agent: req.headers['user-agent'],
          status: 'NOVO',
        },
        include: {
          veiculo: {
            select: {
              marca: true,
              modelo: true,
            },
          },
        },
      });

      // Tentar atribuição automática
      const atribuicao = await matchingService.deveAtribuirAutomaticamente(veiculo_id);

      if (atribuicao.deveAtribuir && atribuicao.vendedorId) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            vendedor_id: atribuicao.vendedorId,
            atribuicao_tipo: 'SISTEMA',
            status: 'EM_ATENDIMENTO',
          },
        });

        // Criar atividade
        await prisma.atividade.create({
          data: {
            tipo: 'SISTEMA',
            descricao: `Lead atribuído automaticamente ao vendedor`,
            lead_id: lead.id,
            user_id: atribuicao.vendedorId,
          },
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Proposta enviada com sucesso! Nossa equipe entrará em contato em breve.',
        data: {
          id: lead.id,
          nome: lead.nome,
          veiculo: lead.veiculo,
          atribuidoAutomaticamente: atribuicao.deveAtribuir,
        },
      });
    } catch (error) {
      console.error('Create lead error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Atualizar lead
   */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { status, vendedor_id, mensagem } = req.body;

      // Verificar se lead existe
      const lead = await prisma.lead.findUnique({
        where: { id },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
      }

      // Verificar permissões
      if (user.role === 'VENDEDOR' && lead.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Atualizar lead
      const updateData: any = {};

      if (status) {
        updateData.status = status;
      }

      if (vendedor_id !== undefined) {
        updateData.vendedor_id = vendedor_id;
        updateData.atribuicao_tipo = 'MANUAL';
      }

      const leadAtualizado = await prisma.lead.update({
        where: { id },
        data: updateData,
        include: {
          veiculo: {
            select: {
              marca: true,
              modelo: true,
            },
          },
          vendedor: {
            select: {
              nome: true,
            },
          },
        },
      });

      // Criar atividade se houver mudança de status
      if (status) {
        await prisma.atividade.create({
          data: {
            tipo: 'STATUS',
            descricao: `Status alterado para: ${status}`,
            lead_id: id,
            user_id: user.id,
          },
        });
      }

      return res.json({
        success: true,
        data: leadAtualizado,
      });
    } catch (error) {
      console.error('Update lead error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Arquivar lead (soft delete)
   */
  async archive(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;

      const lead = await prisma.lead.findUnique({
        where: { id },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
      }

      // Verificar permissões
      if (user.role === 'VENDEDOR' && lead.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      await prisma.lead.update({
        where: { id },
        data: { status: 'ARQUIVADO' },
      });

      // Criar atividade
      await prisma.atividade.create({
        data: {
          tipo: 'SISTEMA',
          descricao: 'Lead arquivado',
          lead_id: id,
          user_id: user.id,
        },
      });

      return res.json({
        success: true,
        message: 'Lead arquivado com sucesso',
      });
    } catch (error) {
      console.error('Archive lead error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter recomendações de vendedores para um lead
   */
  async getRecomendacoes(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Verificar permissão (apenas admin e gerente)
      if (user.role === 'VENDEDOR') {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: { veiculo: true },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
      }

      const recomendacoes = await matchingService.getTopRecomendacoes(lead.veiculo_id, 3);

      return res.json({
        success: true,
        data: recomendacoes,
      });
    } catch (error) {
      console.error('Get recomendacoes error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Atribuir vendedor a um lead
   */
  async atribuirVendedor(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { vendedor_id } = req.body;

      // Verificar permissão (apenas admin e gerente podem atribuir)
      if (user.role === 'VENDEDOR') {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      if (!vendedor_id) {
        return res.status(400).json({ error: 'ID do vendedor é obrigatório' });
      }

      // Verificar se lead existe
      const lead = await prisma.lead.findUnique({
        where: { id },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
      }

      // Verificar se vendedor existe e está ativo
      const vendedor = await prisma.user.findFirst({
        where: {
          id: vendedor_id,
          role: 'VENDEDOR',
          status: 'ATIVO',
        },
      });

      if (!vendedor) {
        return res.status(404).json({ error: 'Vendedor não encontrado ou inativo' });
      }

      // Atualizar lead
      const leadAtualizado = await prisma.lead.update({
        where: { id },
        data: {
          vendedor_id,
          atribuicao_tipo: 'MANUAL',
          status: 'EM_ATENDIMENTO',
        },
        include: {
          veiculo: {
            select: {
              marca: true,
              modelo: true,
            },
          },
          vendedor: {
            select: {
              nome: true,
              email: true,
            },
          },
        },
      });

      // Criar atividade
      await prisma.atividade.create({
        data: {
          tipo: 'ATRIBUICAO',
          descricao: `Lead atribuído a ${vendedor.nome}`,
          lead_id: id,
          user_id: vendedor_id,
        },
      });

      return res.json({
        success: true,
        message: `Lead atribuído com sucesso a ${vendedor.nome}`,
        data: leadAtualizado,
      });
    } catch (error) {
      console.error('Atribuir vendedor error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Adicionar atividade a um lead
   */
  async addAtividade(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { tipo, descricao } = req.body;

      if (!tipo || !descricao) {
        return res.status(400).json({ error: 'Tipo e descrição são obrigatórios' });
      }

      const lead = await prisma.lead.findUnique({
        where: { id },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
      }

      // Verificar permissão
      if (user.role === 'VENDEDOR' && lead.vendedor_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const atividade = await prisma.atividade.create({
        data: {
          tipo,
          descricao,
          lead_id: id,
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
}

export const leadController = new LeadController();