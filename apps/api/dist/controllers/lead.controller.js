"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadController = exports.LeadController = void 0;
const prisma_1 = require("../lib/prisma");
const matching_service_1 = require("../services/matching.service");
const date_fns_1 = require("date-fns");
class LeadController {
    /**
     * Listar leads com filtros e paginação
     */
    async list(req, res) {
        try {
            const { page = 1, limit = 20, status, dataInicio, dataFim, vendedorId, categoria, search, sortBy = 'created_at', sortOrder = 'desc', } = req.query;
            const user = req.user;
            const skip = (Number(page) - 1) * Number(limit);
            const take = Number(limit);
            // Construir where clause
            const where = {};
            // Filtro por status
            if (status) {
                where.status = status;
            }
            // Filtro por data
            if (dataInicio || dataFim) {
                where.created_at = {};
                if (dataInicio) {
                    where.created_at.gte = new Date(dataInicio);
                }
                if (dataFim) {
                    where.created_at.lte = new Date(dataFim);
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
                    { nome: { contains: search } },
                    { email: { contains: search } },
                    { whatsapp: { contains: search } },
                ];
            }
            // Restrição de permissão: vendedores só veem seus próprios leads
            if (user.role === 'VENDEDOR') {
                where.vendedor_id = user.id;
            }
            // Buscar leads
            const [leads, total] = await Promise.all([
                prisma_1.prisma.lead.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { [sortBy]: sortOrder },
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
                prisma_1.prisma.lead.count({ where }),
            ]);
            // Adicionar flag de urgência (lead novo há menos de 2h)
            const leadsComUrgencia = leads.map((lead) => ({
                ...lead,
                urgente: lead.status === 'NOVO' && (0, date_fns_1.isAfter)((0, date_fns_1.addHours)(new Date(lead.created_at), 2), new Date()),
                slaVencendo: lead.status === 'NOVO' && (0, date_fns_1.isAfter)((0, date_fns_1.addHours)(new Date(lead.created_at), 4), new Date()),
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
        }
        catch (error) {
            console.error('List leads error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter detalhes de um lead
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const lead = await prisma_1.prisma.lead.findUnique({
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
        }
        catch (error) {
            console.error('Get lead error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Criar novo lead (público, do site)
     */
    async create(req, res) {
        try {
            const { nome, email, whatsapp, tipo_negociacao, valor_entrada, prazo_meses, mensagem, preferencia_contato, veiculo_id, aceita_privacidade, } = req.body;
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
            const veiculo = await prisma_1.prisma.veiculo.findUnique({
                where: { id: veiculo_id },
            });
            if (!veiculo) {
                return res.status(404).json({ error: 'Veículo não encontrado' });
            }
            // Verificar lead duplicado (mesmo email + whatsapp + veículo em menos de 24h)
            const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const leadExistente = await prisma_1.prisma.lead.findFirst({
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
            const lead = await prisma_1.prisma.lead.create({
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
            const atribuicao = await matching_service_1.matchingService.deveAtribuirAutomaticamente(veiculo_id);
            if (atribuicao.deveAtribuir && atribuicao.vendedorId) {
                await prisma_1.prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        vendedor_id: atribuicao.vendedorId,
                        atribuicao_tipo: 'SISTEMA',
                        status: 'EM_ATENDIMENTO',
                    },
                });
                // Criar atividade
                await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Create lead error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Atualizar lead
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { status, vendedor_id, mensagem } = req.body;
            // Verificar se lead existe
            const lead = await prisma_1.prisma.lead.findUnique({
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
            const updateData = {};
            if (status) {
                updateData.status = status;
            }
            if (vendedor_id !== undefined) {
                updateData.vendedor_id = vendedor_id;
                updateData.atribuicao_tipo = 'MANUAL';
            }
            const leadAtualizado = await prisma_1.prisma.lead.update({
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
                await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Update lead error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Arquivar lead (soft delete)
     */
    async archive(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const lead = await prisma_1.prisma.lead.findUnique({
                where: { id },
            });
            if (!lead) {
                return res.status(404).json({ error: 'Lead não encontrado' });
            }
            // Verificar permissões
            if (user.role === 'VENDEDOR' && lead.vendedor_id !== user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            await prisma_1.prisma.lead.update({
                where: { id },
                data: { status: 'ARQUIVADO' },
            });
            // Criar atividade
            await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Archive lead error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter recomendações de vendedores para um lead
     */
    async getRecomendacoes(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            // Verificar permissão (apenas admin e gerente)
            if (user.role === 'VENDEDOR') {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const lead = await prisma_1.prisma.lead.findUnique({
                where: { id },
                include: { veiculo: true },
            });
            if (!lead) {
                return res.status(404).json({ error: 'Lead não encontrado' });
            }
            const recomendacoes = await matching_service_1.matchingService.getTopRecomendacoes(lead.veiculo_id, 3);
            return res.json({
                success: true,
                data: recomendacoes,
            });
        }
        catch (error) {
            console.error('Get recomendacoes error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Atribuir vendedor a um lead
     */
    async atribuirVendedor(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { vendedor_id } = req.body;
            // Verificar permissão (apenas admin e gerente podem atribuir)
            if (user.role === 'VENDEDOR') {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            if (!vendedor_id) {
                return res.status(400).json({ error: 'ID do vendedor é obrigatório' });
            }
            // Verificar se lead existe
            const lead = await prisma_1.prisma.lead.findUnique({
                where: { id },
            });
            if (!lead) {
                return res.status(404).json({ error: 'Lead não encontrado' });
            }
            // Verificar se vendedor existe e está ativo
            const vendedor = await prisma_1.prisma.user.findFirst({
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
            const leadAtualizado = await prisma_1.prisma.lead.update({
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
            await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Atribuir vendedor error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Adicionar atividade a um lead
     */
    async addAtividade(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { tipo, descricao } = req.body;
            if (!tipo || !descricao) {
                return res.status(400).json({ error: 'Tipo e descrição são obrigatórios' });
            }
            const lead = await prisma_1.prisma.lead.findUnique({
                where: { id },
            });
            if (!lead) {
                return res.status(404).json({ error: 'Lead não encontrado' });
            }
            // Verificar permissão
            if (user.role === 'VENDEDOR' && lead.vendedor_id !== user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const atividade = await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Add atividade error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}
exports.LeadController = LeadController;
exports.leadController = new LeadController();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVhZC5jb250cm9sbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnRyb2xsZXJzL2xlYWQuY29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwwQ0FBdUM7QUFFdkMsbUVBQStEO0FBQy9ELHVDQUE2QztBQUU3QyxNQUFhLGNBQWM7SUFDekI7O09BRUc7SUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQXlCLEVBQUUsR0FBYTtRQUNqRCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQ0osSUFBSSxHQUFHLENBQUMsRUFDUixLQUFLLEdBQUcsRUFBRSxFQUNWLE1BQU0sRUFDTixVQUFVLEVBQ1YsT0FBTyxFQUNQLFVBQVUsRUFDVixTQUFTLEVBQ1QsTUFBTSxFQUNOLE1BQU0sR0FBRyxZQUFZLEVBQ3JCLFNBQVMsR0FBRyxNQUFNLEdBQ25CLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztZQUVkLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFLLENBQUM7WUFDdkIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUUzQix5QkFBeUI7WUFDekIsTUFBTSxLQUFLLEdBQVEsRUFBRSxDQUFDO1lBRXRCLG9CQUFvQjtZQUNwQixJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUNYLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQ3hCLENBQUM7WUFFRCxrQkFBa0I7WUFDbEIsSUFBSSxVQUFVLElBQUksT0FBTyxFQUFFLENBQUM7Z0JBQzFCLEtBQUssQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO2dCQUN0QixJQUFJLFVBQVUsRUFBRSxDQUFDO29CQUNmLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxHQUFHLElBQUksSUFBSSxDQUFDLFVBQW9CLENBQUMsQ0FBQztnQkFDeEQsQ0FBQztnQkFDRCxJQUFJLE9BQU8sRUFBRSxDQUFDO29CQUNaLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxHQUFHLElBQUksSUFBSSxDQUFDLE9BQWlCLENBQUMsQ0FBQztnQkFDckQsQ0FBQztZQUNILENBQUM7WUFFRCxzQkFBc0I7WUFDdEIsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDZixLQUFLLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztZQUNqQyxDQUFDO1lBRUQscUNBQXFDO1lBQ3JDLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQ2QsS0FBSyxDQUFDLE9BQU8sR0FBRztvQkFDZCxTQUFTLEVBQUUsU0FBUztpQkFDckIsQ0FBQztZQUNKLENBQUM7WUFFRCxvQ0FBb0M7WUFDcEMsSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDWCxLQUFLLENBQUMsRUFBRSxHQUFHO29CQUNULEVBQUUsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLE1BQWdCLEVBQUUsRUFBRTtvQkFDeEMsRUFBRSxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsTUFBZ0IsRUFBRSxFQUFFO29CQUN6QyxFQUFFLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFnQixFQUFFLEVBQUU7aUJBQzdDLENBQUM7WUFDSixDQUFDO1lBRUQsaUVBQWlFO1lBQ2pFLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxVQUFVLEVBQUUsQ0FBQztnQkFDN0IsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzlCLENBQUM7WUFFRCxlQUFlO1lBQ2YsTUFBTSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7Z0JBQ3ZDLGVBQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO29CQUNuQixLQUFLO29CQUNMLElBQUk7b0JBQ0osSUFBSTtvQkFDSixPQUFPLEVBQUUsRUFBRSxDQUFDLE1BQWdCLENBQUMsRUFBRSxTQUFTLEVBQUU7b0JBQzFDLE9BQU8sRUFBRTt3QkFDUCxPQUFPLEVBQUU7NEJBQ1AsTUFBTSxFQUFFO2dDQUNOLEVBQUUsRUFBRSxJQUFJO2dDQUNSLEtBQUssRUFBRSxJQUFJO2dDQUNYLE1BQU0sRUFBRSxJQUFJO2dDQUNaLFVBQVUsRUFBRSxJQUFJO2dDQUNoQixXQUFXLEVBQUUsSUFBSTtnQ0FDakIsU0FBUyxFQUFFLElBQUk7Z0NBQ2YsS0FBSyxFQUFFO29DQUNMLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUU7b0NBQ25CLElBQUksRUFBRSxDQUFDO29DQUNQLE1BQU0sRUFBRSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUU7aUNBQ3RCOzZCQUNGO3lCQUNGO3dCQUNELFFBQVEsRUFBRTs0QkFDUixNQUFNLEVBQUU7Z0NBQ04sRUFBRSxFQUFFLElBQUk7Z0NBQ1IsSUFBSSxFQUFFLElBQUk7Z0NBQ1YsUUFBUSxFQUFFLElBQUk7Z0NBQ2QsS0FBSyxFQUFFLElBQUk7NkJBQ1o7eUJBQ0Y7d0JBQ0QsVUFBVSxFQUFFOzRCQUNWLE1BQU0sRUFBRTtnQ0FDTixFQUFFLEVBQUUsSUFBSTtnQ0FDUixNQUFNLEVBQUUsSUFBSTs2QkFDYjt5QkFDRjtxQkFDRjtpQkFDRixDQUFDO2dCQUNGLGVBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7YUFDN0IsQ0FBQyxDQUFDO1lBRUgsd0RBQXdEO1lBQ3hELE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDNUMsR0FBRyxJQUFJO2dCQUNQLE9BQU8sRUFBRSxJQUFJLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxJQUFBLGtCQUFPLEVBQUMsSUFBQSxtQkFBUSxFQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUM5RixXQUFXLEVBQUUsSUFBSSxDQUFDLE1BQU0sS0FBSyxNQUFNLElBQUksSUFBQSxrQkFBTyxFQUFDLElBQUEsbUJBQVEsRUFBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQzthQUNuRyxDQUFDLENBQUMsQ0FBQztZQUVKLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztnQkFDZCxPQUFPLEVBQUUsSUFBSTtnQkFDYixJQUFJLEVBQUUsZ0JBQWdCO2dCQUN0QixJQUFJLEVBQUU7b0JBQ0osSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0JBQ2xCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDO29CQUNwQixLQUFLO29CQUNMLFVBQVUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQzdDO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzFDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQXlCLEVBQUUsR0FBYTtRQUNwRCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztZQUMxQixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSyxDQUFDO1lBRXZCLE1BQU0sSUFBSSxHQUFHLE1BQU0sZUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7Z0JBQ3hDLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRTtnQkFDYixPQUFPLEVBQUU7b0JBQ1AsT0FBTyxFQUFFO3dCQUNQLE9BQU8sRUFBRTs0QkFDUCxLQUFLLEVBQUU7Z0NBQ0wsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTs2QkFDMUI7eUJBQ0Y7cUJBQ0Y7b0JBQ0QsUUFBUSxFQUFFO3dCQUNSLE1BQU0sRUFBRTs0QkFDTixFQUFFLEVBQUUsSUFBSTs0QkFDUixJQUFJLEVBQUUsSUFBSTs0QkFDVixLQUFLLEVBQUUsSUFBSTs0QkFDWCxRQUFRLEVBQUUsSUFBSTs0QkFDZCxRQUFRLEVBQUUsSUFBSTs0QkFDZCxLQUFLLEVBQUUsSUFBSTt5QkFDWjtxQkFDRjtvQkFDRCxVQUFVLEVBQUU7d0JBQ1YsT0FBTyxFQUFFOzRCQUNQLFNBQVMsRUFBRTtnQ0FDVCxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFOzZCQUMxQjs0QkFDRCxVQUFVLEVBQUUsSUFBSTt5QkFDakI7cUJBQ0Y7b0JBQ0QsVUFBVSxFQUFFO3dCQUNWLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7d0JBQ3pCLE9BQU8sRUFBRTs0QkFDUCxJQUFJLEVBQUU7Z0NBQ0osTUFBTSxFQUFFO29DQUNOLElBQUksRUFBRSxJQUFJO29DQUNWLFFBQVEsRUFBRSxJQUFJO2lDQUNmOzZCQUNGO3lCQUNGO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNWLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLENBQUM7WUFFRCxzQkFBc0I7WUFDdEIsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDN0QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO1lBQzFELENBQUM7WUFFRCxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7Z0JBQ2QsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsSUFBSSxFQUFFLElBQUk7YUFDWCxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDeEMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSwwQkFBMEIsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBWSxFQUFFLEdBQWE7UUFDdEMsSUFBSSxDQUFDO1lBQ0gsTUFBTSxFQUNKLElBQUksRUFDSixLQUFLLEVBQ0wsUUFBUSxFQUNSLGVBQWUsRUFDZixhQUFhLEVBQ2IsV0FBVyxFQUNYLFFBQVEsRUFDUixtQkFBbUIsRUFDbkIsVUFBVSxFQUNWLGtCQUFrQixHQUNuQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFFYixhQUFhO1lBQ2IsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUM3QixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLDBDQUEwQyxFQUFFLENBQUMsQ0FBQztZQUNyRixDQUFDO1lBRUQsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDbkMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7WUFDM0QsQ0FBQztZQUVELElBQUksQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sR0FBRyxFQUFFLEVBQUUsQ0FBQztnQkFDdEMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxDQUFDLENBQUM7WUFDOUQsQ0FBQztZQUVELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDaEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxvQ0FBb0MsRUFBRSxDQUFDLENBQUM7WUFDL0UsQ0FBQztZQUVELElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUN4QixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLGdEQUFnRCxFQUFFLENBQUMsQ0FBQztZQUMzRixDQUFDO1lBRUQsOEJBQThCO1lBQzlCLE1BQU0sT0FBTyxHQUFHLE1BQU0sZUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7Z0JBQzlDLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxVQUFVLEVBQUU7YUFDMUIsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNiLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDO1lBQ25FLENBQUM7WUFFRCw4RUFBOEU7WUFDOUUsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDekUsTUFBTSxhQUFhLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDaEQsS0FBSyxFQUFFO29CQUNMLEtBQUs7b0JBQ0wsUUFBUTtvQkFDUixVQUFVO29CQUNWLFVBQVUsRUFBRTt3QkFDVixHQUFHLEVBQUUscUJBQXFCO3FCQUMzQjtpQkFDRjthQUNGLENBQUMsQ0FBQztZQUVILElBQUksYUFBYSxFQUFFLENBQUM7Z0JBQ2xCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7b0JBQzFCLEtBQUssRUFBRSxvRUFBb0U7b0JBQzNFLE1BQU0sRUFBRSxhQUFhLENBQUMsRUFBRTtpQkFDekIsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztZQUVELGFBQWE7WUFDYixNQUFNLElBQUksR0FBRyxNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUNwQyxJQUFJLEVBQUU7b0JBQ0osSUFBSTtvQkFDSixLQUFLO29CQUNMLFFBQVE7b0JBQ1IsZUFBZTtvQkFDZixhQUFhLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7b0JBQzNELFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtvQkFDckQsUUFBUTtvQkFDUixtQkFBbUIsRUFBRSxtQkFBbUIsSUFBSSxDQUFDLFVBQVUsQ0FBQztvQkFDeEQsVUFBVTtvQkFDVixTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUU7b0JBQ2pCLFVBQVUsRUFBRSxHQUFHLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztvQkFDckMsTUFBTSxFQUFFLE1BQU07aUJBQ2Y7Z0JBQ0QsT0FBTyxFQUFFO29CQUNQLE9BQU8sRUFBRTt3QkFDUCxNQUFNLEVBQUU7NEJBQ04sS0FBSyxFQUFFLElBQUk7NEJBQ1gsTUFBTSxFQUFFLElBQUk7eUJBQ2I7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDLENBQUM7WUFFSCwrQkFBK0I7WUFDL0IsTUFBTSxVQUFVLEdBQUcsTUFBTSxrQ0FBZSxDQUFDLDJCQUEyQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBRWpGLElBQUksVUFBVSxDQUFDLFlBQVksSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ3JELE1BQU0sZUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7b0JBQ3ZCLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO29CQUN0QixJQUFJLEVBQUU7d0JBQ0osV0FBVyxFQUFFLFVBQVUsQ0FBQyxVQUFVO3dCQUNsQyxlQUFlLEVBQUUsU0FBUzt3QkFDMUIsTUFBTSxFQUFFLGdCQUFnQjtxQkFDekI7aUJBQ0YsQ0FBQyxDQUFDO2dCQUVILGtCQUFrQjtnQkFDbEIsTUFBTSxlQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztvQkFDNUIsSUFBSSxFQUFFO3dCQUNKLElBQUksRUFBRSxTQUFTO3dCQUNmLFNBQVMsRUFBRSw0Q0FBNEM7d0JBQ3ZELE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBRTt3QkFDaEIsT0FBTyxFQUFFLFVBQVUsQ0FBQyxVQUFVO3FCQUMvQjtpQkFDRixDQUFDLENBQUM7WUFDTCxDQUFDO1lBRUQsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDMUIsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsT0FBTyxFQUFFLHlFQUF5RTtnQkFDbEYsSUFBSSxFQUFFO29CQUNKLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtvQkFDWCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7b0JBQ2YsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO29CQUNyQix3QkFBd0IsRUFBRSxVQUFVLENBQUMsWUFBWTtpQkFDbEQ7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDM0MsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSwwQkFBMEIsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBeUIsRUFBRSxHQUFhO1FBQ25ELElBQUksQ0FBQztZQUNILE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO1lBQzFCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFLLENBQUM7WUFDdkIsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztZQUVuRCwyQkFBMkI7WUFDM0IsTUFBTSxJQUFJLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztnQkFDeEMsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNWLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLENBQUM7WUFFRCx1QkFBdUI7WUFDdkIsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDN0QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO1lBQzFELENBQUM7WUFFRCxpQkFBaUI7WUFDakIsTUFBTSxVQUFVLEdBQVEsRUFBRSxDQUFDO1lBRTNCLElBQUksTUFBTSxFQUFFLENBQUM7Z0JBQ1gsVUFBVSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7WUFDN0IsQ0FBQztZQUVELElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUM5QixVQUFVLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztnQkFDckMsVUFBVSxDQUFDLGVBQWUsR0FBRyxRQUFRLENBQUM7WUFDeEMsQ0FBQztZQUVELE1BQU0sY0FBYyxHQUFHLE1BQU0sZUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7Z0JBQzlDLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRTtnQkFDYixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsT0FBTyxFQUFFO29CQUNQLE9BQU8sRUFBRTt3QkFDUCxNQUFNLEVBQUU7NEJBQ04sS0FBSyxFQUFFLElBQUk7NEJBQ1gsTUFBTSxFQUFFLElBQUk7eUJBQ2I7cUJBQ0Y7b0JBQ0QsUUFBUSxFQUFFO3dCQUNSLE1BQU0sRUFBRTs0QkFDTixJQUFJLEVBQUUsSUFBSTt5QkFDWDtxQkFDRjtpQkFDRjthQUNGLENBQUMsQ0FBQztZQUVILDhDQUE4QztZQUM5QyxJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUNYLE1BQU0sZUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7b0JBQzVCLElBQUksRUFBRTt3QkFDSixJQUFJLEVBQUUsUUFBUTt3QkFDZCxTQUFTLEVBQUUseUJBQXlCLE1BQU0sRUFBRTt3QkFDNUMsT0FBTyxFQUFFLEVBQUU7d0JBQ1gsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFO3FCQUNqQjtpQkFDRixDQUFDLENBQUM7WUFDTCxDQUFDO1lBRUQsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUNkLE9BQU8sRUFBRSxJQUFJO2dCQUNiLElBQUksRUFBRSxjQUFjO2FBQ3JCLENBQUMsQ0FBQztRQUNMLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMzQyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUF5QixFQUFFLEdBQWE7UUFDcEQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxFQUFFLEVBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7WUFDMUIsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUssQ0FBQztZQUV2QixNQUFNLElBQUksR0FBRyxNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO2dCQUN4QyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUU7YUFDZCxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ1YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxxQkFBcUIsRUFBRSxDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUVELHVCQUF1QjtZQUN2QixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUM3RCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUM7WUFDMUQsQ0FBQztZQUVELE1BQU0sZUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7Z0JBQ3ZCLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRTtnQkFDYixJQUFJLEVBQUUsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO2FBQzlCLENBQUMsQ0FBQztZQUVILGtCQUFrQjtZQUNsQixNQUFNLGVBQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO2dCQUM1QixJQUFJLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFNBQVM7b0JBQ2YsU0FBUyxFQUFFLGdCQUFnQjtvQkFDM0IsT0FBTyxFQUFFLEVBQUU7b0JBQ1gsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFO2lCQUNqQjthQUNGLENBQUMsQ0FBQztZQUVILE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztnQkFDZCxPQUFPLEVBQUUsSUFBSTtnQkFDYixPQUFPLEVBQUUsNEJBQTRCO2FBQ3RDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM1QyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGdCQUFnQixDQUFDLEdBQXlCLEVBQUUsR0FBYTtRQUM3RCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztZQUMxQixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSyxDQUFDO1lBRXZCLCtDQUErQztZQUMvQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQzdCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLENBQUMsQ0FBQztZQUMxRCxDQUFDO1lBRUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztnQkFDeEMsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFO2dCQUNiLE9BQU8sRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDM0IsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNWLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLENBQUM7WUFFRCxNQUFNLGFBQWEsR0FBRyxNQUFNLGtDQUFlLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUVwRixPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7Z0JBQ2QsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsSUFBSSxFQUFFLGFBQWE7YUFDcEIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLDBCQUEwQixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2pELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsR0FBeUIsRUFBRSxHQUFhO1FBQzdELElBQUksQ0FBQztZQUNILE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO1lBQzFCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFLLENBQUM7WUFDdkIsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFFakMsOERBQThEO1lBQzlELElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxVQUFVLEVBQUUsQ0FBQztnQkFDN0IsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO1lBQzFELENBQUM7WUFFRCxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2pCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsOEJBQThCLEVBQUUsQ0FBQyxDQUFDO1lBQ3pFLENBQUM7WUFFRCwyQkFBMkI7WUFDM0IsTUFBTSxJQUFJLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztnQkFDeEMsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNWLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLENBQUM7WUFFRCw0Q0FBNEM7WUFDNUMsTUFBTSxRQUFRLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDM0MsS0FBSyxFQUFFO29CQUNMLEVBQUUsRUFBRSxXQUFXO29CQUNmLElBQUksRUFBRSxVQUFVO29CQUNoQixNQUFNLEVBQUUsT0FBTztpQkFDaEI7YUFDRixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ2QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxvQ0FBb0MsRUFBRSxDQUFDLENBQUM7WUFDL0UsQ0FBQztZQUVELGlCQUFpQjtZQUNqQixNQUFNLGNBQWMsR0FBRyxNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUM5QyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUU7Z0JBQ2IsSUFBSSxFQUFFO29CQUNKLFdBQVc7b0JBQ1gsZUFBZSxFQUFFLFFBQVE7b0JBQ3pCLE1BQU0sRUFBRSxnQkFBZ0I7aUJBQ3pCO2dCQUNELE9BQU8sRUFBRTtvQkFDUCxPQUFPLEVBQUU7d0JBQ1AsTUFBTSxFQUFFOzRCQUNOLEtBQUssRUFBRSxJQUFJOzRCQUNYLE1BQU0sRUFBRSxJQUFJO3lCQUNiO3FCQUNGO29CQUNELFFBQVEsRUFBRTt3QkFDUixNQUFNLEVBQUU7NEJBQ04sSUFBSSxFQUFFLElBQUk7NEJBQ1YsS0FBSyxFQUFFLElBQUk7eUJBQ1o7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDLENBQUM7WUFFSCxrQkFBa0I7WUFDbEIsTUFBTSxlQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsSUFBSSxFQUFFO29CQUNKLElBQUksRUFBRSxZQUFZO29CQUNsQixTQUFTLEVBQUUsb0JBQW9CLFFBQVEsQ0FBQyxJQUFJLEVBQUU7b0JBQzlDLE9BQU8sRUFBRSxFQUFFO29CQUNYLE9BQU8sRUFBRSxXQUFXO2lCQUNyQjthQUNGLENBQUMsQ0FBQztZQUVILE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztnQkFDZCxPQUFPLEVBQUUsSUFBSTtnQkFDYixPQUFPLEVBQUUsZ0NBQWdDLFFBQVEsQ0FBQyxJQUFJLEVBQUU7Z0JBQ3hELElBQUksRUFBRSxjQUFjO2FBQ3JCLENBQUMsQ0FBQztRQUNMLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQywwQkFBMEIsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNqRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFlBQVksQ0FBQyxHQUF5QixFQUFFLEdBQWE7UUFDekQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxFQUFFLEVBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7WUFDMUIsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUssQ0FBQztZQUN2QixNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFFckMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUN4QixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLG1DQUFtQyxFQUFFLENBQUMsQ0FBQztZQUM5RSxDQUFDO1lBRUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztnQkFDeEMsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNWLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLENBQUM7WUFFRCxzQkFBc0I7WUFDdEIsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDN0QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO1lBQzFELENBQUM7WUFFRCxNQUFNLFNBQVMsR0FBRyxNQUFNLGVBQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO2dCQUM5QyxJQUFJLEVBQUU7b0JBQ0osSUFBSTtvQkFDSixTQUFTO29CQUNULE9BQU8sRUFBRSxFQUFFO29CQUNYLE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBRTtpQkFDakI7Z0JBQ0QsT0FBTyxFQUFFO29CQUNQLElBQUksRUFBRTt3QkFDSixNQUFNLEVBQUU7NEJBQ04sSUFBSSxFQUFFLElBQUk7NEJBQ1YsUUFBUSxFQUFFLElBQUk7eUJBQ2Y7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDLENBQUM7WUFFSCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO2dCQUMxQixPQUFPLEVBQUUsSUFBSTtnQkFDYixJQUFJLEVBQUUsU0FBUzthQUNoQixDQUFDLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDN0MsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSwwQkFBMEIsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztJQUNILENBQUM7Q0FDRjtBQXBuQkQsd0NBb25CQztBQUVZLFFBQUEsY0FBYyxHQUFHLElBQUksY0FBYyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSAnLi4vbGliL3ByaXNtYSc7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGVkUmVxdWVzdCwgTGVhZEZpbHRlcnMgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBtYXRjaGluZ1NlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9tYXRjaGluZy5zZXJ2aWNlJztcbmltcG9ydCB7IGFkZEhvdXJzLCBpc0FmdGVyIH0gZnJvbSAnZGF0ZS1mbnMnO1xuXG5leHBvcnQgY2xhc3MgTGVhZENvbnRyb2xsZXIge1xuICAvKipcbiAgICogTGlzdGFyIGxlYWRzIGNvbSBmaWx0cm9zIGUgcGFnaW5hw6fDo29cbiAgICovXG4gIGFzeW5jIGxpc3QocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIHBhZ2UgPSAxLFxuICAgICAgICBsaW1pdCA9IDIwLFxuICAgICAgICBzdGF0dXMsXG4gICAgICAgIGRhdGFJbmljaW8sXG4gICAgICAgIGRhdGFGaW0sXG4gICAgICAgIHZlbmRlZG9ySWQsXG4gICAgICAgIGNhdGVnb3JpYSxcbiAgICAgICAgc2VhcmNoLFxuICAgICAgICBzb3J0QnkgPSAnY3JlYXRlZF9hdCcsXG4gICAgICAgIHNvcnRPcmRlciA9ICdkZXNjJyxcbiAgICAgIH0gPSByZXEucXVlcnk7XG5cbiAgICAgIGNvbnN0IHVzZXIgPSByZXEudXNlciE7XG4gICAgICBjb25zdCBza2lwID0gKE51bWJlcihwYWdlKSAtIDEpICogTnVtYmVyKGxpbWl0KTtcbiAgICAgIGNvbnN0IHRha2UgPSBOdW1iZXIobGltaXQpO1xuXG4gICAgICAvLyBDb25zdHJ1aXIgd2hlcmUgY2xhdXNlXG4gICAgICBjb25zdCB3aGVyZTogYW55ID0ge307XG5cbiAgICAgIC8vIEZpbHRybyBwb3Igc3RhdHVzXG4gICAgICBpZiAoc3RhdHVzKSB7XG4gICAgICAgIHdoZXJlLnN0YXR1cyA9IHN0YXR1cztcbiAgICAgIH1cblxuICAgICAgLy8gRmlsdHJvIHBvciBkYXRhXG4gICAgICBpZiAoZGF0YUluaWNpbyB8fCBkYXRhRmltKSB7XG4gICAgICAgIHdoZXJlLmNyZWF0ZWRfYXQgPSB7fTtcbiAgICAgICAgaWYgKGRhdGFJbmljaW8pIHtcbiAgICAgICAgICB3aGVyZS5jcmVhdGVkX2F0Lmd0ZSA9IG5ldyBEYXRlKGRhdGFJbmljaW8gYXMgc3RyaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YUZpbSkge1xuICAgICAgICAgIHdoZXJlLmNyZWF0ZWRfYXQubHRlID0gbmV3IERhdGUoZGF0YUZpbSBhcyBzdHJpbmcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEZpbHRybyBwb3IgdmVuZGVkb3JcbiAgICAgIGlmICh2ZW5kZWRvcklkKSB7XG4gICAgICAgIHdoZXJlLnZlbmRlZG9yX2lkID0gdmVuZGVkb3JJZDtcbiAgICAgIH1cblxuICAgICAgLy8gRmlsdHJvIHBvciBjYXRlZ29yaWEgKHZpYSB2ZcOtY3VsbylcbiAgICAgIGlmIChjYXRlZ29yaWEpIHtcbiAgICAgICAgd2hlcmUudmVpY3VsbyA9IHtcbiAgICAgICAgICBjYXRlZ29yaWE6IGNhdGVnb3JpYSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgLy8gQnVzY2EgcG9yIG5vbWUsIGVtYWlsIG91IHRlbGVmb25lXG4gICAgICBpZiAoc2VhcmNoKSB7XG4gICAgICAgIHdoZXJlLk9SID0gW1xuICAgICAgICAgIHsgbm9tZTogeyBjb250YWluczogc2VhcmNoIGFzIHN0cmluZyB9IH0sXG4gICAgICAgICAgeyBlbWFpbDogeyBjb250YWluczogc2VhcmNoIGFzIHN0cmluZyB9IH0sXG4gICAgICAgICAgeyB3aGF0c2FwcDogeyBjb250YWluczogc2VhcmNoIGFzIHN0cmluZyB9IH0sXG4gICAgICAgIF07XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc3RyacOnw6NvIGRlIHBlcm1pc3PDo286IHZlbmRlZG9yZXMgc8OzIHZlZW0gc2V1cyBwcsOzcHJpb3MgbGVhZHNcbiAgICAgIGlmICh1c2VyLnJvbGUgPT09ICdWRU5ERURPUicpIHtcbiAgICAgICAgd2hlcmUudmVuZGVkb3JfaWQgPSB1c2VyLmlkO1xuICAgICAgfVxuXG4gICAgICAvLyBCdXNjYXIgbGVhZHNcbiAgICAgIGNvbnN0IFtsZWFkcywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICBwcmlzbWEubGVhZC5maW5kTWFueSh7XG4gICAgICAgICAgd2hlcmUsXG4gICAgICAgICAgc2tpcCxcbiAgICAgICAgICB0YWtlLFxuICAgICAgICAgIG9yZGVyQnk6IHsgW3NvcnRCeSBhcyBzdHJpbmddOiBzb3J0T3JkZXIgfSxcbiAgICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgICB2ZWljdWxvOiB7XG4gICAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1hcmNhOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1vZGVsbzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhbm9fbW9kZWxvOiB0cnVlLFxuICAgICAgICAgICAgICAgIHByZWNvX3ZlbmRhOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNhdGVnb3JpYTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBmb3Rvczoge1xuICAgICAgICAgICAgICAgICAgd2hlcmU6IHsgb3JkZW06IDAgfSxcbiAgICAgICAgICAgICAgICAgIHRha2U6IDEsXG4gICAgICAgICAgICAgICAgICBzZWxlY3Q6IHsgdXJsOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2ZW5kZWRvcjoge1xuICAgICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgICAgICAgIGZvdG9fdXJsOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5pdmVsOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5lZ29jaWFjYW86IHtcbiAgICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgcHJpc21hLmxlYWQuY291bnQoeyB3aGVyZSB9KSxcbiAgICAgIF0pO1xuXG4gICAgICAvLyBBZGljaW9uYXIgZmxhZyBkZSB1cmfDqm5jaWEgKGxlYWQgbm92byBow6EgbWVub3MgZGUgMmgpXG4gICAgICBjb25zdCBsZWFkc0NvbVVyZ2VuY2lhID0gbGVhZHMubWFwKChsZWFkKSA9PiAoe1xuICAgICAgICAuLi5sZWFkLFxuICAgICAgICB1cmdlbnRlOiBsZWFkLnN0YXR1cyA9PT0gJ05PVk8nICYmIGlzQWZ0ZXIoYWRkSG91cnMobmV3IERhdGUobGVhZC5jcmVhdGVkX2F0KSwgMiksIG5ldyBEYXRlKCkpLFxuICAgICAgICBzbGFWZW5jZW5kbzogbGVhZC5zdGF0dXMgPT09ICdOT1ZPJyAmJiBpc0FmdGVyKGFkZEhvdXJzKG5ldyBEYXRlKGxlYWQuY3JlYXRlZF9hdCksIDQpLCBuZXcgRGF0ZSgpKSxcbiAgICAgIH0pKTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogbGVhZHNDb21VcmdlbmNpYSxcbiAgICAgICAgbWV0YToge1xuICAgICAgICAgIHBhZ2U6IE51bWJlcihwYWdlKSxcbiAgICAgICAgICBsaW1pdDogTnVtYmVyKGxpbWl0KSxcbiAgICAgICAgICB0b3RhbCxcbiAgICAgICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBOdW1iZXIobGltaXQpKSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdMaXN0IGxlYWRzIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgZGV0YWxoZXMgZGUgdW0gbGVhZFxuICAgKi9cbiAgYXN5bmMgZ2V0QnlJZChyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgICBjb25zdCB1c2VyID0gcmVxLnVzZXIhO1xuXG4gICAgICBjb25zdCBsZWFkID0gYXdhaXQgcHJpc21hLmxlYWQuZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB2ZWljdWxvOiB7XG4gICAgICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgICAgIGZvdG9zOiB7XG4gICAgICAgICAgICAgICAgb3JkZXJCeTogeyBvcmRlbTogJ2FzYycgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2ZW5kZWRvcjoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgICAgICAgdGVsZWZvbmU6IHRydWUsXG4gICAgICAgICAgICAgIGZvdG9fdXJsOiB0cnVlLFxuICAgICAgICAgICAgICBuaXZlbDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBuZWdvY2lhY2FvOiB7XG4gICAgICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgICAgIHByb3Bvc3Rhczoge1xuICAgICAgICAgICAgICAgIG9yZGVyQnk6IHsgZGF0YTogJ2Rlc2MnIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGRvY3VtZW50b3M6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYXRpdmlkYWRlczoge1xuICAgICAgICAgICAgb3JkZXJCeTogeyBkYXRhOiAnZGVzYycgfSxcbiAgICAgICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICAgICAgdXNlcjoge1xuICAgICAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICAgICAgbm9tZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGZvdG9fdXJsOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFsZWFkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnTGVhZCBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8Ojb1xuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJyAmJiBsZWFkLnZlbmRlZG9yX2lkICE9PSB1c2VyLmlkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAnQWNlc3NvIG5lZ2FkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IGxlYWQsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignR2V0IGxlYWQgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmlhciBub3ZvIGxlYWQgKHDDumJsaWNvLCBkbyBzaXRlKVxuICAgKi9cbiAgYXN5bmMgY3JlYXRlKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vbWUsXG4gICAgICAgIGVtYWlsLFxuICAgICAgICB3aGF0c2FwcCxcbiAgICAgICAgdGlwb19uZWdvY2lhY2FvLFxuICAgICAgICB2YWxvcl9lbnRyYWRhLFxuICAgICAgICBwcmF6b19tZXNlcyxcbiAgICAgICAgbWVuc2FnZW0sXG4gICAgICAgIHByZWZlcmVuY2lhX2NvbnRhdG8sXG4gICAgICAgIHZlaWN1bG9faWQsXG4gICAgICAgIGFjZWl0YV9wcml2YWNpZGFkZSxcbiAgICAgIH0gPSByZXEuYm9keTtcblxuICAgICAgLy8gVmFsaWRhw6fDtWVzXG4gICAgICBpZiAoIW5vbWUgfHwgbm9tZS5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAnTm9tZSDDqSBvYnJpZ2F0w7NyaW8gKG3DrW5pbW8gMyBjYXJhY3RlcmVzKScgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghZW1haWwgfHwgIWVtYWlsLmluY2x1ZGVzKCdAJykpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdFbWFpbCBpbnbDoWxpZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXdoYXRzYXBwIHx8IHdoYXRzYXBwLmxlbmd0aCA8IDEwKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAnV2hhdHNBcHAgaW52w6FsaWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKCF2ZWljdWxvX2lkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAnVmXDrWN1bG8gZGUgaW50ZXJlc3NlIMOpIG9icmlnYXTDs3JpbycgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghYWNlaXRhX3ByaXZhY2lkYWRlKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAnw4kgbmVjZXNzw6FyaW8gYWNlaXRhciBhIHBvbMOtdGljYSBkZSBwcml2YWNpZGFkZScgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFZlcmlmaWNhciBzZSB2ZcOtY3VsbyBleGlzdGVcbiAgICAgIGNvbnN0IHZlaWN1bG8gPSBhd2FpdCBwcmlzbWEudmVpY3Vsby5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IHZlaWN1bG9faWQgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXZlaWN1bG8pIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdWZcOtY3VsbyBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgbGVhZCBkdXBsaWNhZG8gKG1lc21vIGVtYWlsICsgd2hhdHNhcHAgKyB2ZcOtY3VsbyBlbSBtZW5vcyBkZSAyNGgpXG4gICAgICBjb25zdCB2aW50ZVF1YXRyb0hvcmFzQXRyYXMgPSBuZXcgRGF0ZShEYXRlLm5vdygpIC0gMjQgKiA2MCAqIDYwICogMTAwMCk7XG4gICAgICBjb25zdCBsZWFkRXhpc3RlbnRlID0gYXdhaXQgcHJpc21hLmxlYWQuZmluZEZpcnN0KHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBlbWFpbCxcbiAgICAgICAgICB3aGF0c2FwcCxcbiAgICAgICAgICB2ZWljdWxvX2lkLFxuICAgICAgICAgIGNyZWF0ZWRfYXQ6IHtcbiAgICAgICAgICAgIGd0ZTogdmludGVRdWF0cm9Ib3Jhc0F0cmFzLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKGxlYWRFeGlzdGVudGUpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA5KS5qc29uKHtcbiAgICAgICAgICBlcnJvcjogJ1ZvY8OqIGrDoSBlbnZpb3UgdW1hIHByb3Bvc3RhIHBhcmEgZXN0ZSB2ZcOtY3VsbyBuYXMgw7psdGltYXMgMjQgaG9yYXMnLFxuICAgICAgICAgIGxlYWRJZDogbGVhZEV4aXN0ZW50ZS5pZCxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIENyaWFyIGxlYWRcbiAgICAgIGNvbnN0IGxlYWQgPSBhd2FpdCBwcmlzbWEubGVhZC5jcmVhdGUoe1xuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgbm9tZSxcbiAgICAgICAgICBlbWFpbCxcbiAgICAgICAgICB3aGF0c2FwcCxcbiAgICAgICAgICB0aXBvX25lZ29jaWFjYW8sXG4gICAgICAgICAgdmFsb3JfZW50cmFkYTogdmFsb3JfZW50cmFkYSA/IE51bWJlcih2YWxvcl9lbnRyYWRhKSA6IG51bGwsXG4gICAgICAgICAgcHJhem9fbWVzZXM6IHByYXpvX21lc2VzID8gTnVtYmVyKHByYXpvX21lc2VzKSA6IG51bGwsXG4gICAgICAgICAgbWVuc2FnZW0sXG4gICAgICAgICAgcHJlZmVyZW5jaWFfY29udGF0bzogcHJlZmVyZW5jaWFfY29udGF0byB8fCBbJ1dIQVRTQVBQJ10sXG4gICAgICAgICAgdmVpY3Vsb19pZCxcbiAgICAgICAgICBpcF9vcmlnZW06IHJlcS5pcCxcbiAgICAgICAgICB1c2VyX2FnZW50OiByZXEuaGVhZGVyc1sndXNlci1hZ2VudCddLFxuICAgICAgICAgIHN0YXR1czogJ05PVk8nLFxuICAgICAgICB9LFxuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgdmVpY3Vsbzoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIG1hcmNhOiB0cnVlLFxuICAgICAgICAgICAgICBtb2RlbG86IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gVGVudGFyIGF0cmlidWnDp8OjbyBhdXRvbcOhdGljYVxuICAgICAgY29uc3QgYXRyaWJ1aWNhbyA9IGF3YWl0IG1hdGNoaW5nU2VydmljZS5kZXZlQXRyaWJ1aXJBdXRvbWF0aWNhbWVudGUodmVpY3Vsb19pZCk7XG5cbiAgICAgIGlmIChhdHJpYnVpY2FvLmRldmVBdHJpYnVpciAmJiBhdHJpYnVpY2FvLnZlbmRlZG9ySWQpIHtcbiAgICAgICAgYXdhaXQgcHJpc21hLmxlYWQudXBkYXRlKHtcbiAgICAgICAgICB3aGVyZTogeyBpZDogbGVhZC5pZCB9LFxuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHZlbmRlZG9yX2lkOiBhdHJpYnVpY2FvLnZlbmRlZG9ySWQsXG4gICAgICAgICAgICBhdHJpYnVpY2FvX3RpcG86ICdTSVNURU1BJyxcbiAgICAgICAgICAgIHN0YXR1czogJ0VNX0FURU5ESU1FTlRPJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDcmlhciBhdGl2aWRhZGVcbiAgICAgICAgYXdhaXQgcHJpc21hLmF0aXZpZGFkZS5jcmVhdGUoe1xuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHRpcG86ICdTSVNURU1BJyxcbiAgICAgICAgICAgIGRlc2NyaWNhbzogYExlYWQgYXRyaWJ1w61kbyBhdXRvbWF0aWNhbWVudGUgYW8gdmVuZGVkb3JgLFxuICAgICAgICAgICAgbGVhZF9pZDogbGVhZC5pZCxcbiAgICAgICAgICAgIHVzZXJfaWQ6IGF0cmlidWljYW8udmVuZGVkb3JJZCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAxKS5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZTogJ1Byb3Bvc3RhIGVudmlhZGEgY29tIHN1Y2Vzc28hIE5vc3NhIGVxdWlwZSBlbnRyYXLDoSBlbSBjb250YXRvIGVtIGJyZXZlLicsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBpZDogbGVhZC5pZCxcbiAgICAgICAgICBub21lOiBsZWFkLm5vbWUsXG4gICAgICAgICAgdmVpY3VsbzogbGVhZC52ZWljdWxvLFxuICAgICAgICAgIGF0cmlidWlkb0F1dG9tYXRpY2FtZW50ZTogYXRyaWJ1aWNhby5kZXZlQXRyaWJ1aXIsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignQ3JlYXRlIGxlYWQgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBdHVhbGl6YXIgbGVhZFxuICAgKi9cbiAgYXN5bmMgdXBkYXRlKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBpZCB9ID0gcmVxLnBhcmFtcztcbiAgICAgIGNvbnN0IHVzZXIgPSByZXEudXNlciE7XG4gICAgICBjb25zdCB7IHN0YXR1cywgdmVuZGVkb3JfaWQsIG1lbnNhZ2VtIH0gPSByZXEuYm9keTtcblxuICAgICAgLy8gVmVyaWZpY2FyIHNlIGxlYWQgZXhpc3RlXG4gICAgICBjb25zdCBsZWFkID0gYXdhaXQgcHJpc21hLmxlYWQuZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFsZWFkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnTGVhZCBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8O1ZXNcbiAgICAgIGlmICh1c2VyLnJvbGUgPT09ICdWRU5ERURPUicgJiYgbGVhZC52ZW5kZWRvcl9pZCAhPT0gdXNlci5pZCkge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogJ0FjZXNzbyBuZWdhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBBdHVhbGl6YXIgbGVhZFxuICAgICAgY29uc3QgdXBkYXRlRGF0YTogYW55ID0ge307XG5cbiAgICAgIGlmIChzdGF0dXMpIHtcbiAgICAgICAgdXBkYXRlRGF0YS5zdGF0dXMgPSBzdGF0dXM7XG4gICAgICB9XG5cbiAgICAgIGlmICh2ZW5kZWRvcl9pZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHVwZGF0ZURhdGEudmVuZGVkb3JfaWQgPSB2ZW5kZWRvcl9pZDtcbiAgICAgICAgdXBkYXRlRGF0YS5hdHJpYnVpY2FvX3RpcG8gPSAnTUFOVUFMJztcbiAgICAgIH1cblxuICAgICAgY29uc3QgbGVhZEF0dWFsaXphZG8gPSBhd2FpdCBwcmlzbWEubGVhZC51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgICBkYXRhOiB1cGRhdGVEYXRhLFxuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgdmVpY3Vsbzoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIG1hcmNhOiB0cnVlLFxuICAgICAgICAgICAgICBtb2RlbG86IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZGVkb3I6IHtcbiAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIENyaWFyIGF0aXZpZGFkZSBzZSBob3V2ZXIgbXVkYW7Dp2EgZGUgc3RhdHVzXG4gICAgICBpZiAoc3RhdHVzKSB7XG4gICAgICAgIGF3YWl0IHByaXNtYS5hdGl2aWRhZGUuY3JlYXRlKHtcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICB0aXBvOiAnU1RBVFVTJyxcbiAgICAgICAgICAgIGRlc2NyaWNhbzogYFN0YXR1cyBhbHRlcmFkbyBwYXJhOiAke3N0YXR1c31gLFxuICAgICAgICAgICAgbGVhZF9pZDogaWQsXG4gICAgICAgICAgICB1c2VyX2lkOiB1c2VyLmlkLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBsZWFkQXR1YWxpemFkbyxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdVcGRhdGUgbGVhZCBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFycXVpdmFyIGxlYWQgKHNvZnQgZGVsZXRlKVxuICAgKi9cbiAgYXN5bmMgYXJjaGl2ZShyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgICBjb25zdCB1c2VyID0gcmVxLnVzZXIhO1xuXG4gICAgICBjb25zdCBsZWFkID0gYXdhaXQgcHJpc21hLmxlYWQuZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFsZWFkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnTGVhZCBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8O1ZXNcbiAgICAgIGlmICh1c2VyLnJvbGUgPT09ICdWRU5ERURPUicgJiYgbGVhZC52ZW5kZWRvcl9pZCAhPT0gdXNlci5pZCkge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogJ0FjZXNzbyBuZWdhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBwcmlzbWEubGVhZC51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogJ0FSUVVJVkFETycgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDcmlhciBhdGl2aWRhZGVcbiAgICAgIGF3YWl0IHByaXNtYS5hdGl2aWRhZGUuY3JlYXRlKHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHRpcG86ICdTSVNURU1BJyxcbiAgICAgICAgICBkZXNjcmljYW86ICdMZWFkIGFycXVpdmFkbycsXG4gICAgICAgICAgbGVhZF9pZDogaWQsXG4gICAgICAgICAgdXNlcl9pZDogdXNlci5pZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiAnTGVhZCBhcnF1aXZhZG8gY29tIHN1Y2Vzc28nLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FyY2hpdmUgbGVhZCBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9idGVyIHJlY29tZW5kYcOnw7VlcyBkZSB2ZW5kZWRvcmVzIHBhcmEgdW0gbGVhZFxuICAgKi9cbiAgYXN5bmMgZ2V0UmVjb21lbmRhY29lcyhyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgICBjb25zdCB1c2VyID0gcmVxLnVzZXIhO1xuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8OjbyAoYXBlbmFzIGFkbWluIGUgZ2VyZW50ZSlcbiAgICAgIGlmICh1c2VyLnJvbGUgPT09ICdWRU5ERURPUicpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICdBY2Vzc28gbmVnYWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbGVhZCA9IGF3YWl0IHByaXNtYS5sZWFkLmZpbmRVbmlxdWUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgICBpbmNsdWRlOiB7IHZlaWN1bG86IHRydWUgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIWxlYWQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdMZWFkIG7Do28gZW5jb250cmFkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlY29tZW5kYWNvZXMgPSBhd2FpdCBtYXRjaGluZ1NlcnZpY2UuZ2V0VG9wUmVjb21lbmRhY29lcyhsZWFkLnZlaWN1bG9faWQsIDMpO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiByZWNvbWVuZGFjb2VzLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0dldCByZWNvbWVuZGFjb2VzIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXRyaWJ1aXIgdmVuZGVkb3IgYSB1bSBsZWFkXG4gICAqL1xuICBhc3luYyBhdHJpYnVpclZlbmRlZG9yKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBpZCB9ID0gcmVxLnBhcmFtcztcbiAgICAgIGNvbnN0IHVzZXIgPSByZXEudXNlciE7XG4gICAgICBjb25zdCB7IHZlbmRlZG9yX2lkIH0gPSByZXEuYm9keTtcblxuICAgICAgLy8gVmVyaWZpY2FyIHBlcm1pc3PDo28gKGFwZW5hcyBhZG1pbiBlIGdlcmVudGUgcG9kZW0gYXRyaWJ1aXIpXG4gICAgICBpZiAodXNlci5yb2xlID09PSAnVkVOREVET1InKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAnQWNlc3NvIG5lZ2FkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghdmVuZGVkb3JfaWQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdJRCBkbyB2ZW5kZWRvciDDqSBvYnJpZ2F0w7NyaW8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgc2UgbGVhZCBleGlzdGVcbiAgICAgIGNvbnN0IGxlYWQgPSBhd2FpdCBwcmlzbWEubGVhZC5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIWxlYWQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdMZWFkIG7Do28gZW5jb250cmFkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFZlcmlmaWNhciBzZSB2ZW5kZWRvciBleGlzdGUgZSBlc3TDoSBhdGl2b1xuICAgICAgY29uc3QgdmVuZGVkb3IgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kRmlyc3Qoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIGlkOiB2ZW5kZWRvcl9pZCxcbiAgICAgICAgICByb2xlOiAnVkVOREVET1InLFxuICAgICAgICAgIHN0YXR1czogJ0FUSVZPJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXZlbmRlZG9yKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnVmVuZGVkb3IgbsOjbyBlbmNvbnRyYWRvIG91IGluYXRpdm8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBBdHVhbGl6YXIgbGVhZFxuICAgICAgY29uc3QgbGVhZEF0dWFsaXphZG8gPSBhd2FpdCBwcmlzbWEubGVhZC51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgdmVuZGVkb3JfaWQsXG4gICAgICAgICAgYXRyaWJ1aWNhb190aXBvOiAnTUFOVUFMJyxcbiAgICAgICAgICBzdGF0dXM6ICdFTV9BVEVORElNRU5UTycsXG4gICAgICAgIH0sXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB2ZWljdWxvOiB7XG4gICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgbWFyY2E6IHRydWUsXG4gICAgICAgICAgICAgIG1vZGVsbzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2ZW5kZWRvcjoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIG5vbWU6IHRydWUsXG4gICAgICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIENyaWFyIGF0aXZpZGFkZVxuICAgICAgYXdhaXQgcHJpc21hLmF0aXZpZGFkZS5jcmVhdGUoe1xuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgdGlwbzogJ0FUUklCVUlDQU8nLFxuICAgICAgICAgIGRlc2NyaWNhbzogYExlYWQgYXRyaWJ1w61kbyBhICR7dmVuZGVkb3Iubm9tZX1gLFxuICAgICAgICAgIGxlYWRfaWQ6IGlkLFxuICAgICAgICAgIHVzZXJfaWQ6IHZlbmRlZG9yX2lkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIG1lc3NhZ2U6IGBMZWFkIGF0cmlidcOtZG8gY29tIHN1Y2Vzc28gYSAke3ZlbmRlZG9yLm5vbWV9YCxcbiAgICAgICAgZGF0YTogbGVhZEF0dWFsaXphZG8sXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignQXRyaWJ1aXIgdmVuZGVkb3IgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGljaW9uYXIgYXRpdmlkYWRlIGEgdW0gbGVhZFxuICAgKi9cbiAgYXN5bmMgYWRkQXRpdmlkYWRlKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBpZCB9ID0gcmVxLnBhcmFtcztcbiAgICAgIGNvbnN0IHVzZXIgPSByZXEudXNlciE7XG4gICAgICBjb25zdCB7IHRpcG8sIGRlc2NyaWNhbyB9ID0gcmVxLmJvZHk7XG5cbiAgICAgIGlmICghdGlwbyB8fCAhZGVzY3JpY2FvKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAnVGlwbyBlIGRlc2NyacOnw6NvIHPDo28gb2JyaWdhdMOzcmlvcycgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxlYWQgPSBhd2FpdCBwcmlzbWEubGVhZC5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIWxlYWQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdMZWFkIG7Do28gZW5jb250cmFkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFZlcmlmaWNhciBwZXJtaXNzw6NvXG4gICAgICBpZiAodXNlci5yb2xlID09PSAnVkVOREVET1InICYmIGxlYWQudmVuZGVkb3JfaWQgIT09IHVzZXIuaWQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICdBY2Vzc28gbmVnYWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYXRpdmlkYWRlID0gYXdhaXQgcHJpc21hLmF0aXZpZGFkZS5jcmVhdGUoe1xuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgdGlwbyxcbiAgICAgICAgICBkZXNjcmljYW8sXG4gICAgICAgICAgbGVhZF9pZDogaWQsXG4gICAgICAgICAgdXNlcl9pZDogdXNlci5pZCxcbiAgICAgICAgfSxcbiAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgIHVzZXI6IHtcbiAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgICAgICBmb3RvX3VybDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLnN0YXR1cygyMDEpLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBhdGl2aWRhZGUsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignQWRkIGF0aXZpZGFkZSBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBsZWFkQ29udHJvbGxlciA9IG5ldyBMZWFkQ29udHJvbGxlcigpOyJdfQ==