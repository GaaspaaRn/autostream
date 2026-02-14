"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = exports.DashboardController = void 0;
const prisma_1 = require("../lib/prisma");
const date_fns_1 = require("date-fns");
class DashboardController {
    /**
     * Obter métricas principais do dashboard
     */
    async getMetricas(req, res) {
        try {
            const user = req.user;
            const hoje = new Date();
            const inicioHoje = (0, date_fns_1.startOfDay)(hoje);
            const fimHoje = (0, date_fns_1.endOfDay)(hoje);
            const inicioMes = (0, date_fns_1.startOfMonth)(hoje);
            const fimMes = (0, date_fns_1.endOfMonth)(hoje);
            const ontem = (0, date_fns_1.subDays)(hoje, 1);
            const inicioOntem = (0, date_fns_1.startOfDay)(ontem);
            const fimOntem = (0, date_fns_1.endOfDay)(ontem);
            // Construir filtros base
            const baseWhereLead = {};
            const baseWhereNegociacao = {};
            // Restrição para vendedores
            if (user.role === 'VENDEDOR') {
                baseWhereLead.vendedor_id = user.id;
                baseWhereNegociacao.vendedor_id = user.id;
            }
            // Métricas de leads
            const [leadsHoje, leadsOntem, leadsMes, leadsMesAnterior, leadsNaoAtribuidos,] = await Promise.all([
                // Leads hoje
                prisma_1.prisma.lead.count({
                    where: {
                        ...baseWhereLead,
                        created_at: { gte: inicioHoje, lte: fimHoje },
                    },
                }),
                // Leads ontem
                prisma_1.prisma.lead.count({
                    where: {
                        ...baseWhereLead,
                        created_at: { gte: inicioOntem, lte: fimOntem },
                    },
                }),
                // Leads do mês
                prisma_1.prisma.lead.count({
                    where: {
                        ...baseWhereLead,
                        created_at: { gte: inicioMes, lte: fimMes },
                    },
                }),
                // Leads do mês anterior (aproximado)
                prisma_1.prisma.lead.count({
                    where: {
                        ...baseWhereLead,
                        created_at: {
                            gte: (0, date_fns_1.subDays)(inicioMes, 30),
                            lt: inicioMes,
                        },
                    },
                }),
                // Leads não atribuídos (apenas admin/gerente)
                user.role !== 'VENDEDOR'
                    ? prisma_1.prisma.lead.count({
                        where: {
                            vendedor_id: null,
                            status: 'NOVO',
                        },
                    })
                    : Promise.resolve(0),
            ]);
            // Métricas de conversão
            const [leadsConvertidosMes, totalLeadsMesAtual] = await Promise.all([
                prisma_1.prisma.lead.count({
                    where: {
                        ...baseWhereLead,
                        status: 'CONVERTIDO',
                        updated_at: { gte: inicioMes, lte: fimMes },
                    },
                }),
                prisma_1.prisma.lead.count({
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
                prisma_1.prisma.veiculo.count({
                    where: { status: 'DISPONIVEL' },
                }),
                prisma_1.prisma.veiculo.count({
                    where: {
                        status: 'VENDIDO',
                        data_venda: { gte: inicioMes, lte: fimMes },
                    },
                }),
            ]);
            // Faturamento do mês
            const faturamentoMes = await prisma_1.prisma.negociacao.aggregate({
                where: {
                    ...baseWhereNegociacao,
                    status: 'GANHO',
                    created_at: { gte: inicioMes, lte: fimMes },
                },
                _sum: { valor_proposta: true },
            });
            // Negociações por status
            const negociacoesPorStatus = await prisma_1.prisma.negociacao.groupBy({
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
            const metaLeads = await prisma_1.prisma.configuracao.findUnique({
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
                    }, {}),
                },
            });
        }
        catch (error) {
            console.error('Get metricas error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter dados do funil de vendas
     */
    async getFunil(req, res) {
        try {
            const user = req.user;
            const inicioMes = (0, date_fns_1.startOfMonth)(new Date());
            const fimMes = (0, date_fns_1.endOfMonth)(new Date());
            const baseWhere = {
                created_at: { gte: inicioMes, lte: fimMes },
            };
            if (user.role === 'VENDEDOR') {
                baseWhere.vendedor_id = user.id;
            }
            const leadsPorStatus = await prisma_1.prisma.lead.groupBy({
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
                const etapa = funil.find((e) => e.etapa.toUpperCase().replace(' ', '_') === item.status);
                if (etapa) {
                    etapa.quantidade = item._count.status;
                }
            });
            return res.json({
                success: true,
                data: funil,
            });
        }
        catch (error) {
            console.error('Get funil error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter leads por dia (últimos 30 dias)
     */
    async getLeadsPorDia(req, res) {
        try {
            const user = req.user;
            const hoje = new Date();
            const trintaDiasAtras = (0, date_fns_1.subDays)(hoje, 30);
            const baseWhere = {
                created_at: {
                    gte: (0, date_fns_1.startOfDay)(trintaDiasAtras),
                    lte: (0, date_fns_1.endOfDay)(hoje),
                },
            };
            if (user.role === 'VENDEDOR') {
                baseWhere.vendedor_id = user.id;
            }
            const leads = await prisma_1.prisma.lead.findMany({
                where: baseWhere,
                select: {
                    created_at: true,
                },
            });
            // Agrupar por dia
            const dias = (0, date_fns_1.eachDayOfInterval)({
                start: trintaDiasAtras,
                end: hoje,
            });
            const dados = dias.map((dia) => {
                const dataStr = (0, date_fns_1.format)(dia, 'yyyy-MM-dd');
                const quantidade = leads.filter((lead) => (0, date_fns_1.format)(new Date(lead.created_at), 'yyyy-MM-dd') === dataStr).length;
                return {
                    data: (0, date_fns_1.format)(dia, 'dd/MM'),
                    quantidade,
                };
            });
            return res.json({
                success: true,
                data: dados,
            });
        }
        catch (error) {
            console.error('Get leads por dia error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter ranking de vendedores
     */
    async getRankingVendedores(req, res) {
        try {
            const user = req.user;
            // Apenas admin e gerente podem ver ranking
            if (user.role === 'VENDEDOR') {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const inicioMes = (0, date_fns_1.startOfMonth)(new Date());
            const fimMes = (0, date_fns_1.endOfMonth)(new Date());
            const vendedores = await prisma_1.prisma.user.findMany({
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
            const ranking = await Promise.all(vendedores.map(async (vendedor) => {
                const [leadsRecebidos, vendasRealizadas, valorTotal] = await Promise.all([
                    prisma_1.prisma.lead.count({
                        where: {
                            vendedor_id: vendedor.id,
                            created_at: { gte: inicioMes, lte: fimMes },
                        },
                    }),
                    prisma_1.prisma.lead.count({
                        where: {
                            vendedor_id: vendedor.id,
                            status: 'CONVERTIDO',
                            updated_at: { gte: inicioMes, lte: fimMes },
                        },
                    }),
                    prisma_1.prisma.negociacao.aggregate({
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
            }));
            // Ordenar por valor total vendido
            ranking.sort((a, b) => b.valorTotal - a.valorTotal);
            return res.json({
                success: true,
                data: ranking,
            });
        }
        catch (error) {
            console.error('Get ranking error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter distribuição por categoria
     */
    async getDistribuicaoCategoria(req, res) {
        try {
            const distribuicao = await prisma_1.prisma.veiculo.groupBy({
                by: ['categoria'],
                where: { status: 'DISPONIVEL' },
                _count: { categoria: true },
            });
            const cores = {
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
        }
        catch (error) {
            console.error('Get distribuicao error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter leads que requerem atenção
     */
    async getLeadsAtencao(req, res) {
        try {
            const user = req.user;
            const hoje = new Date();
            const duasHorasAtras = new Date(hoje.getTime() - 2 * 60 * 60 * 1000);
            const vinteQuatroHorasAtras = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
            const quarentaOitoHorasAtras = new Date(hoje.getTime() - 48 * 60 * 60 * 1000);
            const baseWhere = {};
            if (user.role === 'VENDEDOR') {
                baseWhere.vendedor_id = user.id;
            }
            // Leads novos não atribuídos (últimas 2h)
            const leadsNaoAtribuidos = await prisma_1.prisma.lead.findMany({
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
            const leadsSemContato = await prisma_1.prisma.lead.findMany({
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
            const negociacoesParadas = await prisma_1.prisma.negociacao.findMany({
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
        }
        catch (error) {
            console.error('Get leads atencao error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}
exports.DashboardController = DashboardController;
exports.dashboardController = new DashboardController();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGFzaGJvYXJkLmNvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJvbGxlcnMvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsMENBQXVDO0FBRXZDLHVDQUE4RztBQUU5RyxNQUFhLG1CQUFtQjtJQUM5Qjs7T0FFRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBeUIsRUFBRSxHQUFhO1FBQ3hELElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFLLENBQUM7WUFDdkIsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN4QixNQUFNLFVBQVUsR0FBRyxJQUFBLHFCQUFVLEVBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEMsTUFBTSxPQUFPLEdBQUcsSUFBQSxtQkFBUSxFQUFDLElBQUksQ0FBQyxDQUFDO1lBQy9CLE1BQU0sU0FBUyxHQUFHLElBQUEsdUJBQVksRUFBQyxJQUFJLENBQUMsQ0FBQztZQUNyQyxNQUFNLE1BQU0sR0FBRyxJQUFBLHFCQUFVLEVBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEMsTUFBTSxLQUFLLEdBQUcsSUFBQSxrQkFBTyxFQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMvQixNQUFNLFdBQVcsR0FBRyxJQUFBLHFCQUFVLEVBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEMsTUFBTSxRQUFRLEdBQUcsSUFBQSxtQkFBUSxFQUFDLEtBQUssQ0FBQyxDQUFDO1lBRWpDLHlCQUF5QjtZQUN6QixNQUFNLGFBQWEsR0FBUSxFQUFFLENBQUM7WUFDOUIsTUFBTSxtQkFBbUIsR0FBUSxFQUFFLENBQUM7WUFFcEMsNEJBQTRCO1lBQzVCLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxVQUFVLEVBQUUsQ0FBQztnQkFDN0IsYUFBYSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO2dC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Q0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSwwQkFBMEIsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztJQUNILENBQUM7Q0FDRjtBQTNmRCxrREEyZkM7QUFFWSxRQUFBLG1CQUFtQixHQUFHLElBQUksbUJBQW1CLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tICcuLi9saWIvcHJpc21hJztcbmltcG9ydCB7IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgc3RhcnRPZkRheSwgZW5kT2ZEYXksIHN1YkRheXMsIHN0YXJ0T2ZNb250aCwgZW5kT2ZNb250aCwgZm9ybWF0LCBlYWNoRGF5T2ZJbnRlcnZhbCB9IGZyb20gJ2RhdGUtZm5zJztcblxuZXhwb3J0IGNsYXNzIERhc2hib2FyZENvbnRyb2xsZXIge1xuICAvKipcbiAgICogT2J0ZXIgbcOpdHJpY2FzIHByaW5jaXBhaXMgZG8gZGFzaGJvYXJkXG4gICAqL1xuICBhc3luYyBnZXRNZXRyaWNhcyhyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVzZXIgPSByZXEudXNlciE7XG4gICAgICBjb25zdCBob2plID0gbmV3IERhdGUoKTtcbiAgICAgIGNvbnN0IGluaWNpb0hvamUgPSBzdGFydE9mRGF5KGhvamUpO1xuICAgICAgY29uc3QgZmltSG9qZSA9IGVuZE9mRGF5KGhvamUpO1xuICAgICAgY29uc3QgaW5pY2lvTWVzID0gc3RhcnRPZk1vbnRoKGhvamUpO1xuICAgICAgY29uc3QgZmltTWVzID0gZW5kT2ZNb250aChob2plKTtcbiAgICAgIGNvbnN0IG9udGVtID0gc3ViRGF5cyhob2plLCAxKTtcbiAgICAgIGNvbnN0IGluaWNpb09udGVtID0gc3RhcnRPZkRheShvbnRlbSk7XG4gICAgICBjb25zdCBmaW1PbnRlbSA9IGVuZE9mRGF5KG9udGVtKTtcblxuICAgICAgLy8gQ29uc3RydWlyIGZpbHRyb3MgYmFzZVxuICAgICAgY29uc3QgYmFzZVdoZXJlTGVhZDogYW55ID0ge307XG4gICAgICBjb25zdCBiYXNlV2hlcmVOZWdvY2lhY2FvOiBhbnkgPSB7fTtcblxuICAgICAgLy8gUmVzdHJpw6fDo28gcGFyYSB2ZW5kZWRvcmVzXG4gICAgICBpZiAodXNlci5yb2xlID09PSAnVkVOREVET1InKSB7XG4gICAgICAgIGJhc2VXaGVyZUxlYWQudmVuZGVkb3JfaWQgPSB1c2VyLmlkO1xuICAgICAgICBiYXNlV2hlcmVOZWdvY2lhY2FvLnZlbmRlZG9yX2lkID0gdXNlci5pZDtcbiAgICAgIH1cblxuICAgICAgLy8gTcOpdHJpY2FzIGRlIGxlYWRzXG4gICAgICBjb25zdCBbXG4gICAgICAgIGxlYWRzSG9qZSxcbiAgICAgICAgbGVhZHNPbnRlbSxcbiAgICAgICAgbGVhZHNNZXMsXG4gICAgICAgIGxlYWRzTWVzQW50ZXJpb3IsXG4gICAgICAgIGxlYWRzTmFvQXRyaWJ1aWRvcyxcbiAgICAgIF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIC8vIExlYWRzIGhvamVcbiAgICAgICAgcHJpc21hLmxlYWQuY291bnQoe1xuICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAuLi5iYXNlV2hlcmVMZWFkLFxuICAgICAgICAgICAgY3JlYXRlZF9hdDogeyBndGU6IGluaWNpb0hvamUsIGx0ZTogZmltSG9qZSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICAvLyBMZWFkcyBvbnRlbVxuICAgICAgICBwcmlzbWEubGVhZC5jb3VudCh7XG4gICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgIC4uLmJhc2VXaGVyZUxlYWQsXG4gICAgICAgICAgICBjcmVhdGVkX2F0OiB7IGd0ZTogaW5pY2lvT250ZW0sIGx0ZTogZmltT250ZW0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgLy8gTGVhZHMgZG8gbcOqc1xuICAgICAgICBwcmlzbWEubGVhZC5jb3VudCh7XG4gICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgIC4uLmJhc2VXaGVyZUxlYWQsXG4gICAgICAgICAgICBjcmVhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzLCBsdGU6IGZpbU1lcyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICAvLyBMZWFkcyBkbyBtw6pzIGFudGVyaW9yIChhcHJveGltYWRvKVxuICAgICAgICBwcmlzbWEubGVhZC5jb3VudCh7XG4gICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgIC4uLmJhc2VXaGVyZUxlYWQsXG4gICAgICAgICAgICBjcmVhdGVkX2F0OiB7XG4gICAgICAgICAgICAgIGd0ZTogc3ViRGF5cyhpbmljaW9NZXMsIDMwKSxcbiAgICAgICAgICAgICAgbHQ6IGluaWNpb01lcyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIC8vIExlYWRzIG7Do28gYXRyaWJ1w61kb3MgKGFwZW5hcyBhZG1pbi9nZXJlbnRlKVxuICAgICAgICB1c2VyLnJvbGUgIT09ICdWRU5ERURPUidcbiAgICAgICAgICA/IHByaXNtYS5sZWFkLmNvdW50KHtcbiAgICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAgIHZlbmRlZG9yX2lkOiBudWxsLFxuICAgICAgICAgICAgICBzdGF0dXM6ICdOT1ZPJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgICA6IFByb21pc2UucmVzb2x2ZSgwKSxcbiAgICAgIF0pO1xuXG4gICAgICAvLyBNw6l0cmljYXMgZGUgY29udmVyc8Ojb1xuICAgICAgY29uc3QgW2xlYWRzQ29udmVydGlkb3NNZXMsIHRvdGFsTGVhZHNNZXNBdHVhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIHByaXNtYS5sZWFkLmNvdW50KHtcbiAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgLi4uYmFzZVdoZXJlTGVhZCxcbiAgICAgICAgICAgIHN0YXR1czogJ0NPTlZFUlRJRE8nLFxuICAgICAgICAgICAgdXBkYXRlZF9hdDogeyBndGU6IGluaWNpb01lcywgbHRlOiBmaW1NZXMgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgcHJpc21hLmxlYWQuY291bnQoe1xuICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAuLi5iYXNlV2hlcmVMZWFkLFxuICAgICAgICAgICAgY3JlYXRlZF9hdDogeyBndGU6IGluaWNpb01lcywgbHRlOiBmaW1NZXMgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgIF0pO1xuXG4gICAgICBjb25zdCB0YXhhQ29udmVyc2FvID0gdG90YWxMZWFkc01lc0F0dWFsID4gMFxuICAgICAgICA/IChsZWFkc0NvbnZlcnRpZG9zTWVzIC8gdG90YWxMZWFkc01lc0F0dWFsKSAqIDEwMFxuICAgICAgICA6IDA7XG5cbiAgICAgIC8vIE3DqXRyaWNhcyBkZSB2ZcOtY3Vsb3NcbiAgICAgIGNvbnN0IFt2ZWljdWxvc0VzdG9xdWUsIHZlaWN1bG9zVmVuZGlkb3NNZXNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICBwcmlzbWEudmVpY3Vsby5jb3VudCh7XG4gICAgICAgICAgd2hlcmU6IHsgc3RhdHVzOiAnRElTUE9OSVZFTCcgfSxcbiAgICAgICAgfSksXG4gICAgICAgIHByaXNtYS52ZWljdWxvLmNvdW50KHtcbiAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgc3RhdHVzOiAnVkVORElETycsXG4gICAgICAgICAgICBkYXRhX3ZlbmRhOiB7IGd0ZTogaW5pY2lvTWVzLCBsdGU6IGZpbU1lcyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgXSk7XG5cbiAgICAgIC8vIEZhdHVyYW1lbnRvIGRvIG3DqnNcbiAgICAgIGNvbnN0IGZhdHVyYW1lbnRvTWVzID0gYXdhaXQgcHJpc21hLm5lZ29jaWFjYW8uYWdncmVnYXRlKHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAuLi5iYXNlV2hlcmVOZWdvY2lhY2FvLFxuICAgICAgICAgIHN0YXR1czogJ0dBTkhPJyxcbiAgICAgICAgICBjcmVhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzLCBsdGU6IGZpbU1lcyB9LFxuICAgICAgICB9LFxuICAgICAgICBfc3VtOiB7IHZhbG9yX3Byb3Bvc3RhOiB0cnVlIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gTmVnb2NpYcOnw7VlcyBwb3Igc3RhdHVzXG4gICAgICBjb25zdCBuZWdvY2lhY29lc1BvclN0YXR1cyA9IGF3YWl0IHByaXNtYS5uZWdvY2lhY2FvLmdyb3VwQnkoe1xuICAgICAgICBieTogWydzdGF0dXMnXSxcbiAgICAgICAgd2hlcmU6IGJhc2VXaGVyZU5lZ29jaWFjYW8sXG4gICAgICAgIF9jb3VudDogeyBzdGF0dXM6IHRydWUgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDYWxjdWxhciB2YXJpYcOnw7Vlc1xuICAgICAgY29uc3QgdmFyaWFjYW9MZWFkc0RpYSA9IGxlYWRzT250ZW0gPiAwXG4gICAgICAgID8gKChsZWFkc0hvamUgLSBsZWFkc09udGVtKSAvIGxlYWRzT250ZW0pICogMTAwXG4gICAgICAgIDogMDtcblxuICAgICAgY29uc3QgdmFyaWFjYW9MZWFkc01lcyA9IGxlYWRzTWVzQW50ZXJpb3IgPiAwXG4gICAgICAgID8gKChsZWFkc01lcyAtIGxlYWRzTWVzQW50ZXJpb3IpIC8gbGVhZHNNZXNBbnRlcmlvcikgKiAxMDBcbiAgICAgICAgOiAwO1xuXG4gICAgICAvLyBCdXNjYXIgbWV0YSBkZSBsZWFkc1xuICAgICAgY29uc3QgbWV0YUxlYWRzID0gYXdhaXQgcHJpc21hLmNvbmZpZ3VyYWNhby5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgY2hhdmU6ICdtZXRhX2xlYWRzX21lcycgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgbGVhZHM6IHtcbiAgICAgICAgICAgIGhvamU6IGxlYWRzSG9qZSxcbiAgICAgICAgICAgIG9udGVtOiBsZWFkc09udGVtLFxuICAgICAgICAgICAgdmFyaWFjYW9EaWE6IE1hdGgucm91bmQodmFyaWFjYW9MZWFkc0RpYSAqIDEwMCkgLyAxMDAsXG4gICAgICAgICAgICBtZXM6IGxlYWRzTWVzLFxuICAgICAgICAgICAgbWVzQW50ZXJpb3I6IGxlYWRzTWVzQW50ZXJpb3IsXG4gICAgICAgICAgICB2YXJpYWNhb01lczogTWF0aC5yb3VuZCh2YXJpYWNhb0xlYWRzTWVzICogMTAwKSAvIDEwMCxcbiAgICAgICAgICAgIG5hb0F0cmlidWlkb3M6IGxlYWRzTmFvQXRyaWJ1aWRvcyxcbiAgICAgICAgICAgIG1ldGE6IG1ldGFMZWFkcyA/IE51bWJlcihtZXRhTGVhZHMudmFsb3IpIDogMjAwLFxuICAgICAgICAgICAgcHJvZ3Jlc3NvTWV0YTogbWV0YUxlYWRzID8gKGxlYWRzTWVzIC8gTnVtYmVyKG1ldGFMZWFkcy52YWxvcikpICogMTAwIDogMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbnZlcnNhbzoge1xuICAgICAgICAgICAgdGF4YTogTWF0aC5yb3VuZCh0YXhhQ29udmVyc2FvICogMTAwKSAvIDEwMCxcbiAgICAgICAgICAgIGNvbnZlcnRpZG9zTWVzOiBsZWFkc0NvbnZlcnRpZG9zTWVzLFxuICAgICAgICAgICAgdG90YWxMZWFkc01lczogdG90YWxMZWFkc01lc0F0dWFsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVpY3Vsb3M6IHtcbiAgICAgICAgICAgIGVzdG9xdWU6IHZlaWN1bG9zRXN0b3F1ZSxcbiAgICAgICAgICAgIHZlbmRpZG9zTWVzOiB2ZWljdWxvc1ZlbmRpZG9zTWVzLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZmF0dXJhbWVudG86IHtcbiAgICAgICAgICAgIG1lczogZmF0dXJhbWVudG9NZXMuX3N1bS52YWxvcl9wcm9wb3N0YSB8fCAwLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbmVnb2NpYWNvZXM6IG5lZ29jaWFjb2VzUG9yU3RhdHVzLnJlZHVjZSgoYWNjLCBpdGVtKSA9PiB7XG4gICAgICAgICAgICBhY2NbaXRlbS5zdGF0dXNdID0gaXRlbS5fY291bnQuc3RhdHVzO1xuICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICB9LCB7fSBhcyBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+KSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdHZXQgbWV0cmljYXMgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPYnRlciBkYWRvcyBkbyBmdW5pbCBkZSB2ZW5kYXNcbiAgICovXG4gIGFzeW5jIGdldEZ1bmlsKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcbiAgICAgIGNvbnN0IGluaWNpb01lcyA9IHN0YXJ0T2ZNb250aChuZXcgRGF0ZSgpKTtcbiAgICAgIGNvbnN0IGZpbU1lcyA9IGVuZE9mTW9udGgobmV3IERhdGUoKSk7XG5cbiAgICAgIGNvbnN0IGJhc2VXaGVyZTogYW55ID0ge1xuICAgICAgICBjcmVhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzLCBsdGU6IGZpbU1lcyB9LFxuICAgICAgfTtcblxuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJykge1xuICAgICAgICBiYXNlV2hlcmUudmVuZGVkb3JfaWQgPSB1c2VyLmlkO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBsZWFkc1BvclN0YXR1cyA9IGF3YWl0IHByaXNtYS5sZWFkLmdyb3VwQnkoe1xuICAgICAgICBieTogWydzdGF0dXMnXSxcbiAgICAgICAgd2hlcmU6IGJhc2VXaGVyZSxcbiAgICAgICAgX2NvdW50OiB7IHN0YXR1czogdHJ1ZSB9LFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGZ1bmlsID0gW1xuICAgICAgICB7IGV0YXBhOiAnTm92bycsIHF1YW50aWRhZGU6IDAsIGNvcjogJyMzYjgyZjYnIH0sXG4gICAgICAgIHsgZXRhcGE6ICdFbSBBdGVuZGltZW50bycsIHF1YW50aWRhZGU6IDAsIGNvcjogJyM4YjVjZjYnIH0sXG4gICAgICAgIHsgZXRhcGE6ICdQcm9wb3N0YSBFbnZpYWRhJywgcXVhbnRpZGFkZTogMCwgY29yOiAnI2Y1OWUwYicgfSxcbiAgICAgICAgeyBldGFwYTogJ05lZ29jaWFuZG8nLCBxdWFudGlkYWRlOiAwLCBjb3I6ICcjZWM0ODk5JyB9LFxuICAgICAgICB7IGV0YXBhOiAnQ29udmVydGlkbycsIHF1YW50aWRhZGU6IDAsIGNvcjogJyMxMGI5ODEnIH0sXG4gICAgICAgIHsgZXRhcGE6ICdQZXJkaWRvJywgcXVhbnRpZGFkZTogMCwgY29yOiAnI2VmNDQ0NCcgfSxcbiAgICAgIF07XG5cbiAgICAgIGxlYWRzUG9yU3RhdHVzLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgY29uc3QgZXRhcGEgPSBmdW5pbC5maW5kKChlKSA9PlxuICAgICAgICAgIGUuZXRhcGEudG9VcHBlckNhc2UoKS5yZXBsYWNlKCcgJywgJ18nKSA9PT0gaXRlbS5zdGF0dXNcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGV0YXBhKSB7XG4gICAgICAgICAgZXRhcGEucXVhbnRpZGFkZSA9IGl0ZW0uX2NvdW50LnN0YXR1cztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IGZ1bmlsLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0dldCBmdW5pbCBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9idGVyIGxlYWRzIHBvciBkaWEgKMO6bHRpbW9zIDMwIGRpYXMpXG4gICAqL1xuICBhc3luYyBnZXRMZWFkc1BvckRpYShyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVzZXIgPSByZXEudXNlciE7XG4gICAgICBjb25zdCBob2plID0gbmV3IERhdGUoKTtcbiAgICAgIGNvbnN0IHRyaW50YURpYXNBdHJhcyA9IHN1YkRheXMoaG9qZSwgMzApO1xuXG4gICAgICBjb25zdCBiYXNlV2hlcmU6IGFueSA9IHtcbiAgICAgICAgY3JlYXRlZF9hdDoge1xuICAgICAgICAgIGd0ZTogc3RhcnRPZkRheSh0cmludGFEaWFzQXRyYXMpLFxuICAgICAgICAgIGx0ZTogZW5kT2ZEYXkoaG9qZSksXG4gICAgICAgIH0sXG4gICAgICB9O1xuXG4gICAgICBpZiAodXNlci5yb2xlID09PSAnVkVOREVET1InKSB7XG4gICAgICAgIGJhc2VXaGVyZS52ZW5kZWRvcl9pZCA9IHVzZXIuaWQ7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxlYWRzID0gYXdhaXQgcHJpc21hLmxlYWQuZmluZE1hbnkoe1xuICAgICAgICB3aGVyZTogYmFzZVdoZXJlLFxuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBjcmVhdGVkX2F0OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEFncnVwYXIgcG9yIGRpYVxuICAgICAgY29uc3QgZGlhcyA9IGVhY2hEYXlPZkludGVydmFsKHtcbiAgICAgICAgc3RhcnQ6IHRyaW50YURpYXNBdHJhcyxcbiAgICAgICAgZW5kOiBob2plLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGRhZG9zID0gZGlhcy5tYXAoKGRpYSkgPT4ge1xuICAgICAgICBjb25zdCBkYXRhU3RyID0gZm9ybWF0KGRpYSwgJ3l5eXktTU0tZGQnKTtcbiAgICAgICAgY29uc3QgcXVhbnRpZGFkZSA9IGxlYWRzLmZpbHRlcigobGVhZCkgPT5cbiAgICAgICAgICBmb3JtYXQobmV3IERhdGUobGVhZC5jcmVhdGVkX2F0KSwgJ3l5eXktTU0tZGQnKSA9PT0gZGF0YVN0clxuICAgICAgICApLmxlbmd0aDtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IGZvcm1hdChkaWEsICdkZC9NTScpLFxuICAgICAgICAgIHF1YW50aWRhZGUsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogZGFkb3MsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignR2V0IGxlYWRzIHBvciBkaWEgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPYnRlciByYW5raW5nIGRlIHZlbmRlZG9yZXNcbiAgICovXG4gIGFzeW5jIGdldFJhbmtpbmdWZW5kZWRvcmVzKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcblxuICAgICAgLy8gQXBlbmFzIGFkbWluIGUgZ2VyZW50ZSBwb2RlbSB2ZXIgcmFua2luZ1xuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogJ0FjZXNzbyBuZWdhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpbmljaW9NZXMgPSBzdGFydE9mTW9udGgobmV3IERhdGUoKSk7XG4gICAgICBjb25zdCBmaW1NZXMgPSBlbmRPZk1vbnRoKG5ldyBEYXRlKCkpO1xuXG4gICAgICBjb25zdCB2ZW5kZWRvcmVzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZE1hbnkoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIHJvbGU6ICdWRU5ERURPUicsXG4gICAgICAgICAgc3RhdHVzOiAnQVRJVk8nLFxuICAgICAgICB9LFxuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgIGZvdG9fdXJsOiB0cnVlLFxuICAgICAgICAgIG5pdmVsOiB0cnVlLFxuICAgICAgICAgIG1ldGFfbWVuc2FsX3VuaWRhZGVzOiB0cnVlLFxuICAgICAgICAgIG1ldGFfbWVuc2FsX3ZhbG9yOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHJhbmtpbmcgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgdmVuZGVkb3Jlcy5tYXAoYXN5bmMgKHZlbmRlZG9yKSA9PiB7XG4gICAgICAgICAgY29uc3QgW2xlYWRzUmVjZWJpZG9zLCB2ZW5kYXNSZWFsaXphZGFzLCB2YWxvclRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAgIHByaXNtYS5sZWFkLmNvdW50KHtcbiAgICAgICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgICAgICB2ZW5kZWRvcl9pZDogdmVuZGVkb3IuaWQsXG4gICAgICAgICAgICAgICAgY3JlYXRlZF9hdDogeyBndGU6IGluaWNpb01lcywgbHRlOiBmaW1NZXMgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgcHJpc21hLmxlYWQuY291bnQoe1xuICAgICAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgICAgIHZlbmRlZG9yX2lkOiB2ZW5kZWRvci5pZCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdDT05WRVJUSURPJyxcbiAgICAgICAgICAgICAgICB1cGRhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzLCBsdGU6IGZpbU1lcyB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBwcmlzbWEubmVnb2NpYWNhby5hZ2dyZWdhdGUoe1xuICAgICAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgICAgIHZlbmRlZG9yX2lkOiB2ZW5kZWRvci5pZCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdHQU5ITycsXG4gICAgICAgICAgICAgICAgY3JlYXRlZF9hdDogeyBndGU6IGluaWNpb01lcywgbHRlOiBmaW1NZXMgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgX3N1bTogeyB2YWxvcl9wcm9wb3N0YTogdHJ1ZSB9LFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSk7XG5cbiAgICAgICAgICBjb25zdCB0YXhhQ29udmVyc2FvID0gbGVhZHNSZWNlYmlkb3MgPiAwXG4gICAgICAgICAgICA/ICh2ZW5kYXNSZWFsaXphZGFzIC8gbGVhZHNSZWNlYmlkb3MpICogMTAwXG4gICAgICAgICAgICA6IDA7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4udmVuZGVkb3IsXG4gICAgICAgICAgICBsZWFkc1JlY2ViaWRvcyxcbiAgICAgICAgICAgIHZlbmRhc1JlYWxpemFkYXMsXG4gICAgICAgICAgICB0YXhhQ29udmVyc2FvOiBNYXRoLnJvdW5kKHRheGFDb252ZXJzYW8gKiAxMDApIC8gMTAwLFxuICAgICAgICAgICAgdmFsb3JUb3RhbDogdmFsb3JUb3RhbC5fc3VtLnZhbG9yX3Byb3Bvc3RhIHx8IDAsXG4gICAgICAgICAgICBwcm9ncmVzc29NZXRhOiB2ZW5kZWRvci5tZXRhX21lbnNhbF92YWxvciA+IDBcbiAgICAgICAgICAgICAgPyAoKHZhbG9yVG90YWwuX3N1bS52YWxvcl9wcm9wb3N0YSB8fCAwKSAvIHZlbmRlZG9yLm1ldGFfbWVuc2FsX3ZhbG9yKSAqIDEwMFxuICAgICAgICAgICAgICA6IDAsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAgIC8vIE9yZGVuYXIgcG9yIHZhbG9yIHRvdGFsIHZlbmRpZG9cbiAgICAgIHJhbmtpbmcuc29ydCgoYSwgYikgPT4gYi52YWxvclRvdGFsIC0gYS52YWxvclRvdGFsKTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogcmFua2luZyxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdHZXQgcmFua2luZyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9idGVyIGRpc3RyaWJ1acOnw6NvIHBvciBjYXRlZ29yaWFcbiAgICovXG4gIGFzeW5jIGdldERpc3RyaWJ1aWNhb0NhdGVnb3JpYShyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRpc3RyaWJ1aWNhbyA9IGF3YWl0IHByaXNtYS52ZWljdWxvLmdyb3VwQnkoe1xuICAgICAgICBieTogWydjYXRlZ29yaWEnXSxcbiAgICAgICAgd2hlcmU6IHsgc3RhdHVzOiAnRElTUE9OSVZFTCcgfSxcbiAgICAgICAgX2NvdW50OiB7IGNhdGVnb3JpYTogdHJ1ZSB9LFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGNvcmVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICBTVVY6ICcjM2I4MmY2JyxcbiAgICAgICAgU0VEQU46ICcjOGI1Y2Y2JyxcbiAgICAgICAgSEFUQ0g6ICcjZjU5ZTBiJyxcbiAgICAgICAgUElDS1VQOiAnIzEwYjk4MScsXG4gICAgICAgIEVTUE9SVElWTzogJyNlYzQ4OTknLFxuICAgICAgICBFTEVUUklDTzogJyMwNmI2ZDQnLFxuICAgICAgICBIQVRDSEJBQ0s6ICcjZjk3MzE2JyxcbiAgICAgICAgTUlOSVZBTjogJyM4NGNjMTYnLFxuICAgICAgICBDQU1JTkhBT19MRVZFOiAnIzYzNjZmMScsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBkYWRvcyA9IGRpc3RyaWJ1aWNhby5tYXAoKGl0ZW0pID0+ICh7XG4gICAgICAgIGNhdGVnb3JpYTogaXRlbS5jYXRlZ29yaWEsXG4gICAgICAgIHF1YW50aWRhZGU6IGl0ZW0uX2NvdW50LmNhdGVnb3JpYSxcbiAgICAgICAgY29yOiBjb3Jlc1tpdGVtLmNhdGVnb3JpYV0gfHwgJyM5NGEzYjgnLFxuICAgICAgfSkpO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBkYWRvcyxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdHZXQgZGlzdHJpYnVpY2FvIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgbGVhZHMgcXVlIHJlcXVlcmVtIGF0ZW7Dp8Ojb1xuICAgKi9cbiAgYXN5bmMgZ2V0TGVhZHNBdGVuY2FvKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcbiAgICAgIGNvbnN0IGhvamUgPSBuZXcgRGF0ZSgpO1xuICAgICAgY29uc3QgZHVhc0hvcmFzQXRyYXMgPSBuZXcgRGF0ZShob2plLmdldFRpbWUoKSAtIDIgKiA2MCAqIDYwICogMTAwMCk7XG4gICAgICBjb25zdCB2aW50ZVF1YXRyb0hvcmFzQXRyYXMgPSBuZXcgRGF0ZShob2plLmdldFRpbWUoKSAtIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgICAgY29uc3QgcXVhcmVudGFPaXRvSG9yYXNBdHJhcyA9IG5ldyBEYXRlKGhvamUuZ2V0VGltZSgpIC0gNDggKiA2MCAqIDYwICogMTAwMCk7XG5cbiAgICAgIGNvbnN0IGJhc2VXaGVyZTogYW55ID0ge307XG5cbiAgICAgIGlmICh1c2VyLnJvbGUgPT09ICdWRU5ERURPUicpIHtcbiAgICAgICAgYmFzZVdoZXJlLnZlbmRlZG9yX2lkID0gdXNlci5pZDtcbiAgICAgIH1cblxuICAgICAgLy8gTGVhZHMgbm92b3MgbsOjbyBhdHJpYnXDrWRvcyAow7psdGltYXMgMmgpXG4gICAgICBjb25zdCBsZWFkc05hb0F0cmlidWlkb3MgPSBhd2FpdCBwcmlzbWEubGVhZC5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgc3RhdHVzOiAnTk9WTycsXG4gICAgICAgICAgdmVuZGVkb3JfaWQ6IG51bGwsXG4gICAgICAgICAgY3JlYXRlZF9hdDogeyBndGU6IGR1YXNIb3Jhc0F0cmFzIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHRha2U6IDUsXG4gICAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZF9hdDogJ2Rlc2MnIH0sXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB2ZWljdWxvOiB7XG4gICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgbWFyY2E6IHRydWUsXG4gICAgICAgICAgICAgIG1vZGVsbzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBMZWFkcyBzZW0gY29udGF0byBow6EgMjRoXG4gICAgICBjb25zdCBsZWFkc1NlbUNvbnRhdG8gPSBhd2FpdCBwcmlzbWEubGVhZC5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgLi4uYmFzZVdoZXJlLFxuICAgICAgICAgIHN0YXR1czogeyBpbjogWydOT1ZPJywgJ0VNX0FURU5ESU1FTlRPJ10gfSxcbiAgICAgICAgICBjcmVhdGVkX2F0OiB7IGx0OiB2aW50ZVF1YXRyb0hvcmFzQXRyYXMgfSxcbiAgICAgICAgfSxcbiAgICAgICAgdGFrZTogNSxcbiAgICAgICAgb3JkZXJCeTogeyBjcmVhdGVkX2F0OiAnYXNjJyB9LFxuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgdmVpY3Vsbzoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIG1hcmNhOiB0cnVlLFxuICAgICAgICAgICAgICBtb2RlbG86IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZGVkb3I6IHtcbiAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIE5lZ29jaWHDp8O1ZXMgcGFyYWRhcyBow6EgNDhoK1xuICAgICAgY29uc3QgbmVnb2NpYWNvZXNQYXJhZGFzID0gYXdhaXQgcHJpc21hLm5lZ29jaWFjYW8uZmluZE1hbnkoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIC4uLmJhc2VXaGVyZSxcbiAgICAgICAgICBzdGF0dXM6IHsgaW46IFsnUFJPUE9TVEFfRU5WSUFEQScsICdFTV9ORUdPQ0lBQ0FPJ10gfSxcbiAgICAgICAgICB1cGRhdGVkX2F0OiB7IGx0OiBxdWFyZW50YU9pdG9Ib3Jhc0F0cmFzIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHRha2U6IDUsXG4gICAgICAgIG9yZGVyQnk6IHsgdXBkYXRlZF9hdDogJ2FzYycgfSxcbiAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgIGxlYWQ6IHtcbiAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlaWN1bG86IHtcbiAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICBtYXJjYTogdHJ1ZSxcbiAgICAgICAgICAgICAgbW9kZWxvOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBsZWFkc05hb0F0cmlidWlkb3MsXG4gICAgICAgICAgbGVhZHNTZW1Db250YXRvLFxuICAgICAgICAgIG5lZ29jaWFjb2VzUGFyYWRhcyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdHZXQgbGVhZHMgYXRlbmNhbyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRDb250cm9sbGVyID0gbmV3IERhc2hib2FyZENvbnRyb2xsZXIoKTsiXX0=