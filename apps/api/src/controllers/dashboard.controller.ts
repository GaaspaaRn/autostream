import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, format, eachDayOfInterval } from 'date-fns';

export class DashboardController {
  /**
   * Obter métricas principais do dashboard
   */
  async getMetricas(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const hoje = new Date();
      const inicioHoje = startOfDay(hoje);
      const fimHoje = endOfDay(hoje);
      const inicioMes = startOfMonth(hoje);
      const fimMes = endOfMonth(hoje);
      const ontem = subDays(hoje, 1);
      const inicioOntem = startOfDay(ontem);
      const fimOntem = endOfDay(ontem);

      // Construir filtros base
      const baseWhereLead: any = {};
      const baseWhereNegociacao: any = {};

      // Restrição para vendedores
      if (user.role === 'VENDEDOR') {
        baseWhereLead.vendedor_id = user.id;
        baseWhereNegociacao.vendedor_id = user.id;
      }

      // Métricas de leads
      const [
        leadsHoje,
        leadsOntem,
        leadsMes,
        leadsMesAnterior,
        leadsNaoAtribuidos,
      ] = await Promise.all([
        // Leads hoje
        prisma.lead.count({
          where: {
            ...baseWhereLead,
            created_at: { gte: inicioHoje, lte: fimHoje },
          },
        }),
        // Leads ontem
        prisma.lead.count({
          where: {
            ...baseWhereLead,
            created_at: { gte: inicioOntem, lte: fimOntem },
          },
        }),
        // Leads do mês
        prisma.lead.count({
          where: {
            ...baseWhereLead,
            created_at: { gte: inicioMes, lte: fimMes },
          },
        }),
        // Leads do mês anterior (aproximado)
        prisma.lead.count({
          where: {
            ...baseWhereLead,
            created_at: {
              gte: subDays(inicioMes, 30),
              lt: inicioMes,
            },
          },
        }),
        // Leads não atribuídos (apenas admin/gerente)
        user.role !== 'VENDEDOR'
          ? prisma.lead.count({
            where: {
              vendedor_id: null,
              status: 'NOVO',
            },
          })
          : Promise.resolve(0),
      ]);

      // Métricas de conversão
      const [leadsConvertidosMes, totalLeadsMesAtual] = await Promise.all([
        prisma.lead.count({
          where: {
            ...baseWhereLead,
            status: 'CONVERTIDO',
            updated_at: { gte: inicioMes, lte: fimMes },
          },
        }),
        prisma.lead.count({
          where: {
            ...baseWhereLead,
            created_at: { gte: inicioMes, lte: fimMes },
          },
        }),
      ]);

      const taxaConversao = totalLeadsMesAtual > 0
        ? (leadsConvertidosMes / totalLeadsMesAtual) * 100
        : 0;

      // Métricas de veículos
      const [veiculosEstoque, veiculosVendidosMes] = await Promise.all([
        prisma.veiculo.count({
          where: { status: 'DISPONIVEL' },
        }),
        prisma.veiculo.count({
          where: {
            status: 'VENDIDO',
            data_venda: { gte: inicioMes, lte: fimMes },
          },
        }),
      ]);

      // Faturamento do mês
      const faturamentoMes = await prisma.negociacao.aggregate({
        where: {
          ...baseWhereNegociacao,
          status: 'GANHO',
          created_at: { gte: inicioMes, lte: fimMes },
        },
        _sum: { valor_proposta: true },
      });

      // Negociações por status
      const negociacoesPorStatus = await prisma.negociacao.groupBy({
        by: ['status'],
        where: baseWhereNegociacao,
        _count: { status: true },
      });

      // Calcular variações
      const variacaoLeadsDia = leadsOntem > 0
        ? ((leadsHoje - leadsOntem) / leadsOntem) * 100
        : 0;

      const variacaoLeadsMes = leadsMesAnterior > 0
        ? ((leadsMes - leadsMesAnterior) / leadsMesAnterior) * 100
        : 0;

      // Buscar meta de leads
      const metaLeads = await prisma.configuracao.findUnique({
        where: { chave: 'meta_leads_mes' },
      });

      return res.json({
        success: true,
        data: {
          leads: {
            hoje: leadsHoje,
            ontem: leadsOntem,
            variacaoDia: Math.round(variacaoLeadsDia * 100) / 100,
            mes: leadsMes,
            mesAnterior: leadsMesAnterior,
            variacaoMes: Math.round(variacaoLeadsMes * 100) / 100,
            naoAtribuidos: leadsNaoAtribuidos,
            meta: metaLeads ? Number(metaLeads.valor) : 200,
            progressoMeta: metaLeads ? (leadsMes / Number(metaLeads.valor)) * 100 : 0,
          },
          conversao: {
            taxa: Math.round(taxaConversao * 100) / 100,
            convertidosMes: leadsConvertidosMes,
            totalLeadsMes: totalLeadsMesAtual,
          },
          veiculos: {
            estoque: veiculosEstoque,
            vendidosMes: veiculosVendidosMes,
          },
          faturamento: {
            mes: faturamentoMes._sum.valor_proposta || 0,
          },
          negociacoes: negociacoesPorStatus.reduce((acc, item) => {
            acc[item.status] = item._count.status;
            return acc;
          }, {} as Record<string, number>),
        },
      });
    } catch (error) {
      console.error('Get metricas error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter dados do funil de vendas
   */
  async getFunil(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const inicioMes = startOfMonth(new Date());
      const fimMes = endOfMonth(new Date());

      const baseWhere: any = {
        created_at: { gte: inicioMes, lte: fimMes },
      };

      if (user.role === 'VENDEDOR') {
        baseWhere.vendedor_id = user.id;
      }

      const leadsPorStatus = await prisma.lead.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { status: true },
      });

      const funil = [
        { etapa: 'Novo', quantidade: 0, cor: '#3b82f6' },
        { etapa: 'Em Atendimento', quantidade: 0, cor: '#8b5cf6' },
        { etapa: 'Proposta Enviada', quantidade: 0, cor: '#f59e0b' },
        { etapa: 'Negociando', quantidade: 0, cor: '#ec4899' },
        { etapa: 'Convertido', quantidade: 0, cor: '#10b981' },
        { etapa: 'Perdido', quantidade: 0, cor: '#ef4444' },
      ];

      leadsPorStatus.forEach((item) => {
        const etapa = funil.find((e) =>
          e.etapa.toUpperCase().replace(' ', '_') === item.status
        );
        if (etapa) {
          etapa.quantidade = item._count.status;
        }
      });

      return res.json({
        success: true,
        data: funil,
      });
    } catch (error) {
      console.error('Get funil error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter leads por dia (últimos 30 dias)
   */
  async getLeadsPorDia(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const hoje = new Date();
      const trintaDiasAtras = subDays(hoje, 30);

      const baseWhere: any = {
        created_at: {
          gte: startOfDay(trintaDiasAtras),
          lte: endOfDay(hoje),
        },
      };

      if (user.role === 'VENDEDOR') {
        baseWhere.vendedor_id = user.id;
      }

      const leads = await prisma.lead.findMany({
        where: baseWhere,
        select: {
          created_at: true,
        },
      });

      // Agrupar por dia
      const dias = eachDayOfInterval({
        start: trintaDiasAtras,
        end: hoje,
      });

      const dados = dias.map((dia) => {
        const dataStr = format(dia, 'yyyy-MM-dd');
        const quantidade = leads.filter((lead) =>
          format(new Date(lead.created_at), 'yyyy-MM-dd') === dataStr
        ).length;

        return {
          data: format(dia, 'dd/MM'),
          quantidade,
        };
      });

      return res.json({
        success: true,
        data: dados,
      });
    } catch (error) {
      console.error('Get leads por dia error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter ranking de vendedores
   */
  async getRankingVendedores(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      // Apenas admin e gerente podem ver ranking
      if (user.role === 'VENDEDOR') {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const inicioMes = startOfMonth(new Date());
      const fimMes = endOfMonth(new Date());

      const vendedores = await prisma.user.findMany({
        where: {
          role: 'VENDEDOR',
          status: 'ATIVO',
        },
        select: {
          id: true,
          nome: true,
          foto_url: true,
          nivel: true,
          meta_mensal_unidades: true,
          meta_mensal_valor: true,
        },
      });

      const ranking = await Promise.all(
        vendedores.map(async (vendedor) => {
          const [leadsRecebidos, vendasRealizadas, valorTotal] = await Promise.all([
            prisma.lead.count({
              where: {
                vendedor_id: vendedor.id,
                created_at: { gte: inicioMes, lte: fimMes },
              },
            }),
            prisma.lead.count({
              where: {
                vendedor_id: vendedor.id,
                status: 'CONVERTIDO',
                updated_at: { gte: inicioMes, lte: fimMes },
              },
            }),
            prisma.negociacao.aggregate({
              where: {
                vendedor_id: vendedor.id,
                status: 'GANHO',
                created_at: { gte: inicioMes, lte: fimMes },
              },
              _sum: { valor_proposta: true },
            }),
          ]);

          const taxaConversao = leadsRecebidos > 0
            ? (vendasRealizadas / leadsRecebidos) * 100
            : 0;

          return {
            ...vendedor,
            leadsRecebidos,
            vendasRealizadas,
            taxaConversao: Math.round(taxaConversao * 100) / 100,
            valorTotal: valorTotal._sum.valor_proposta || 0,
            progressoMeta: vendedor.meta_mensal_valor > 0
              ? ((valorTotal._sum.valor_proposta || 0) / vendedor.meta_mensal_valor) * 100
              : 0,
          };
        })
      );

      // Ordenar por valor total vendido
      ranking.sort((a, b) => b.valorTotal - a.valorTotal);

      return res.json({
        success: true,
        data: ranking,
      });
    } catch (error) {
      console.error('Get ranking error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter distribuição por categoria
   */
  async getDistribuicaoCategoria(req: AuthenticatedRequest, res: Response) {
    try {
      const distribuicao = await prisma.veiculo.groupBy({
        by: ['categoria'],
        where: { status: 'DISPONIVEL' },
        _count: { categoria: true },
      });

      const cores: Record<string, string> = {
        SUV: '#3b82f6',
        SEDAN: '#8b5cf6',
        HATCH: '#f59e0b',
        PICKUP: '#10b981',
        ESPORTIVO: '#ec4899',
        ELETRICO: '#06b6d4',
        HATCHBACK: '#f97316',
        MINIVAN: '#84cc16',
        CAMINHAO_LEVE: '#6366f1',
      };

      const dados = distribuicao.map((item) => ({
        categoria: item.categoria,
        quantidade: item._count.categoria,
        cor: cores[item.categoria] || '#94a3b8',
      }));

      return res.json({
        success: true,
        data: dados,
      });
    } catch (error) {
      console.error('Get distribuicao error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter leads que requerem atenção
   */
  async getLeadsAtencao(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const hoje = new Date();
      const duasHorasAtras = new Date(hoje.getTime() - 2 * 60 * 60 * 1000);
      const vinteQuatroHorasAtras = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
      const quarentaOitoHorasAtras = new Date(hoje.getTime() - 48 * 60 * 60 * 1000);

      const baseWhere: any = {};

      if (user.role === 'VENDEDOR') {
        baseWhere.vendedor_id = user.id;
      }

      // Leads novos não atribuídos (últimas 2h)
      const leadsNaoAtribuidos = await prisma.lead.findMany({
        where: {
          status: 'NOVO',
          vendedor_id: null,
          created_at: { gte: duasHorasAtras },
        },
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          veiculo: {
            select: {
              marca: true,
              modelo: true,
            },
          },
        },
      });

      // Leads sem contato há 24h
      const leadsSemContato = await prisma.lead.findMany({
        where: {
          ...baseWhere,
          status: { in: ['NOVO', 'EM_ATENDIMENTO'] },
          created_at: { lt: vinteQuatroHorasAtras },
        },
        take: 5,
        orderBy: { created_at: 'asc' },
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

      // Negociações paradas há 48h+
      const negociacoesParadas = await prisma.negociacao.findMany({
        where: {
          ...baseWhere,
          status: { in: ['PROPOSTA_ENVIADA', 'EM_NEGOCIACAO'] },
          updated_at: { lt: quarentaOitoHorasAtras },
        },
        take: 5,
        orderBy: { updated_at: 'asc' },
        include: {
          lead: {
            select: {
              nome: true,
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

      return res.json({
        success: true,
        data: {
          leadsNaoAtribuidos,
          leadsSemContato,
          negociacoesParadas,
        },
      });
    } catch (error) {
      console.error('Get leads atencao error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

export const dashboardController = new DashboardController();