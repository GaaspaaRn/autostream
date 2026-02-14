import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

// Helper to parse/stringify fields
const parseUserFields = (user: any) => {
  if (!user) return null;
  return {
    ...user,
    especialidades: user.especialidades ? JSON.parse(user.especialidades) : [],
    regras_atribuicao: user.regras_atribuicao ? JSON.parse(user.regras_atribuicao) : null,
  };
};

export class UserController {
  /**
   * Listar usuários
   */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        status,
        search,
        sortBy = 'nome',
        sortOrder = 'asc',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {};

      if (role) where.role = role as string;
      if (status) where.status = status as string;

      if (search) {
        where.OR = [
          { nome: { contains: search as string } }, // SQLite doesn't support mode: 'insensitive' easily, removing it or using raw query if needed. Prisma emulates it? Let's try default.
          { email: { contains: search as string } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy as string]: sortOrder },
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
            created_at: true,
            _count: {
              select: {
                leads_atribuidos: {
                  where: {
                    status: {
                      notIn: ['CONVERTIDO', 'PERDIDO', 'ARQUIVADO'],
                    },
                  },
                },
                negociacoes: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      // Calcular taxa de conversão para cada vendedor
      const usersComMetricas = await Promise.all(
        users.map(async (rawUser) => {
          const user = parseUserFields(rawUser);
          if (user.role !== 'VENDEDOR') return user;

          const inicioMes = new Date();
          inicioMes.setDate(1);
          inicioMes.setHours(0, 0, 0, 0);

          const [leadsRecebidos, vendasRealizadas] = await Promise.all([
            prisma.lead.count({
              where: {
                vendedor_id: user.id,
                created_at: { gte: inicioMes },
              },
            }),
            prisma.lead.count({
              where: {
                vendedor_id: user.id,
                status: 'CONVERTIDO',
                updated_at: { gte: inicioMes },
              },
            }),
          ]);

          const taxaConversao = leadsRecebidos > 0 ? (vendasRealizadas / leadsRecebidos) * 100 : 0;

          return {
            ...user,
            metricas: {
              leadsRecebidos,
              vendasRealizadas,
              taxaConversao: Math.round(taxaConversao * 100) / 100,
            },
          };
        })
      );

      return res.json({
        success: true,
        data: usersComMetricas,
        meta: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error('List users error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter detalhes de um usuário
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
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
      console.error('Get user error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Criar usuário (apenas admin)
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const userData = req.body;

      // Verificar se email já existe
      const existing = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existing) {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(userData.senha || 'senha123', 10);

      const user = await prisma.user.create({
        data: {
          email: userData.email,
          password_hash: passwordHash,
          nome: userData.nome,
          telefone: userData.telefone,
          foto_url: userData.foto_url,
          role: userData.role || 'VENDEDOR',
          nivel: userData.nivel,
          status: userData.status || 'ATIVO',
          especialidades: JSON.stringify(userData.especialidades || []),
          meta_mensal_unidades: userData.meta_mensal_unidades || 10,
          meta_mensal_valor: userData.meta_mensal_valor || 500000,
          capacidade_max_leads: userData.capacidade_max_leads || 15,
          regras_atribuicao: userData.regras_atribuicao ? JSON.stringify(userData.regras_atribuicao) : null,
        },
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
          created_at: true,
        },
      });

      return res.status(201).json({
        success: true,
        data: parseUserFields(user),
      });
    } catch (error) {
      console.error('Create user error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Atualizar usuário
   */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userData = req.body;
      const currentUser = req.user!;

      // Verificar se usuário existe
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Vendedores só podem editar a si mesmos
      if (currentUser.role === 'VENDEDOR' && currentUser.id !== id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Preparar dados de atualização
      const updateData: any = { ...userData };

      // Se estiver atualizando senha
      if (userData.senha) {
        updateData.password_hash = await bcrypt.hash(userData.senha, 10);
        delete updateData.senha;
      }

      // Converter campos numéricos
      const numericFields = ['meta_mensal_unidades', 'meta_mensal_valor', 'capacidade_max_leads'];
      numericFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updateData[field] = Number(updateData[field]);
        }
      });

      // Serialize JSON fields if present
      if (updateData.especialidades) {
        updateData.especialidades = JSON.stringify(updateData.especialidades);
      }
      if (updateData.regras_atribuicao) {
        updateData.regras_atribuicao = JSON.stringify(updateData.regras_atribuicao);
      }

      const userAtualizado = await prisma.user.update({
        where: { id },
        data: updateData,
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
          updated_at: true,
        },
      });

      return res.json({
        success: true,
        data: parseUserFields(userAtualizado),
      });
    } catch (error) {
      console.error('Update user error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Desativar usuário
   */
  async deactivate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      await prisma.user.update({
        where: { id },
        data: { status: 'INATIVO' },
      });

      return res.json({
        success: true,
        message: 'Usuário desativado com sucesso',
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter performance do vendedor
   */
  async getPerformance(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { meses = 12 } = req.query;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Gerar dados dos últimos N meses
      const dadosMensais = [];
      const hoje = new Date();

      for (let i = 0; i < Number(meses); i++) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const inicioMes = new Date(data.getFullYear(), data.getMonth(), 1);
        const fimMes = new Date(data.getFullYear(), data.getMonth() + 1, 0, 23, 59, 59);

        const [leadsRecebidos, leadsConvertidos, negociacoesGanhas, valorTotal] = await Promise.all([
          prisma.lead.count({
            where: {
              vendedor_id: id,
              created_at: { gte: inicioMes, lte: fimMes },
            },
          }),
          prisma.lead.count({
            where: {
              vendedor_id: id,
              status: 'CONVERTIDO',
              updated_at: { gte: inicioMes, lte: fimMes },
            },
          }),
          prisma.negociacao.count({
            where: {
              vendedor_id: id,
              status: 'GANHO',
              created_at: { gte: inicioMes, lte: fimMes },
            },
          }),
          prisma.negociacao.aggregate({
            where: {
              vendedor_id: id,
              status: 'GANHO',
              created_at: { gte: inicioMes, lte: fimMes },
            },
            _sum: { valor_proposta: true },
          }),
        ]);

        dadosMensais.push({
          mes: inicioMes.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
          leadsRecebidos,
          leadsConvertidos,
          negociacoesGanhas,
          taxaConversao: leadsRecebidos > 0 ? (leadsConvertidos / leadsRecebidos) * 100 : 0,
          valorTotal: valorTotal._sum.valor_proposta || 0,
        });
      }

      // Inverter para ordem cronológica
      dadosMensais.reverse();

      return res.json({
        success: true,
        data: {
          vendedor: {
            id: user.id,
            nome: user.nome,
            meta_mensal_unidades: user.meta_mensal_unidades,
            meta_mensal_valor: user.meta_mensal_valor,
          },
          performance: dadosMensais,
        },
      });
    } catch (error) {
      console.error('Get performance error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter leads atuais do vendedor
   */
  async getLeadsAtuais(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where: {
            vendedor_id: id,
            status: {
              notIn: ['CONVERTIDO', 'PERDIDO', 'ARQUIVADO'],
            },
          },
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            veiculo: {
              select: {
                marca: true,
                modelo: true,
                preco_venda: true,
                fotos: { // Note: Foto model might check validity but Relation is fine
                  // However, verify if 'fotos' is compatible. In schema it is a relation, so yes.
                  where: {
                    // principal: true, // ERROR: Schema doesn't have 'principal' boolean in Foto anymore? 
                    // Wait, schema has `ordem` in Foto. `principal` is probably logic (ordem=0).
                    // I need to check schema for Foto. Schema says: `ordem Int @default(0)`.
                    // So `principal: true` is invalid. I should change to `ordem: 0`.
                    ordem: 0
                  },
                  take: 1,
                  select: { url: true }, // Schema has `url`, not `url_thumb`.
                },
              },
            },
          },
        }),
        prisma.lead.count({
          where: {
            vendedor_id: id,
            status: {
              notIn: ['CONVERTIDO', 'PERDIDO', 'ARQUIVADO'],
            },
          },
        }),
      ]);

      return res.json({
        success: true,
        data: leads.map(lead => ({
          ...lead,
          // Fix structure if needed, e.g. veiculo.fotos[0].url -> foto_url
          veiculo: {
            ...lead.veiculo,
            foto_principal: lead.veiculo.fotos[0]?.url || null
          }
        })),
        meta: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Get leads atuais error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

export const userController = new UserController();