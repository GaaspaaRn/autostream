"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.negociacaoController = exports.NegociacaoController = void 0;
const prisma_1 = require("../lib/prisma");
class NegociacaoController {
    /**
     * Listar negociações
     */
    async list(req, res) {
        try {
            const { page = 1, limit = 20, status, vendedorId, search, sortBy = 'created_at', sortOrder = 'desc', } = req.query;
            const user = req.user;
            const skip = (Number(page) - 1) * Number(limit);
            const take = Number(limit);
            const where = {};
            if (status)
                where.status = status;
            if (vendedorId)
                where.vendedor_id = vendedorId;
            // Restrição de permissão: vendedores só veem suas próprias negociações
            if (user.role === 'VENDEDOR') {
                where.vendedor_id = user.id;
            }
            if (search) {
                where.OR = [
                    {
                        lead: {
                            nome: { contains: search },
                        },
                    },
                    {
                        veiculo: {
                            modelo: { contains: search },
                        },
                    },
                ];
            }
            const [negociacoes, total] = await Promise.all([
                prisma_1.prisma.negociacao.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { [sortBy]: sortOrder },
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
                prisma_1.prisma.negociacao.count({ where }),
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
        }
        catch (error) {
            console.error('List negociacoes error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter negociações para Kanban
     */
    async getKanban(req, res) {
        try {
            const user = req.user;
            const where = {};
            // Restrição de permissão
            if (user.role === 'VENDEDOR') {
                where.vendedor_id = user.id;
            }
            const negociacoes = await prisma_1.prisma.negociacao.findMany({
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
        }
        catch (error) {
            console.error('Get kanban error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter detalhes de uma negociação
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const negociacao = await prisma_1.prisma.negociacao.findUnique({
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
        }
        catch (error) {
            console.error('Get negociacao error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Criar negociação a partir de lead
     */
    async create(req, res) {
        try {
            const user = req.user;
            const { lead_id, valor_proposta, valor_entrada, parcelas, valor_parcela } = req.body;
            if (!lead_id) {
                return res.status(400).json({ error: 'ID do lead é obrigatório' });
            }
            // Verificar se lead existe
            const lead = await prisma_1.prisma.lead.findUnique({
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
            const negociacao = await prisma_1.prisma.negociacao.create({
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
            await prisma_1.prisma.lead.update({
                where: { id: lead_id },
                data: { status: 'EM_ATENDIMENTO' },
            });
            // Criar atividade
            await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Create negociacao error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Atualizar status da negociação
     */
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { status, motivo } = req.body;
            if (!status) {
                return res.status(400).json({ error: 'Status é obrigatório' });
            }
            const negociacao = await prisma_1.prisma.negociacao.findUnique({
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
            const negociacaoAtualizada = await prisma_1.prisma.negociacao.update({
                where: { id },
                data: { status },
            });
            // Se status for GANHO, atualizar lead e veículo
            if (status === 'GANHO') {
                await prisma_1.prisma.lead.update({
                    where: { id: negociacao.lead_id },
                    data: { status: 'CONVERTIDO' },
                });
                await prisma_1.prisma.veiculo.update({
                    where: { id: negociacao.veiculo_id },
                    data: {
                        status: 'VENDIDO',
                        data_venda: new Date(),
                    },
                });
            }
            // Se status for PERDIDO, atualizar lead
            if (status === 'PERDIDO') {
                await prisma_1.prisma.lead.update({
                    where: { id: negociacao.lead_id },
                    data: { status: 'PERDIDO' },
                });
            }
            // Criar atividade
            await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Update status error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Adicionar proposta
     */
    async addProposta(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { valor, valor_entrada, parcelas, valor_parcela, validade, observacoes } = req.body;
            const negociacao = await prisma_1.prisma.negociacao.findUnique({
                where: { id },
            });
            if (!negociacao) {
                return res.status(404).json({ error: 'Negociação não encontrada' });
            }
            // Verificar permissão
            if (user.role === 'VENDEDOR' && negociacao.vendedor_id !== user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const proposta = await prisma_1.prisma.proposta.create({
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
            await prisma_1.prisma.negociacao.update({
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
            await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Add proposta error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Adicionar atividade
     */
    async addAtividade(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { tipo, descricao } = req.body;
            const negociacao = await prisma_1.prisma.negociacao.findUnique({
                where: { id },
            });
            if (!negociacao) {
                return res.status(404).json({ error: 'Negociação não encontrada' });
            }
            // Verificar permissão
            if (user.role === 'VENDEDOR' && negociacao.vendedor_id !== user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const atividade = await prisma_1.prisma.atividade.create({
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
        }
        catch (error) {
            console.error('Add atividade error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Adicionar documento
     */
    async addDocumento(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { nome, tipo, url } = req.body;
            const negociacao = await prisma_1.prisma.negociacao.findUnique({
                where: { id },
            });
            if (!negociacao) {
                return res.status(404).json({ error: 'Negociação não encontrada' });
            }
            // Verificar permissão
            if (user.role === 'VENDEDOR' && negociacao.vendedor_id !== user.id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const documento = await prisma_1.prisma.documento.create({
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
        }
        catch (error) {
            console.error('Add documento error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}
exports.NegociacaoController = NegociacaoController;
exports.negociacaoController = new NegociacaoController();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmVnb2NpYWNhby5jb250cm9sbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnRyb2xsZXJzL25lZ29jaWFjYW8uY29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwwQ0FBdUM7QUFHdkMsTUFBYSxvQkFBb0I7SUFDL0I7O09BRUc7SUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQXlCLEVBQUUsR0FBYTtRQUNqRCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQ0osSUFBSSxHQUFHLENBQUMsRUFDUixLQUFLLEdBQUcsRUFBRSxFQUNWLE1BQU0sRUFDTixVQUFVLEVBQ1YsTUFBTSxFQUNOLE1BQU0sR0FBRyxZQUFZLEVBQ3JCLFNBQVMsR0FBRyxNQUFNLEdBQ25CLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztZQUVkLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFLLENBQUM7WUFDdkIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUUzQixNQUFNLEtBQUssR0FBUSxFQUFFLENBQUM7WUFFdEIsSUFBSSxNQUFNO2dCQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQ2xDLElBQUksVUFBVTtnQkFBRSxLQUFLLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztZQUUvQyx1RUFBdUU7WUFDdkUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUM3QixLQUFLLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDOUIsQ0FBQztZQUVELElBQUksTUFBTSxFQUFFLENBQUM7Z0JBQ1gsS0FBSyxDQUFDLEVBQUUsR0FBRztvQkFDVDt3QkFDRSxJQUFJLEVB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QUNILENBQUM7Q0FDRjtBQXZrQkQsb0RBdWtCQztBQUVZLFFBQUEsb0JBQW9CLEdBQUcsSUFBSSxvQkFBb0IsRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tICdleHByZXNzJztcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gJy4uL2xpYi9wcmlzbWEnO1xuaW1wb3J0IHsgQXV0aGVudGljYXRlZFJlcXVlc3QgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBjbGFzcyBOZWdvY2lhY2FvQ29udHJvbGxlciB7XG4gIC8qKlxuICAgKiBMaXN0YXIgbmVnb2NpYcOnw7Vlc1xuICAgKi9cbiAgYXN5bmMgbGlzdChyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgcGFnZSA9IDEsXG4gICAgICAgIGxpbWl0ID0gMjAsXG4gICAgICAgIHN0YXR1cyxcbiAgICAgICAgdmVuZGVkb3JJZCxcbiAgICAgICAgc2VhcmNoLFxuICAgICAgICBzb3J0QnkgPSAnY3JlYXRlZF9hdCcsXG4gICAgICAgIHNvcnRPcmRlciA9ICdkZXNjJyxcbiAgICAgIH0gPSByZXEucXVlcnk7XG5cbiAgICAgIGNvbnN0IHVzZXIgPSByZXEudXNlciE7XG4gICAgICBjb25zdCBza2lwID0gKE51bWJlcihwYWdlKSAtIDEpICogTnVtYmVyKGxpbWl0KTtcbiAgICAgIGNvbnN0IHRha2UgPSBOdW1iZXIobGltaXQpO1xuXG4gICAgICBjb25zdCB3aGVyZTogYW55ID0ge307XG5cbiAgICAgIGlmIChzdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHN0YXR1cztcbiAgICAgIGlmICh2ZW5kZWRvcklkKSB3aGVyZS52ZW5kZWRvcl9pZCA9IHZlbmRlZG9ySWQ7XG5cbiAgICAgIC8vIFJlc3RyacOnw6NvIGRlIHBlcm1pc3PDo286IHZlbmRlZG9yZXMgc8OzIHZlZW0gc3VhcyBwcsOzcHJpYXMgbmVnb2NpYcOnw7Vlc1xuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJykge1xuICAgICAgICB3aGVyZS52ZW5kZWRvcl9pZCA9IHVzZXIuaWQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChzZWFyY2gpIHtcbiAgICAgICAgd2hlcmUuT1IgPSBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbGVhZDoge1xuICAgICAgICAgICAgICBub21lOiB7IGNvbnRhaW5zOiBzZWFyY2ggYXMgc3RyaW5nIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdmVpY3Vsbzoge1xuICAgICAgICAgICAgICBtb2RlbG86IHsgY29udGFpbnM6IHNlYXJjaCBhcyBzdHJpbmcgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgW25lZ29jaWFjb2VzLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIHByaXNtYS5uZWdvY2lhY2FvLmZpbmRNYW55KHtcbiAgICAgICAgICB3aGVyZSxcbiAgICAgICAgICBza2lwLFxuICAgICAgICAgIHRha2UsXG4gICAgICAgICAgb3JkZXJCeTogeyBbc29ydEJ5IGFzIHN0cmluZ106IHNvcnRPcmRlciB9LFxuICAgICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICAgIGxlYWQ6IHtcbiAgICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbm9tZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3aGF0c2FwcDogdHJ1ZSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2ZWljdWxvOiB7XG4gICAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1hcmNhOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1vZGVsbzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhbm9fbW9kZWxvOiB0cnVlLFxuICAgICAgICAgICAgICAgIHByZWNvX3ZlbmRhOiB0cnVlLFxuICAgICAgICAgICAgICAgIGZvdG9zOiB7XG4gICAgICAgICAgICAgICAgICB3aGVyZTogeyBvcmRlbTogMCB9LFxuICAgICAgICAgICAgICAgICAgdGFrZTogMSxcbiAgICAgICAgICAgICAgICAgIHNlbGVjdDogeyB1cmw6IHRydWUgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZlbmRlZG9yOiB7XG4gICAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5vbWU6IHRydWUsXG4gICAgICAgICAgICAgICAgZm90b191cmw6IHRydWUsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgX2NvdW50OiB7XG4gICAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICAgIHByb3Bvc3RhczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdGl2aWRhZGVzOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgcHJpc21hLm5lZ29jaWFjYW8uY291bnQoeyB3aGVyZSB9KSxcbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBuZWdvY2lhY29lcyxcbiAgICAgICAgbWV0YToge1xuICAgICAgICAgIHBhZ2U6IE51bWJlcihwYWdlKSxcbiAgICAgICAgICBsaW1pdDogTnVtYmVyKGxpbWl0KSxcbiAgICAgICAgICB0b3RhbCxcbiAgICAgICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBOdW1iZXIobGltaXQpKSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdMaXN0IG5lZ29jaWFjb2VzIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgbmVnb2NpYcOnw7VlcyBwYXJhIEthbmJhblxuICAgKi9cbiAgYXN5bmMgZ2V0S2FuYmFuKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcblxuICAgICAgY29uc3Qgd2hlcmU6IGFueSA9IHt9O1xuXG4gICAgICAvLyBSZXN0cmnDp8OjbyBkZSBwZXJtaXNzw6NvXG4gICAgICBpZiAodXNlci5yb2xlID09PSAnVkVOREVET1InKSB7XG4gICAgICAgIHdoZXJlLnZlbmRlZG9yX2lkID0gdXNlci5pZDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmVnb2NpYWNvZXMgPSBhd2FpdCBwcmlzbWEubmVnb2NpYWNhby5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlLFxuICAgICAgICBvcmRlckJ5OiB7IHVwZGF0ZWRfYXQ6ICdkZXNjJyB9LFxuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgbGVhZDoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgICAgICAgd2hhdHNhcHA6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVpY3Vsbzoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgICAgICBtYXJjYTogdHJ1ZSxcbiAgICAgICAgICAgICAgbW9kZWxvOiB0cnVlLFxuICAgICAgICAgICAgICBhbm9fbW9kZWxvOiB0cnVlLFxuICAgICAgICAgICAgICBwcmVjb192ZW5kYTogdHJ1ZSxcbiAgICAgICAgICAgICAgZm90b3M6IHtcbiAgICAgICAgICAgICAgICB3aGVyZTogeyBvcmRlbTogMCB9LFxuICAgICAgICAgICAgICAgIHRha2U6IDEsXG4gICAgICAgICAgICAgICAgc2VsZWN0OiB7IHVybDogdHJ1ZSB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRlZG9yOiB7XG4gICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgICAgICAgIG5vbWU6IHRydWUsXG4gICAgICAgICAgICAgIGZvdG9fdXJsOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGF0aXZpZGFkZXM6IHtcbiAgICAgICAgICAgIG9yZGVyQnk6IHsgZGF0YTogJ2Rlc2MnIH0sXG4gICAgICAgICAgICB0YWtlOiAxLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gQWdydXBhciBwb3Igc3RhdHVzXG4gICAgICBjb25zdCBrYW5iYW4gPSB7XG4gICAgICAgIFBST1NQRUNDQU86IG5lZ29jaWFjb2VzLmZpbHRlcigobikgPT4gbi5zdGF0dXMgPT09ICdQUk9TUEVDQ0FPJyksXG4gICAgICAgIFBST1BPU1RBX1BSRVBBUkFDQU86IG5lZ29jaWFjb2VzLmZpbHRlcigobikgPT4gbi5zdGF0dXMgPT09ICdQUk9QT1NUQV9QUkVQQVJBQ0FPJyksXG4gICAgICAgIFBST1BPU1RBX0VOVklBREE6IG5lZ29jaWFjb2VzLmZpbHRlcigobikgPT4gbi5zdGF0dXMgPT09ICdQUk9QT1NUQV9FTlZJQURBJyksXG4gICAgICAgIEVNX05FR09DSUFDQU86IG5lZ29jaWFjb2VzLmZpbHRlcigobikgPT4gbi5zdGF0dXMgPT09ICdFTV9ORUdPQ0lBQ0FPJyksXG4gICAgICAgIEZFQ0hBTUVOVE9fUEVOREVOVEU6IG5lZ29jaWFjb2VzLmZpbHRlcigobikgPT4gbi5zdGF0dXMgPT09ICdGRUNIQU1FTlRPX1BFTkRFTlRFJyksXG4gICAgICAgIEdBTkhPOiBuZWdvY2lhY29lcy5maWx0ZXIoKG4pID0+IG4uc3RhdHVzID09PSAnR0FOSE8nKSxcbiAgICAgICAgUEVSRElETzogbmVnb2NpYWNvZXMuZmlsdGVyKChuKSA9PiBuLnN0YXR1cyA9PT0gJ1BFUkRJRE8nKSxcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IGthbmJhbixcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdHZXQga2FuYmFuIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgZGV0YWxoZXMgZGUgdW1hIG5lZ29jaWHDp8Ojb1xuICAgKi9cbiAgYXN5bmMgZ2V0QnlJZChyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgICBjb25zdCB1c2VyID0gcmVxLnVzZXIhO1xuXG4gICAgICBjb25zdCBuZWdvY2lhY2FvID0gYXdhaXQgcHJpc21hLm5lZ29jaWFjYW8uZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICBsZWFkOiB7XG4gICAgICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgICAgIGF0aXZpZGFkZXM6IHtcbiAgICAgICAgICAgICAgICBvcmRlckJ5OiB7IGRhdGE6ICdkZXNjJyB9LFxuICAgICAgICAgICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICAgICAgICAgIHVzZXI6IHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0OiB7IG5vbWU6IHRydWUsIGZvdG9fdXJsOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVpY3Vsbzoge1xuICAgICAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgICAgICBmb3Rvczoge1xuICAgICAgICAgICAgICAgIG9yZGVyQnk6IHsgb3JkZW06ICdhc2MnIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZGVkb3I6IHtcbiAgICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgICAgICAgbm9tZTogdHJ1ZSxcbiAgICAgICAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgICAgICAgIHRlbGVmb25lOiB0cnVlLFxuICAgICAgICAgICAgICBmb3RvX3VybDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcm9wb3N0YXM6IHtcbiAgICAgICAgICAgIG9yZGVyQnk6IHsgZGF0YTogJ2Rlc2MnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhdGl2aWRhZGVzOiB7XG4gICAgICAgICAgICBvcmRlckJ5OiB7IGRhdGE6ICdkZXNjJyB9LFxuICAgICAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgICAgICB1c2VyOiB7XG4gICAgICAgICAgICAgICAgc2VsZWN0OiB7IG5vbWU6IHRydWUsIGZvdG9fdXJsOiB0cnVlIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZG9jdW1lbnRvczoge1xuICAgICAgICAgICAgb3JkZXJCeTogeyBjcmVhdGVkX2F0OiAnZGVzYycgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghbmVnb2NpYWNhbykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ05lZ29jaWHDp8OjbyBuw6NvIGVuY29udHJhZGEnIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8Ojb1xuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJyAmJiBuZWdvY2lhY2FvLnZlbmRlZG9yX2lkICE9PSB1c2VyLmlkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAnQWNlc3NvIG5lZ2FkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IG5lZ29jaWFjYW8sXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignR2V0IG5lZ29jaWFjYW8gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmlhciBuZWdvY2lhw6fDo28gYSBwYXJ0aXIgZGUgbGVhZFxuICAgKi9cbiAgYXN5bmMgY3JlYXRlKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcbiAgICAgIGNvbnN0IHsgbGVhZF9pZCwgdmFsb3JfcHJvcG9zdGEsIHZhbG9yX2VudHJhZGEsIHBhcmNlbGFzLCB2YWxvcl9wYXJjZWxhIH0gPSByZXEuYm9keTtcblxuICAgICAgaWYgKCFsZWFkX2lkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAnSUQgZG8gbGVhZCDDqSBvYnJpZ2F0w7NyaW8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgc2UgbGVhZCBleGlzdGVcbiAgICAgIGNvbnN0IGxlYWQgPSBhd2FpdCBwcmlzbWEubGVhZC5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IGxlYWRfaWQgfSxcbiAgICAgICAgaW5jbHVkZTogeyB2ZWljdWxvOiB0cnVlLCBuZWdvY2lhY2FvOiB0cnVlIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFsZWFkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnTGVhZCBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgc2UgasOhIGV4aXN0ZSBuZWdvY2lhw6fDo28gcGFyYSBlc3RlIGxlYWRcbiAgICAgIGlmIChsZWFkLm5lZ29jaWFjYW8pIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA5KS5qc29uKHtcbiAgICAgICAgICBlcnJvcjogJ0rDoSBleGlzdGUgdW1hIG5lZ29jaWHDp8OjbyBwYXJhIGVzdGUgbGVhZCcsXG4gICAgICAgICAgbmVnb2NpYWNhb0lkOiBsZWFkLm5lZ29jaWFjYW8uaWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8Ojb1xuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJyAmJiBsZWFkLnZlbmRlZG9yX2lkICE9PSB1c2VyLmlkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAnQWNlc3NvIG5lZ2FkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIENyaWFyIG5lZ29jaWHDp8Ojb1xuICAgICAgY29uc3QgbmVnb2NpYWNhbyA9IGF3YWl0IHByaXNtYS5uZWdvY2lhY2FvLmNyZWF0ZSh7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBsZWFkX2lkLFxuICAgICAgICAgIHZlaWN1bG9faWQ6IGxlYWQudmVpY3Vsb19pZCxcbiAgICAgICAgICB2ZW5kZWRvcl9pZDogbGVhZC52ZW5kZWRvcl9pZCB8fCB1c2VyLmlkLFxuICAgICAgICAgIHZhbG9yX3Byb3Bvc3RhOiB2YWxvcl9wcm9wb3N0YSA/IE51bWJlcih2YWxvcl9wcm9wb3N0YSkgOiBudWxsLFxuICAgICAgICAgIHZhbG9yX2VudHJhZGE6IHZhbG9yX2VudHJhZGEgPyBOdW1iZXIodmFsb3JfZW50cmFkYSkgOiBudWxsLFxuICAgICAgICAgIHBhcmNlbGFzOiBwYXJjZWxhcyA/IE51bWJlcihwYXJjZWxhcykgOiBudWxsLFxuICAgICAgICAgIHZhbG9yX3BhcmNlbGE6IHZhbG9yX3BhcmNlbGEgPyBOdW1iZXIodmFsb3JfcGFyY2VsYSkgOiBudWxsLFxuICAgICAgICAgIHN0YXR1czogJ1BST1NQRUNDQU8nLFxuICAgICAgICB9LFxuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgbGVhZDoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIG5vbWU6IHRydWUsXG4gICAgICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgICAgICB3aGF0c2FwcDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2ZWljdWxvOiB7XG4gICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgbWFyY2E6IHRydWUsXG4gICAgICAgICAgICAgIG1vZGVsbzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBdHVhbGl6YXIgc3RhdHVzIGRvIGxlYWRcbiAgICAgIGF3YWl0IHByaXNtYS5sZWFkLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiBsZWFkX2lkIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiAnRU1fQVRFTkRJTUVOVE8nIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JpYXIgYXRpdmlkYWRlXG4gICAgICBhd2FpdCBwcmlzbWEuYXRpdmlkYWRlLmNyZWF0ZSh7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICB0aXBvOiAnU0lTVEVNQScsXG4gICAgICAgICAgZGVzY3JpY2FvOiAnTmVnb2NpYcOnw6NvIGNyaWFkYScsXG4gICAgICAgICAgbGVhZF9pZCxcbiAgICAgICAgICBuZWdvY2lhY2FvX2lkOiBuZWdvY2lhY2FvLmlkLFxuICAgICAgICAgIHVzZXJfaWQ6IHVzZXIuaWQsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAxKS5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogbmVnb2NpYWNhbyxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdDcmVhdGUgbmVnb2NpYWNhbyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEF0dWFsaXphciBzdGF0dXMgZGEgbmVnb2NpYcOnw6NvXG4gICAqL1xuICBhc3luYyB1cGRhdGVTdGF0dXMocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGlkIH0gPSByZXEucGFyYW1zO1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcbiAgICAgIGNvbnN0IHsgc3RhdHVzLCBtb3Rpdm8gfSA9IHJlcS5ib2R5O1xuXG4gICAgICBpZiAoIXN0YXR1cykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ1N0YXR1cyDDqSBvYnJpZ2F0w7NyaW8nIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBuZWdvY2lhY2FvID0gYXdhaXQgcHJpc21hLm5lZ29jaWFjYW8uZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIGluY2x1ZGU6IHsgbGVhZDogdHJ1ZSwgdmVpY3VsbzogdHJ1ZSB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghbmVnb2NpYWNhbykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ05lZ29jaWHDp8OjbyBuw6NvIGVuY29udHJhZGEnIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8Ojb1xuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJyAmJiBuZWdvY2lhY2FvLnZlbmRlZG9yX2lkICE9PSB1c2VyLmlkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAnQWNlc3NvIG5lZ2FkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEF0dWFsaXphciBuZWdvY2lhw6fDo29cbiAgICAgIGNvbnN0IG5lZ29jaWFjYW9BdHVhbGl6YWRhID0gYXdhaXQgcHJpc21hLm5lZ29jaWFjYW8udXBkYXRlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXMgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBTZSBzdGF0dXMgZm9yIEdBTkhPLCBhdHVhbGl6YXIgbGVhZCBlIHZlw61jdWxvXG4gICAgICBpZiAoc3RhdHVzID09PSAnR0FOSE8nKSB7XG4gICAgICAgIGF3YWl0IHByaXNtYS5sZWFkLnVwZGF0ZSh7XG4gICAgICAgICAgd2hlcmU6IHsgaWQ6IG5lZ29jaWFjYW8ubGVhZF9pZCB9LFxuICAgICAgICAgIGRhdGE6IHsgc3RhdHVzOiAnQ09OVkVSVElETycgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXdhaXQgcHJpc21hLnZlaWN1bG8udXBkYXRlKHtcbiAgICAgICAgICB3aGVyZTogeyBpZDogbmVnb2NpYWNhby52ZWljdWxvX2lkIH0sXG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgc3RhdHVzOiAnVkVORElETycsXG4gICAgICAgICAgICBkYXRhX3ZlbmRhOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBTZSBzdGF0dXMgZm9yIFBFUkRJRE8sIGF0dWFsaXphciBsZWFkXG4gICAgICBpZiAoc3RhdHVzID09PSAnUEVSRElETycpIHtcbiAgICAgICAgYXdhaXQgcHJpc21hLmxlYWQudXBkYXRlKHtcbiAgICAgICAgICB3aGVyZTogeyBpZDogbmVnb2NpYWNhby5sZWFkX2lkIH0sXG4gICAgICAgICAgZGF0YTogeyBzdGF0dXM6ICdQRVJESURPJyB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gQ3JpYXIgYXRpdmlkYWRlXG4gICAgICBhd2FpdCBwcmlzbWEuYXRpdmlkYWRlLmNyZWF0ZSh7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICB0aXBvOiAnU1RBVFVTJyxcbiAgICAgICAgICBkZXNjcmljYW86IGBTdGF0dXMgZGEgbmVnb2NpYcOnw6NvIGFsdGVyYWRvIHBhcmE6ICR7c3RhdHVzfSR7bW90aXZvID8gYCAtIE1vdGl2bzogJHttb3Rpdm99YCA6ICcnfWAsXG4gICAgICAgICAgbGVhZF9pZDogbmVnb2NpYWNhby5sZWFkX2lkLFxuICAgICAgICAgIG5lZ29jaWFjYW9faWQ6IGlkLFxuICAgICAgICAgIHVzZXJfaWQ6IHVzZXIuaWQsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogbmVnb2NpYWNhb0F0dWFsaXphZGEsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignVXBkYXRlIHN0YXR1cyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkaWNpb25hciBwcm9wb3N0YVxuICAgKi9cbiAgYXN5bmMgYWRkUHJvcG9zdGEocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGlkIH0gPSByZXEucGFyYW1zO1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcbiAgICAgIGNvbnN0IHsgdmFsb3IsIHZhbG9yX2VudHJhZGEsIHBhcmNlbGFzLCB2YWxvcl9wYXJjZWxhLCB2YWxpZGFkZSwgb2JzZXJ2YWNvZXMgfSA9IHJlcS5ib2R5O1xuXG4gICAgICBjb25zdCBuZWdvY2lhY2FvID0gYXdhaXQgcHJpc21hLm5lZ29jaWFjYW8uZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFuZWdvY2lhY2FvKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnTmVnb2NpYcOnw6NvIG7Do28gZW5jb250cmFkYScgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFZlcmlmaWNhciBwZXJtaXNzw6NvXG4gICAgICBpZiAodXNlci5yb2xlID09PSAnVkVOREVET1InICYmIG5lZ29jaWFjYW8udmVuZGVkb3JfaWQgIT09IHVzZXIuaWQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICdBY2Vzc28gbmVnYWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcHJvcG9zdGEgPSBhd2FpdCBwcmlzbWEucHJvcG9zdGEuY3JlYXRlKHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIG5lZ29jaWFjYW9faWQ6IGlkLFxuICAgICAgICAgIHZhbG9yOiBOdW1iZXIodmFsb3IpLFxuICAgICAgICAgIHZhbG9yX2VudHJhZGE6IHZhbG9yX2VudHJhZGEgPyBOdW1iZXIodmFsb3JfZW50cmFkYSkgOiBudWxsLFxuICAgICAgICAgIHBhcmNlbGFzOiBwYXJjZWxhcyA/IE51bWJlcihwYXJjZWxhcykgOiBudWxsLFxuICAgICAgICAgIHZhbG9yX3BhcmNlbGE6IHZhbG9yX3BhcmNlbGEgPyBOdW1iZXIodmFsb3JfcGFyY2VsYSkgOiBudWxsLFxuICAgICAgICAgIHZhbGlkYWRlOiB2YWxpZGFkZSA/IG5ldyBEYXRlKHZhbGlkYWRlKSA6IG51bGwsXG4gICAgICAgICAgb2JzZXJ2YWNvZXMsXG4gICAgICAgICAgc3RhdHVzOiAnRU5WSUFEQScsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gQXR1YWxpemFyIHZhbG9yZXMgZGEgbmVnb2NpYcOnw6NvXG4gICAgICBhd2FpdCBwcmlzbWEubmVnb2NpYWNhby51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgdmFsb3JfcHJvcG9zdGE6IE51bWJlcih2YWxvciksXG4gICAgICAgICAgdmFsb3JfZW50cmFkYTogdmFsb3JfZW50cmFkYSA/IE51bWJlcih2YWxvcl9lbnRyYWRhKSA6IG51bGwsXG4gICAgICAgICAgcGFyY2VsYXM6IHBhcmNlbGFzID8gTnVtYmVyKHBhcmNlbGFzKSA6IG51bGwsXG4gICAgICAgICAgdmFsb3JfcGFyY2VsYTogdmFsb3JfcGFyY2VsYSA/IE51bWJlcih2YWxvcl9wYXJjZWxhKSA6IG51bGwsXG4gICAgICAgICAgc3RhdHVzOiAnUFJPUE9TVEFfRU5WSUFEQScsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JpYXIgYXRpdmlkYWRlXG4gICAgICBhd2FpdCBwcmlzbWEuYXRpdmlkYWRlLmNyZWF0ZSh7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICB0aXBvOiAnUFJPUE9TVEEnLFxuICAgICAgICAgIGRlc2NyaWNhbzogYFByb3Bvc3RhIGRlIFIkICR7TnVtYmVyKHZhbG9yKS50b0xvY2FsZVN0cmluZygncHQtQlInKX0gZW52aWFkYWAsXG4gICAgICAgICAgbmVnb2NpYWNhb19pZDogaWQsXG4gICAgICAgICAgdXNlcl9pZDogdXNlci5pZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLnN0YXR1cygyMDEpLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBwcm9wb3N0YSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdBZGQgcHJvcG9zdGEgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGljaW9uYXIgYXRpdmlkYWRlXG4gICAqL1xuICBhc3luYyBhZGRBdGl2aWRhZGUocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGlkIH0gPSByZXEucGFyYW1zO1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcbiAgICAgIGNvbnN0IHsgdGlwbywgZGVzY3JpY2FvIH0gPSByZXEuYm9keTtcblxuICAgICAgY29uc3QgbmVnb2NpYWNhbyA9IGF3YWl0IHByaXNtYS5uZWdvY2lhY2FvLmZpbmRVbmlxdWUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghbmVnb2NpYWNhbykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ05lZ29jaWHDp8OjbyBuw6NvIGVuY29udHJhZGEnIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8Ojb1xuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJyAmJiBuZWdvY2lhY2FvLnZlbmRlZG9yX2lkICE9PSB1c2VyLmlkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAnQWNlc3NvIG5lZ2FkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGF0aXZpZGFkZSA9IGF3YWl0IHByaXNtYS5hdGl2aWRhZGUuY3JlYXRlKHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHRpcG8sXG4gICAgICAgICAgZGVzY3JpY2FvLFxuICAgICAgICAgIG5lZ29jaWFjYW9faWQ6IGlkLFxuICAgICAgICAgIHVzZXJfaWQ6IHVzZXIuaWQsXG4gICAgICAgIH0sXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB1c2VyOiB7XG4gICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgbm9tZTogdHJ1ZSxcbiAgICAgICAgICAgICAgZm90b191cmw6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAxKS5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogYXRpdmlkYWRlLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FkZCBhdGl2aWRhZGUgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGljaW9uYXIgZG9jdW1lbnRvXG4gICAqL1xuICBhc3luYyBhZGREb2N1bWVudG8ocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGlkIH0gPSByZXEucGFyYW1zO1xuICAgICAgY29uc3QgdXNlciA9IHJlcS51c2VyITtcbiAgICAgIGNvbnN0IHsgbm9tZSwgdGlwbywgdXJsIH0gPSByZXEuYm9keTtcblxuICAgICAgY29uc3QgbmVnb2NpYWNhbyA9IGF3YWl0IHByaXNtYS5uZWdvY2lhY2FvLmZpbmRVbmlxdWUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghbmVnb2NpYWNhbykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ05lZ29jaWHDp8OjbyBuw6NvIGVuY29udHJhZGEnIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcGVybWlzc8Ojb1xuICAgICAgaWYgKHVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJyAmJiBuZWdvY2lhY2FvLnZlbmRlZG9yX2lkICE9PSB1c2VyLmlkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAnQWNlc3NvIG5lZ2FkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRvY3VtZW50byA9IGF3YWl0IHByaXNtYS5kb2N1bWVudG8uY3JlYXRlKHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIG5lZ29jaWFjYW9faWQ6IGlkLFxuICAgICAgICAgIG5vbWUsXG4gICAgICAgICAgdGlwbyxcbiAgICAgICAgICB1cmwsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAxKS5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogZG9jdW1lbnRvLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FkZCBkb2N1bWVudG8gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgbmVnb2NpYWNhb0NvbnRyb2xsZXIgPSBuZXcgTmVnb2NpYWNhb0NvbnRyb2xsZXIoKTsiXX0=