"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
// Helper to parse/stringify fields
const parseUserFields = (user) => {
    if (!user)
        return null;
    return {
        ...user,
        especialidades: user.especialidades ? JSON.parse(user.especialidades) : [],
        regras_atribuicao: user.regras_atribuicao ? JSON.parse(user.regras_atribuicao) : null,
    };
};
class UserController {
    /**
     * Listar usuários
     */
    async list(req, res) {
        try {
            const { page = 1, limit = 20, role, status, search, sortBy = 'nome', sortOrder = 'asc', } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const take = Number(limit);
            const where = {};
            if (role)
                where.role = role;
            if (status)
                where.status = status;
            if (search) {
                where.OR = [
                    { nome: { contains: search } }, // SQLite doesn't support mode: 'insensitive' easily, removing it or using raw query if needed. Prisma emulates it? Let's try default.
                    { email: { contains: search } },
                ];
            }
            const [users, total] = await Promise.all([
                prisma_1.prisma.user.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { [sortBy]: sortOrder },
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
                prisma_1.prisma.user.count({ where }),
            ]);
            // Calcular taxa de conversão para cada vendedor
            const usersComMetricas = await Promise.all(users.map(async (rawUser) => {
                const user = parseUserFields(rawUser);
                if (user.role !== 'VENDEDOR')
                    return user;
                const inicioMes = new Date();
                inicioMes.setDate(1);
                inicioMes.setHours(0, 0, 0, 0);
                const [leadsRecebidos, vendasRealizadas] = await Promise.all([
                    prisma_1.prisma.lead.count({
                        where: {
                            vendedor_id: user.id,
                            created_at: { gte: inicioMes },
                        },
                    }),
                    prisma_1.prisma.lead.count({
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
            }));
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
        }
        catch (error) {
            console.error('List users error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter detalhes de um usuário
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const user = await prisma_1.prisma.user.findUnique({
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
        }
        catch (error) {
            console.error('Get user error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Criar usuário (apenas admin)
     */
    async create(req, res) {
        try {
            const userData = req.body;
            // Verificar se email já existe
            const existing = await prisma_1.prisma.user.findUnique({
                where: { email: userData.email },
            });
            if (existing) {
                return res.status(409).json({ error: 'Email já cadastrado' });
            }
            // Hash da senha
            const passwordHash = await bcryptjs_1.default.hash(userData.senha || 'senha123', 10);
            const user = await prisma_1.prisma.user.create({
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
        }
        catch (error) {
            console.error('Create user error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Atualizar usuário
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const userData = req.body;
            const currentUser = req.user;
            // Verificar se usuário existe
            const user = await prisma_1.prisma.user.findUnique({
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
            const updateData = { ...userData };
            // Se estiver atualizando senha
            if (userData.senha) {
                updateData.password_hash = await bcryptjs_1.default.hash(userData.senha, 10);
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
            const userAtualizado = await prisma_1.prisma.user.update({
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
        }
        catch (error) {
            console.error('Update user error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Desativar usuário
     */
    async deactivate(req, res) {
        try {
            const { id } = req.params;
            const user = await prisma_1.prisma.user.findUnique({
                where: { id },
            });
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            await prisma_1.prisma.user.update({
                where: { id },
                data: { status: 'INATIVO' },
            });
            return res.json({
                success: true,
                message: 'Usuário desativado com sucesso',
            });
        }
        catch (error) {
            console.error('Deactivate user error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter performance do vendedor
     */
    async getPerformance(req, res) {
        try {
            const { id } = req.params;
            const { meses = 12 } = req.query;
            const user = await prisma_1.prisma.user.findUnique({
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
                    prisma_1.prisma.lead.count({
                        where: {
                            vendedor_id: id,
                            created_at: { gte: inicioMes, lte: fimMes },
                        },
                    }),
                    prisma_1.prisma.lead.count({
                        where: {
                            vendedor_id: id,
                            status: 'CONVERTIDO',
                            updated_at: { gte: inicioMes, lte: fimMes },
                        },
                    }),
                    prisma_1.prisma.negociacao.count({
                        where: {
                            vendedor_id: id,
                            status: 'GANHO',
                            created_at: { gte: inicioMes, lte: fimMes },
                        },
                    }),
                    prisma_1.prisma.negociacao.aggregate({
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
        }
        catch (error) {
            console.error('Get performance error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter leads atuais do vendedor
     */
    async getLeadsAtuais(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const take = Number(limit);
            const [leads, total] = await Promise.all([
                prisma_1.prisma.lead.findMany({
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
                                fotos: {
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
                prisma_1.prisma.lead.count({
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
        }
        catch (error) {
            console.error('Get leads atuais error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}
exports.UserController = UserController;
exports.userController = new UserController();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlci5jb250cm9sbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnRyb2xsZXJzL3VzZXIuY29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFDQSx3REFBOEI7QUFDOUIsMENBQXVDO0FBR3ZDLG1DQUFtQztBQUNuQyxNQUFNLGVBQWUsR0FBRyxDQUFDLElBQVMsRUFBRSxFQUFFO0lBQ3BDLElBQUksQ0FBQyxJQUFJO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDdkIsT0FBTztRQUNMLEdBQUcsSUFBSTtRQUNQLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUMxRSxpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7S0FDdEYsQ0FBQztBQUNKLENBQUMsQ0FBQztBQUVGLE1BQWEsY0FBYztJQUN6Qjs7T0FFRztJQUNILEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBeUIsRUFBRSxHQUFhO1FBQ2pELElBQUksQ0FBQztZQUNILE1BQU0sRUFDSixJQUFJLEdBQUcsQ0FBQyxFQUNSLEtBQUssR0FBRyxFQUFFLEVBQ1YsSUFBSSxFQUNKLE1BQU0sRUFDTixNQUFNLEVBQ04sTUFBTSxHQUFHLE1BQU0sRUFDZixTQUFTLEdBQUcsS0FBSyxHQUNsQixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUM7WUFFZCxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRTNCLE1BQU0sS0FBSyxHQUFRLEVBQUUsQ0FBQztZQUV0QixJQUFJLElBQUk7Z0JBQUUsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFjLENBQUM7WUFDdEMsSUFBSSxNQUFNO2dCQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBZ0IsQ0FBQztZQUU1QyxJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUNYLEtBQUssQ0FBQyxFQUFFLEdBQUc7b0JBQ1QsRUFBRSxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsTUFBZ0IsRUFBRSxFQUFFLEVBQUUsc0lBQXNJO29CQUNoTCxFQUFFLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFnQixFQUFFLEVBQUU7aUJBQzFDLENBQUM7WUFDSixDQUFDO1lBRUQsTUFBTSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7Z0JBQ3ZDLGVBQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO29CQUNuQixLQUFLO29CQUNMLElBQUk7b0JBQ0osSUFBSTtvQkFDSixPQUFPLEVBQUUsRUFBRSxDQUFDLE1BQWdCLENBQUMsRUFBRSxTQUFTLEVBQUU7b0JBQzFDLE1BQU0sRUFBRTt3QkFDTixFQUFFLEVBQUUsSUFBSTt3QkFDUixLQUFLLEVBQUUsSUFBSTt3QkFDWCxJQUFJLEVBQUUsSUFBSTt3QkFDVixRQUFRLEVBQUUsSUFBSTt3QkFDZCxRQUFRLEVBQUUsSUFBSTt3QkFDZCxJQUFJLEVBQUUsSUFBSTt3QkFDVixLQUFLLEVBQUUsSUFBSTt3QkFDWCxNQUFNLEVBQUUsSUFBSTt3QkFDWixjQUFjLEVBQUUsSUFBSTt3QkFDcEIsb0JBQW9CLEVBQUUsSUFBSTt3QkFDMUIsaUJBQWlCLEVBQUUsSUFBSTt3QkFDdkIsb0JBQW9CLEVBQUUsSUFBSTt3QkFDMUIsVUFBVSxFQUFFLElBQUk7d0JBQ2hCLE1BQU0sRUFBRTs0QkFDTixNQUFNLEVBQUU7Z0NBQ04sZ0JBQWdCLEVBQUU7b0NBQ2hCLEtBQUssRUFBRTt3Q0FDTCxNQUFNLEVBQUU7NENBQ04sS0FBSyxFQUFFLENBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUM7eUNBQzlDO3FDQUNGO2lDQUNGO2dDQUNELFdBQVcsRUFBRSxJQUFJOzZCQUNsQjt5QkFDRjtxQkFDRjtpQkFDRixDQUFDO2dCQUNGLGVBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7YUFDN0IsQ0FBQyxDQUFDO1lBRUgsZ0RBQWdEO1lBQ2hELE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUN4QyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRTtnQkFDMUIsTUFBTSxJQUFJLEdBQUcsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVTtvQkFBRSxPQUFPLElBQUksQ0FBQztnQkFFMUMsTUFBTSxTQUFTLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDN0IsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDckIsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFFL0IsTUFBTSxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztvQkFDM0QsZUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7d0JBQ2hCLEtBQUssRUFBRTs0QkFDTCxXQUFXLEVBQUUsSUFBSSxDQUFDLEVBQUU7NEJBQ3BCLFVBQVUsRUFBRSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUU7eUJBQy9CO3FCQUNGLENBQUM7b0JBQ0YsZUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7d0JBQ2hCLEtBQUssRUFBRTs0QkFDTCxXQUFXLEVBQUUsSUFBSSxDQUFDLEVBQUU7NEJBQ3BCLE1BQU0sRUFBRSxZQUFZOzRCQUNwQixVQUFVLEVBQUUsRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFO3lCQUMvQjtxQkFDRixDQUFDO2lCQUNILENBQUMsQ0FBQztnQkFFSCxNQUFNLGFBQWEsR0FBRyxjQUFjLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixHQUFHLGNBQWMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUV6RixPQUFPO29CQUNMLEdBQUcsSUFBSTtvQkFDUCxRQUFRLEVBQUU7d0JBQ1IsY0FBYzt3QkFDZCxnQkFBZ0I7d0JBQ2hCLGFBQWEsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHO3FCQUNyRDtpQkFDRixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQ0gsQ0FBQztZQUVGLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztnQkFDZCxPQUFPLEVBQUUsSUFBSTtnQkFDYixJQUFJLEVBQUUsZ0JBQWdCO2dCQUN0QixJQUFJLEVBQUU7b0JBQ0osSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0JBQ2xCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDO29CQUNwQixLQUFLO29CQUNMLFVBQVUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQzdDO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzFDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQXlCLEVBQUUsR0FBYTtRQUNwRCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztZQUUxQixNQUFNLElBQUksR0FBRyxNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO2dCQUN4QyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUU7Z0JBQ2IsTUFBTSxFQUFFO29CQUNOLEVBQUUsRUFBRSxJQUFJO29CQUNSLEtBQUssRUFBRSxJQUFJO29CQUNYLElBQUksRUFBRSxJQUFJO29CQUNWLFFBQVEsRUFBRSxJQUFJO29CQUNkLFFBQVEsRUFBRSxJQUFJO29CQUNkLElBQUksRUFBRSxJQUFJO29CQUNWLEtBQUssRUFBRSxJQUFJO29CQUNYLE1BQU0sRUFBRSxJQUFJO29CQUNaLGNBQWMsRUFBRSxJQUFJO29CQUNwQixvQkFBb0IsRUFBRSxJQUFJO29CQUMxQixpQkFBaUIsRUFBRSxJQUFJO29CQUN2QixvQkFBb0IsRUFBRSxJQUFJO29CQUMxQixpQkFBaUIsRUFBRSxJQUFJO29CQUN2QixVQUFVLEVBQUUsSUFBSTtpQkFDakI7YUFDRixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ1YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSx3QkFBd0IsRUFBRSxDQUFDLENBQUM7WUFDbkUsQ0FBQztZQUVELE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztnQkFDZCxPQUFPLEVBQUUsSUFBSTtnQkFDYixJQUFJLEVBQUUsZUFBZSxDQUFDLElBQUksQ0FBQzthQUM1QixDQUFDLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDeEMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSwwQkFBMEIsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBeUIsRUFBRSxHQUFhO1FBQ25ELElBQUksQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFFMUIsK0JBQStCO1lBQy9CLE1BQU0sUUFBUSxHQUFHLE1BQU0sZUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7Z0JBQzVDLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFFO2FBQ2pDLENBQUMsQ0FBQztZQUVILElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ2IsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxxQkFBcUIsRUFBRSxDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUVELGdCQUFnQjtZQUNoQixNQUFNLFlBQVksR0FBRyxNQUFNLGtCQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLElBQUksVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRXpFLE1BQU0sSUFBSSxHQUFHLE1BQU0sZUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7Z0JBQ3BDLElBQUksRUFBRTtvQkFDSixLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUs7b0JBQ3JCLGFBQWEsRUFBRSxZQUFZO29CQUMzQixJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7b0JBQ25CLFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUTtvQkFDM0IsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRO29CQUMzQixJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUksSUFBSSxVQUFVO29CQUNqQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUs7b0JBQ3JCLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTSxJQUFJLE9BQU87b0JBQ2xDLGNBQWMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxjQUFjLElBQUksRUFBRSxDQUFDO29CQUM3RCxvQkFBb0IsRUFBRSxRQUFRLENBQUMsb0JBQW9CLElBQUksRUFBRTtvQkFDekQsaUJBQWlCLEVBQUUsUUFBUSxDQUFDLGlCQUFpQixJQUFJLE1BQU07b0JBQ3ZELG9CQUFvQixFQUFFLFFBQVEsQ0FBQyxvQkFBb0IsSUFBSSxFQUFFO29CQUN6RCxpQkFBaUIsRUFBRSxRQUFRLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7aUJBQ2xHO2dCQUNELE1BQU0sRUFBRTtvQkFDTixFQUFFLEVBQUUsSUFBSTtvQkFDUixLQUFLLEVBQUUsSUFBSTtvQkFDWCxJQUFJLEVBQUUsSUFBSTtvQkFDVixRQUFRLEVBQUUsSUFBSTtvQkFDZCxRQUFRLEVBQUUsSUFBSTtvQkFDZCxJQUFJLEVBQUUsSUFBSTtvQkFDVixLQUFLLEVBQUUsSUFBSTtvQkFDWCxNQUFNLEVBQUUsSUFBSTtvQkFDWixjQUFjLEVBQUUsSUFBSTtvQkFDcEIsb0JBQW9CLEVBQUUsSUFBSTtvQkFDMUIsaUJBQWlCLEVBQUUsSUFBSTtvQkFDdkIsb0JBQW9CLEVBQUUsSUFBSTtvQkFDMUIsVUFBVSxFQUFFLElBQUk7aUJBQ2pCO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDMUIsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsSUFBSSxFQUFFLGVBQWUsQ0FBQyxJQUFJLENBQUM7YUFDNUIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLG9CQUFvQixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzNDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQXlCLEVBQUUsR0FBYTtRQUNuRCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztZQUMxQixNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQzFCLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFLLENBQUM7WUFFOUIsOEJBQThCO1lBQzlCLE1BQU0sSUFBSSxHQUFHLE1BQU0sZUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7Z0JBQ3hDLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRTthQUNkLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDVixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLHdCQUF3QixFQUFFLENBQUMsQ0FBQztZQUNuRSxDQUFDO1lBRUQseUNBQXlDO1lBQ3pDLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksV0FBVyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQztnQkFDN0QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO1lBQzFELENBQUM7WUFFRCxnQ0FBZ0M7WUFDaEMsTUFBTSxVQUFVLEdBQVEsRUFBRSxHQUFHLFFBQVEsRUFBRSxDQUFDO1lBRXhDLCtCQUErQjtZQUMvQixJQUFJLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDbkIsVUFBVSxDQUFDLGFBQWEsR0FBRyxNQUFNLGtCQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ2pFLE9BQU8sVUFBVSxDQUFDLEtBQUssQ0FBQztZQUMxQixDQUFDO1lBRUQsNkJBQTZCO1lBQzdCLE1BQU0sYUFBYSxHQUFHLENBQUMsc0JBQXNCLEVBQUUsbUJBQW1CLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztZQUM1RixhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQzlCLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUNwQyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNoRCxDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxtQ0FBbUM7WUFDbkMsSUFBSSxVQUFVLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQzlCLFVBQVUsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDeEUsQ0FBQztZQUNELElBQUksVUFBVSxDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBQ2pDLFVBQVUsQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQzlFLENBQUM7WUFFRCxNQUFNLGNBQWMsR0FBRyxNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUM5QyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUU7Z0JBQ2IsSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLE1BQU0sRUFBRTtvQkFDTixFQUFFLEVBQUUsSUFBSTtvQkFDUixLQUFLLEVBQUUsSUFBSTtvQkFDWCxJQUFJLEVBQUUsSUFBSTtvQkFDVixRQUFRLEVBQUUsSUFBSTtvQkFDZCxRQUFRLEVBQUUsSUFBSTtvQkFDZCxJQUFJLEVBQUUsSUFBSTtvQkFDVixLQUFLLEVBQUUsSUFBSTtvQkFDWCxNQUFNLEVBQUUsSUFBSTtvQkFDWixjQUFjLEVBQUUsSUFBSTtvQkFDcEIsb0JBQW9CLEVBQUUsSUFBSTtvQkFDMUIsaUJBQWlCLEVBQUUsSUFBSTtvQkFDdkIsb0JBQW9CLEVBQUUsSUFBSTtvQkFDMUIsaUJBQWlCLEVBQUUsSUFBSTtvQkFDdkIsVUFBVSxFQUFFLElBQUk7aUJBQ2pCO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUNkLE9BQU8sRUFBRSxJQUFJO2dCQUNiLElBQUksRUFBRSxlQUFlLENBQUMsY0FBYyxDQUFDO2FBQ3RDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMzQyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUF5QixFQUFFLEdBQWE7UUFDdkQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxFQUFFLEVBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7WUFFMUIsTUFBTSxJQUFJLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztnQkFDeEMsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNWLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDO1lBQ25FLENBQUM7WUFFRCxNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUN2QixLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUU7Z0JBQ2IsSUFBSSxFQUFFLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRTthQUM1QixDQUFDLENBQUM7WUFFSCxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7Z0JBQ2QsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsT0FBTyxFQUFFLGdDQUFnQzthQUMxQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0JBQXdCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDL0MsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSwwQkFBMEIsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxjQUFjLENBQUMsR0FBeUIsRUFBRSxHQUFhO1FBQzNELElBQUksQ0FBQztZQUNILE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO1lBQzFCLE1BQU0sRUFBRSxLQUFLLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztZQUVqQyxNQUFNLElBQUksR0FBRyxNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO2dCQUN4QyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUU7YUFDZCxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ1YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSx3QkFBd0IsRUFBRSxDQUFDLENBQUM7WUFDbkUsQ0FBQztZQUVELGtDQUFrQztZQUNsQyxNQUFNLFlBQVksR0FBRyxFQUFFLENBQUM7WUFDeEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUV4QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3ZDLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNsRSxNQUFNLFNBQVMsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNuRSxNQUFNLE1BQU0sR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFFaEYsTUFBTSxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBRSxVQUFVLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7b0JBQzFGLGVBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO3dCQUNoQixLQUFLLEVBQUU7NEJBQ0wsV0FBVyxFQUFFLEVBQUU7NEJBQ2YsVUFBVSxFQUFFLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFO3lCQUM1QztxQkFDRixDQUFDO29CQUNGLGVBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO3dCQUNoQixLQUFLLEVBQUU7NEJBQ0wsV0FBVyxFQUFFLEVBQUU7NEJBQ2YsTUFBTSxFQUFFLFlBQVk7NEJBQ3BCLFVBQVUsRUFBRSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRTt5QkFDNUM7cUJBQ0YsQ0FBQztvQkFDRixlQUFNLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQzt3QkFDdEIsS0FBSyxFQUFFOzRCQUNMLFdBQVcsRUFBRSxFQUFFOzRCQUNmLE1BQU0sRUFBRSxPQUFPOzRCQUNmLFVBQVUsRUFBRSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRTt5QkFDNUM7cUJBQ0YsQ0FBQztvQkFDRixlQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQzt3QkFDMUIsS0FBSyxFQUFFOzRCQUNMLFdBQVcsRUFBRSxFQUFFOzRCQUNmLE1BQU0sRUFBRSxPQUFPOzRCQUNmLFVBQVUsRUFBRSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRTt5QkFDNUM7d0JBQ0QsSUFBSSxFQUFFLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRTtxQkFDL0IsQ0FBQztpQkFDSCxDQUFDLENBQUM7Z0JBRUgsWUFBWSxDQUFDLElBQUksQ0FBQztvQkFDaEIsR0FBRyxFQUFFLFNBQVMsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUM7b0JBQzNFLGNBQWM7b0JBQ2QsZ0JBQWdCO29CQUNoQixpQkFBaUI7b0JBQ2pCLGFBQWEsRUFBRSxjQUFjLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixHQUFHLGNBQWMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDakYsVUFBVSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxJQUFJLENBQUM7aUJBQ2hELENBQUMsQ0FBQztZQUNMLENBQUM7WUFFRCxrQ0FBa0M7WUFDbEMsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBRXZCLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztnQkFDZCxPQUFPLEVBQUUsSUFBSTtnQkFDYixJQUFJLEVBQUU7b0JBQ0osUUFBUSxFQUFFO3dCQUNSLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTt3QkFDWCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7d0JBQ2Ysb0JBQW9CLEVBQUUsSUFBSSxDQUFDLG9CQUFvQjt3QkFDL0MsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtxQkFDMUM7b0JBQ0QsV0FBVyxFQUFFLFlBQVk7aUJBQzFCO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQy9DLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsY0FBYyxDQUFDLEdBQXlCLEVBQUUsR0FBYTtRQUMzRCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztZQUMxQixNQUFNLEVBQUUsSUFBSSxHQUFHLENBQUMsRUFBRSxLQUFLLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztZQUUzQyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRTNCLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO2dCQUN2QyxlQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztvQkFDbkIsS0FBSyxFQUFFO3dCQUNMLFdBQVcsRUFBRSxFQUFFO3dCQUNmLE1BQU0sRUFBRTs0QkFDTixLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLFdBQVcsQ0FBQzt5QkFDOUM7cUJBQ0Y7b0JBQ0QsSUFBSTtvQkFDSixJQUFJO29CQUNKLE9BQU8sRUFBRSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUU7b0JBQy9CLE9BQU8sRUFBRTt3QkFDUCxPQUFPLEVBQUU7NEJBQ1AsTUFBTSxFQUFFO2dDQUNOLEtBQUssRUFBRSxJQUFJO2dDQUNYLE1BQU0sRUFBRSxJQUFJO2dDQUNaLFdBQVcsRUFBRSxJQUFJO2dDQUNqQixLQUFLLEVBQUU7b0NBQ0wsZ0ZBQWdGO29DQUNoRixLQUFLLEVBQUU7d0NBQ0wsdUZBQXVGO3dDQUN2Riw2RUFBNkU7d0NBQzdFLHlFQUF5RTt3Q0FDekUsa0VBQWtFO3dDQUNsRSxLQUFLLEVBQUUsQ0FBQztxQ0FDVDtvQ0FDRCxJQUFJLEVBQUUsQ0FBQztvQ0FDUCxNQUFNLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUscUNBQXFDO2lDQUM3RDs2QkFDRjt5QkFDRjtxQkFDRjtpQkFDRixDQUFDO2dCQUNGLGVBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO29CQUNoQixLQUFLLEVBQUU7d0JBQ0wsV0FBVyxFQUFFLEVBQUU7d0JBQ2YsTUFBTSxFQUFFOzRCQUNOLEtBQUssRUFBRSxDQUFDLFlBQVksRUFBRSxTQUFTLEVBQUUsV0FBVyxDQUFDO3lCQUM5QztxQkFDRjtpQkFDRixDQUFDO2FBQ0gsQ0FBQyxDQUFDO1lBRUgsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUNkLE9BQU8sRUFBRSxJQUFJO2dCQUNiLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDdkIsR0FBRyxJQUFJO29CQUNQLGlFQUFpRTtvQkFDakUsT0FBTyxFQUFFO3dCQUNQLEdBQUcsSUFBSSxDQUFDLE9BQU87d0JBQ2YsY0FBYyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxJQUFJO3FCQUNuRDtpQkFDRixDQUFDLENBQUM7Z0JBQ0gsSUFBSSxFQUFFO29CQUNKLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUNsQixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQztvQkFDcEIsS0FBSztvQkFDTCxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUM3QzthQUNGLENBQUMsQ0FBQztRQUNMLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNoRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbGZELHdDQWtmQztBQUVZLFFBQUEsY0FBYyxHQUFHLElBQUksY0FBYyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IGJjcnlwdCBmcm9tICdiY3J5cHRqcyc7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tICcuLi9saWIvcHJpc21hJztcbmltcG9ydCB7IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG4vLyBIZWxwZXIgdG8gcGFyc2Uvc3RyaW5naWZ5IGZpZWxkc1xuY29uc3QgcGFyc2VVc2VyRmllbGRzID0gKHVzZXI6IGFueSkgPT4ge1xuICBpZiAoIXVzZXIpIHJldHVybiBudWxsO1xuICByZXR1cm4ge1xuICAgIC4uLnVzZXIsXG4gICAgZXNwZWNpYWxpZGFkZXM6IHVzZXIuZXNwZWNpYWxpZGFkZXMgPyBKU09OLnBhcnNlKHVzZXIuZXNwZWNpYWxpZGFkZXMpIDogW10sXG4gICAgcmVncmFzX2F0cmlidWljYW86IHVzZXIucmVncmFzX2F0cmlidWljYW8gPyBKU09OLnBhcnNlKHVzZXIucmVncmFzX2F0cmlidWljYW8pIDogbnVsbCxcbiAgfTtcbn07XG5cbmV4cG9ydCBjbGFzcyBVc2VyQ29udHJvbGxlciB7XG4gIC8qKlxuICAgKiBMaXN0YXIgdXN1w6FyaW9zXG4gICAqL1xuICBhc3luYyBsaXN0KHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qge1xuICAgICAgICBwYWdlID0gMSxcbiAgICAgICAgbGltaXQgPSAyMCxcbiAgICAgICAgcm9sZSxcbiAgICAgICAgc3RhdHVzLFxuICAgICAgICBzZWFyY2gsXG4gICAgICAgIHNvcnRCeSA9ICdub21lJyxcbiAgICAgICAgc29ydE9yZGVyID0gJ2FzYycsXG4gICAgICB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgICBjb25zdCBza2lwID0gKE51bWJlcihwYWdlKSAtIDEpICogTnVtYmVyKGxpbWl0KTtcbiAgICAgIGNvbnN0IHRha2UgPSBOdW1iZXIobGltaXQpO1xuXG4gICAgICBjb25zdCB3aGVyZTogYW55ID0ge307XG5cbiAgICAgIGlmIChyb2xlKSB3aGVyZS5yb2xlID0gcm9sZSBhcyBzdHJpbmc7XG4gICAgICBpZiAoc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBzdGF0dXMgYXMgc3RyaW5nO1xuXG4gICAgICBpZiAoc2VhcmNoKSB7XG4gICAgICAgIHdoZXJlLk9SID0gW1xuICAgICAgICAgIHsgbm9tZTogeyBjb250YWluczogc2VhcmNoIGFzIHN0cmluZyB9IH0sIC8vIFNRTGl0ZSBkb2Vzbid0IHN1cHBvcnQgbW9kZTogJ2luc2Vuc2l0aXZlJyBlYXNpbHksIHJlbW92aW5nIGl0IG9yIHVzaW5nIHJhdyBxdWVyeSBpZiBuZWVkZWQuIFByaXNtYSBlbXVsYXRlcyBpdD8gTGV0J3MgdHJ5IGRlZmF1bHQuXG4gICAgICAgICAgeyBlbWFpbDogeyBjb250YWluczogc2VhcmNoIGFzIHN0cmluZyB9IH0sXG4gICAgICAgIF07XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IFt1c2VycywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICBwcmlzbWEudXNlci5maW5kTWFueSh7XG4gICAgICAgICAgd2hlcmUsXG4gICAgICAgICAgc2tpcCxcbiAgICAgICAgICB0YWtlLFxuICAgICAgICAgIG9yZGVyQnk6IHsgW3NvcnRCeSBhcyBzdHJpbmddOiBzb3J0T3JkZXIgfSxcbiAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgICAgdGVsZWZvbmU6IHRydWUsXG4gICAgICAgICAgICBmb3RvX3VybDogdHJ1ZSxcbiAgICAgICAgICAgIHJvbGU6IHRydWUsXG4gICAgICAgICAgICBuaXZlbDogdHJ1ZSxcbiAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgIGVzcGVjaWFsaWRhZGVzOiB0cnVlLFxuICAgICAgICAgICAgbWV0YV9tZW5zYWxfdW5pZGFkZXM6IHRydWUsXG4gICAgICAgICAgICBtZXRhX21lbnNhbF92YWxvcjogdHJ1ZSxcbiAgICAgICAgICAgIGNhcGFjaWRhZGVfbWF4X2xlYWRzOiB0cnVlLFxuICAgICAgICAgICAgY3JlYXRlZF9hdDogdHJ1ZSxcbiAgICAgICAgICAgIF9jb3VudDoge1xuICAgICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgICBsZWFkc19hdHJpYnVpZG9zOiB7XG4gICAgICAgICAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICBub3RJbjogWydDT05WRVJUSURPJywgJ1BFUkRJRE8nLCAnQVJRVUlWQURPJ10sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgbmVnb2NpYWNvZXM6IHRydWUsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlIH0pLFxuICAgICAgXSk7XG5cbiAgICAgIC8vIENhbGN1bGFyIHRheGEgZGUgY29udmVyc8OjbyBwYXJhIGNhZGEgdmVuZGVkb3JcbiAgICAgIGNvbnN0IHVzZXJzQ29tTWV0cmljYXMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgdXNlcnMubWFwKGFzeW5jIChyYXdVc2VyKSA9PiB7XG4gICAgICAgICAgY29uc3QgdXNlciA9IHBhcnNlVXNlckZpZWxkcyhyYXdVc2VyKTtcbiAgICAgICAgICBpZiAodXNlci5yb2xlICE9PSAnVkVOREVET1InKSByZXR1cm4gdXNlcjtcblxuICAgICAgICAgIGNvbnN0IGluaWNpb01lcyA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgaW5pY2lvTWVzLnNldERhdGUoMSk7XG4gICAgICAgICAgaW5pY2lvTWVzLnNldEhvdXJzKDAsIDAsIDAsIDApO1xuXG4gICAgICAgICAgY29uc3QgW2xlYWRzUmVjZWJpZG9zLCB2ZW5kYXNSZWFsaXphZGFzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAgIHByaXNtYS5sZWFkLmNvdW50KHtcbiAgICAgICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgICAgICB2ZW5kZWRvcl9pZDogdXNlci5pZCxcbiAgICAgICAgICAgICAgICBjcmVhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHByaXNtYS5sZWFkLmNvdW50KHtcbiAgICAgICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgICAgICB2ZW5kZWRvcl9pZDogdXNlci5pZCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdDT05WRVJUSURPJyxcbiAgICAgICAgICAgICAgICB1cGRhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdKTtcblxuICAgICAgICAgIGNvbnN0IHRheGFDb252ZXJzYW8gPSBsZWFkc1JlY2ViaWRvcyA+IDAgPyAodmVuZGFzUmVhbGl6YWRhcyAvIGxlYWRzUmVjZWJpZG9zKSAqIDEwMCA6IDA7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4udXNlcixcbiAgICAgICAgICAgIG1ldHJpY2FzOiB7XG4gICAgICAgICAgICAgIGxlYWRzUmVjZWJpZG9zLFxuICAgICAgICAgICAgICB2ZW5kYXNSZWFsaXphZGFzLFxuICAgICAgICAgICAgICB0YXhhQ29udmVyc2FvOiBNYXRoLnJvdW5kKHRheGFDb252ZXJzYW8gKiAxMDApIC8gMTAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9O1xuICAgICAgICB9KVxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogdXNlcnNDb21NZXRyaWNhcyxcbiAgICAgICAgbWV0YToge1xuICAgICAgICAgIHBhZ2U6IE51bWJlcihwYWdlKSxcbiAgICAgICAgICBsaW1pdDogTnVtYmVyKGxpbWl0KSxcbiAgICAgICAgICB0b3RhbCxcbiAgICAgICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBOdW1iZXIobGltaXQpKSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdMaXN0IHVzZXJzIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgZGV0YWxoZXMgZGUgdW0gdXN1w6FyaW9cbiAgICovXG4gIGFzeW5jIGdldEJ5SWQocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGlkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgIG5vbWU6IHRydWUsXG4gICAgICAgICAgdGVsZWZvbmU6IHRydWUsXG4gICAgICAgICAgZm90b191cmw6IHRydWUsXG4gICAgICAgICAgcm9sZTogdHJ1ZSxcbiAgICAgICAgICBuaXZlbDogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgZXNwZWNpYWxpZGFkZXM6IHRydWUsXG4gICAgICAgICAgbWV0YV9tZW5zYWxfdW5pZGFkZXM6IHRydWUsXG4gICAgICAgICAgbWV0YV9tZW5zYWxfdmFsb3I6IHRydWUsXG4gICAgICAgICAgY2FwYWNpZGFkZV9tYXhfbGVhZHM6IHRydWUsXG4gICAgICAgICAgcmVncmFzX2F0cmlidWljYW86IHRydWUsXG4gICAgICAgICAgY3JlYXRlZF9hdDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdVc3XDoXJpbyBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBwYXJzZVVzZXJGaWVsZHModXNlciksXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignR2V0IHVzZXIgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmlhciB1c3XDoXJpbyAoYXBlbmFzIGFkbWluKVxuICAgKi9cbiAgYXN5bmMgY3JlYXRlKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXNlckRhdGEgPSByZXEuYm9keTtcblxuICAgICAgLy8gVmVyaWZpY2FyIHNlIGVtYWlsIGrDoSBleGlzdGVcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGVtYWlsOiB1c2VyRGF0YS5lbWFpbCB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChleGlzdGluZykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDkpLmpzb24oeyBlcnJvcjogJ0VtYWlsIGrDoSBjYWRhc3RyYWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gSGFzaCBkYSBzZW5oYVxuICAgICAgY29uc3QgcGFzc3dvcmRIYXNoID0gYXdhaXQgYmNyeXB0Lmhhc2godXNlckRhdGEuc2VuaGEgfHwgJ3NlbmhhMTIzJywgMTApO1xuXG4gICAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGVtYWlsOiB1c2VyRGF0YS5lbWFpbCxcbiAgICAgICAgICBwYXNzd29yZF9oYXNoOiBwYXNzd29yZEhhc2gsXG4gICAgICAgICAgbm9tZTogdXNlckRhdGEubm9tZSxcbiAgICAgICAgICB0ZWxlZm9uZTogdXNlckRhdGEudGVsZWZvbmUsXG4gICAgICAgICAgZm90b191cmw6IHVzZXJEYXRhLmZvdG9fdXJsLFxuICAgICAgICAgIHJvbGU6IHVzZXJEYXRhLnJvbGUgfHwgJ1ZFTkRFRE9SJyxcbiAgICAgICAgICBuaXZlbDogdXNlckRhdGEubml2ZWwsXG4gICAgICAgICAgc3RhdHVzOiB1c2VyRGF0YS5zdGF0dXMgfHwgJ0FUSVZPJyxcbiAgICAgICAgICBlc3BlY2lhbGlkYWRlczogSlNPTi5zdHJpbmdpZnkodXNlckRhdGEuZXNwZWNpYWxpZGFkZXMgfHwgW10pLFxuICAgICAgICAgIG1ldGFfbWVuc2FsX3VuaWRhZGVzOiB1c2VyRGF0YS5tZXRhX21lbnNhbF91bmlkYWRlcyB8fCAxMCxcbiAgICAgICAgICBtZXRhX21lbnNhbF92YWxvcjogdXNlckRhdGEubWV0YV9tZW5zYWxfdmFsb3IgfHwgNTAwMDAwLFxuICAgICAgICAgIGNhcGFjaWRhZGVfbWF4X2xlYWRzOiB1c2VyRGF0YS5jYXBhY2lkYWRlX21heF9sZWFkcyB8fCAxNSxcbiAgICAgICAgICByZWdyYXNfYXRyaWJ1aWNhbzogdXNlckRhdGEucmVncmFzX2F0cmlidWljYW8gPyBKU09OLnN0cmluZ2lmeSh1c2VyRGF0YS5yZWdyYXNfYXRyaWJ1aWNhbykgOiBudWxsLFxuICAgICAgICB9LFxuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgICBub21lOiB0cnVlLFxuICAgICAgICAgIHRlbGVmb25lOiB0cnVlLFxuICAgICAgICAgIGZvdG9fdXJsOiB0cnVlLFxuICAgICAgICAgIHJvbGU6IHRydWUsXG4gICAgICAgICAgbml2ZWw6IHRydWUsXG4gICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgIGVzcGVjaWFsaWRhZGVzOiB0cnVlLFxuICAgICAgICAgIG1ldGFfbWVuc2FsX3VuaWRhZGVzOiB0cnVlLFxuICAgICAgICAgIG1ldGFfbWVuc2FsX3ZhbG9yOiB0cnVlLFxuICAgICAgICAgIGNhcGFjaWRhZGVfbWF4X2xlYWRzOiB0cnVlLFxuICAgICAgICAgIGNyZWF0ZWRfYXQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAxKS5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogcGFyc2VVc2VyRmllbGRzKHVzZXIpLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0NyZWF0ZSB1c2VyIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXR1YWxpemFyIHVzdcOhcmlvXG4gICAqL1xuICBhc3luYyB1cGRhdGUocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGlkIH0gPSByZXEucGFyYW1zO1xuICAgICAgY29uc3QgdXNlckRhdGEgPSByZXEuYm9keTtcbiAgICAgIGNvbnN0IGN1cnJlbnRVc2VyID0gcmVxLnVzZXIhO1xuXG4gICAgICAvLyBWZXJpZmljYXIgc2UgdXN1w6FyaW8gZXhpc3RlXG4gICAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCF1c2VyKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnVXN1w6FyaW8gbsOjbyBlbmNvbnRyYWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gVmVuZGVkb3JlcyBzw7MgcG9kZW0gZWRpdGFyIGEgc2kgbWVzbW9zXG4gICAgICBpZiAoY3VycmVudFVzZXIucm9sZSA9PT0gJ1ZFTkRFRE9SJyAmJiBjdXJyZW50VXNlci5pZCAhPT0gaWQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICdBY2Vzc28gbmVnYWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gUHJlcGFyYXIgZGFkb3MgZGUgYXR1YWxpemHDp8Ojb1xuICAgICAgY29uc3QgdXBkYXRlRGF0YTogYW55ID0geyAuLi51c2VyRGF0YSB9O1xuXG4gICAgICAvLyBTZSBlc3RpdmVyIGF0dWFsaXphbmRvIHNlbmhhXG4gICAgICBpZiAodXNlckRhdGEuc2VuaGEpIHtcbiAgICAgICAgdXBkYXRlRGF0YS5wYXNzd29yZF9oYXNoID0gYXdhaXQgYmNyeXB0Lmhhc2godXNlckRhdGEuc2VuaGEsIDEwKTtcbiAgICAgICAgZGVsZXRlIHVwZGF0ZURhdGEuc2VuaGE7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbnZlcnRlciBjYW1wb3MgbnVtw6lyaWNvc1xuICAgICAgY29uc3QgbnVtZXJpY0ZpZWxkcyA9IFsnbWV0YV9tZW5zYWxfdW5pZGFkZXMnLCAnbWV0YV9tZW5zYWxfdmFsb3InLCAnY2FwYWNpZGFkZV9tYXhfbGVhZHMnXTtcbiAgICAgIG51bWVyaWNGaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcbiAgICAgICAgaWYgKHVwZGF0ZURhdGFbZmllbGRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB1cGRhdGVEYXRhW2ZpZWxkXSA9IE51bWJlcih1cGRhdGVEYXRhW2ZpZWxkXSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBTZXJpYWxpemUgSlNPTiBmaWVsZHMgaWYgcHJlc2VudFxuICAgICAgaWYgKHVwZGF0ZURhdGEuZXNwZWNpYWxpZGFkZXMpIHtcbiAgICAgICAgdXBkYXRlRGF0YS5lc3BlY2lhbGlkYWRlcyA9IEpTT04uc3RyaW5naWZ5KHVwZGF0ZURhdGEuZXNwZWNpYWxpZGFkZXMpO1xuICAgICAgfVxuICAgICAgaWYgKHVwZGF0ZURhdGEucmVncmFzX2F0cmlidWljYW8pIHtcbiAgICAgICAgdXBkYXRlRGF0YS5yZWdyYXNfYXRyaWJ1aWNhbyA9IEpTT04uc3RyaW5naWZ5KHVwZGF0ZURhdGEucmVncmFzX2F0cmlidWljYW8pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB1c2VyQXR1YWxpemFkbyA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIGRhdGE6IHVwZGF0ZURhdGEsXG4gICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgIG5vbWU6IHRydWUsXG4gICAgICAgICAgdGVsZWZvbmU6IHRydWUsXG4gICAgICAgICAgZm90b191cmw6IHRydWUsXG4gICAgICAgICAgcm9sZTogdHJ1ZSxcbiAgICAgICAgICBuaXZlbDogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgZXNwZWNpYWxpZGFkZXM6IHRydWUsXG4gICAgICAgICAgbWV0YV9tZW5zYWxfdW5pZGFkZXM6IHRydWUsXG4gICAgICAgICAgbWV0YV9tZW5zYWxfdmFsb3I6IHRydWUsXG4gICAgICAgICAgY2FwYWNpZGFkZV9tYXhfbGVhZHM6IHRydWUsXG4gICAgICAgICAgcmVncmFzX2F0cmlidWljYW86IHRydWUsXG4gICAgICAgICAgdXBkYXRlZF9hdDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBwYXJzZVVzZXJGaWVsZHModXNlckF0dWFsaXphZG8pLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VwZGF0ZSB1c2VyIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVzYXRpdmFyIHVzdcOhcmlvXG4gICAqL1xuICBhc3luYyBkZWFjdGl2YXRlKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBpZCB9ID0gcmVxLnBhcmFtcztcblxuICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghdXNlcikge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ1VzdcOhcmlvIG7Do28gZW5jb250cmFkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiAnSU5BVElWTycgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiAnVXN1w6FyaW8gZGVzYXRpdmFkbyBjb20gc3VjZXNzbycsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRGVhY3RpdmF0ZSB1c2VyIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgcGVyZm9ybWFuY2UgZG8gdmVuZGVkb3JcbiAgICovXG4gIGFzeW5jIGdldFBlcmZvcm1hbmNlKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBpZCB9ID0gcmVxLnBhcmFtcztcbiAgICAgIGNvbnN0IHsgbWVzZXMgPSAxMiB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCF1c2VyKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnVXN1w6FyaW8gbsOjbyBlbmNvbnRyYWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gR2VyYXIgZGFkb3MgZG9zIMO6bHRpbW9zIE4gbWVzZXNcbiAgICAgIGNvbnN0IGRhZG9zTWVuc2FpcyA9IFtdO1xuICAgICAgY29uc3QgaG9qZSA9IG5ldyBEYXRlKCk7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTnVtYmVyKG1lc2VzKTsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgRGF0ZShob2plLmdldEZ1bGxZZWFyKCksIGhvamUuZ2V0TW9udGgoKSAtIGksIDEpO1xuICAgICAgICBjb25zdCBpbmljaW9NZXMgPSBuZXcgRGF0ZShkYXRhLmdldEZ1bGxZZWFyKCksIGRhdGEuZ2V0TW9udGgoKSwgMSk7XG4gICAgICAgIGNvbnN0IGZpbU1lcyA9IG5ldyBEYXRlKGRhdGEuZ2V0RnVsbFllYXIoKSwgZGF0YS5nZXRNb250aCgpICsgMSwgMCwgMjMsIDU5LCA1OSk7XG5cbiAgICAgICAgY29uc3QgW2xlYWRzUmVjZWJpZG9zLCBsZWFkc0NvbnZlcnRpZG9zLCBuZWdvY2lhY29lc0dhbmhhcywgdmFsb3JUb3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgcHJpc21hLmxlYWQuY291bnQoe1xuICAgICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgICAgdmVuZGVkb3JfaWQ6IGlkLFxuICAgICAgICAgICAgICBjcmVhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzLCBsdGU6IGZpbU1lcyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBwcmlzbWEubGVhZC5jb3VudCh7XG4gICAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgICB2ZW5kZWRvcl9pZDogaWQsXG4gICAgICAgICAgICAgIHN0YXR1czogJ0NPTlZFUlRJRE8nLFxuICAgICAgICAgICAgICB1cGRhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzLCBsdGU6IGZpbU1lcyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBwcmlzbWEubmVnb2NpYWNhby5jb3VudCh7XG4gICAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgICB2ZW5kZWRvcl9pZDogaWQsXG4gICAgICAgICAgICAgIHN0YXR1czogJ0dBTkhPJyxcbiAgICAgICAgICAgICAgY3JlYXRlZF9hdDogeyBndGU6IGluaWNpb01lcywgbHRlOiBmaW1NZXMgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgICAgcHJpc21hLm5lZ29jaWFjYW8uYWdncmVnYXRlKHtcbiAgICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAgIHZlbmRlZG9yX2lkOiBpZCxcbiAgICAgICAgICAgICAgc3RhdHVzOiAnR0FOSE8nLFxuICAgICAgICAgICAgICBjcmVhdGVkX2F0OiB7IGd0ZTogaW5pY2lvTWVzLCBsdGU6IGZpbU1lcyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF9zdW06IHsgdmFsb3JfcHJvcG9zdGE6IHRydWUgfSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSk7XG5cbiAgICAgICAgZGFkb3NNZW5zYWlzLnB1c2goe1xuICAgICAgICAgIG1lczogaW5pY2lvTWVzLnRvTG9jYWxlU3RyaW5nKCdwdC1CUicsIHsgbW9udGg6ICdzaG9ydCcsIHllYXI6ICdudW1lcmljJyB9KSxcbiAgICAgICAgICBsZWFkc1JlY2ViaWRvcyxcbiAgICAgICAgICBsZWFkc0NvbnZlcnRpZG9zLFxuICAgICAgICAgIG5lZ29jaWFjb2VzR2FuaGFzLFxuICAgICAgICAgIHRheGFDb252ZXJzYW86IGxlYWRzUmVjZWJpZG9zID4gMCA/IChsZWFkc0NvbnZlcnRpZG9zIC8gbGVhZHNSZWNlYmlkb3MpICogMTAwIDogMCxcbiAgICAgICAgICB2YWxvclRvdGFsOiB2YWxvclRvdGFsLl9zdW0udmFsb3JfcHJvcG9zdGEgfHwgMCxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEludmVydGVyIHBhcmEgb3JkZW0gY3Jvbm9sw7NnaWNhXG4gICAgICBkYWRvc01lbnNhaXMucmV2ZXJzZSgpO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgdmVuZGVkb3I6IHtcbiAgICAgICAgICAgIGlkOiB1c2VyLmlkLFxuICAgICAgICAgICAgbm9tZTogdXNlci5ub21lLFxuICAgICAgICAgICAgbWV0YV9tZW5zYWxfdW5pZGFkZXM6IHVzZXIubWV0YV9tZW5zYWxfdW5pZGFkZXMsXG4gICAgICAgICAgICBtZXRhX21lbnNhbF92YWxvcjogdXNlci5tZXRhX21lbnNhbF92YWxvcixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBlcmZvcm1hbmNlOiBkYWRvc01lbnNhaXMsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignR2V0IHBlcmZvcm1hbmNlIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgbGVhZHMgYXR1YWlzIGRvIHZlbmRlZG9yXG4gICAqL1xuICBhc3luYyBnZXRMZWFkc0F0dWFpcyhyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgICBjb25zdCB7IHBhZ2UgPSAxLCBsaW1pdCA9IDEwIH0gPSByZXEucXVlcnk7XG5cbiAgICAgIGNvbnN0IHNraXAgPSAoTnVtYmVyKHBhZ2UpIC0gMSkgKiBOdW1iZXIobGltaXQpO1xuICAgICAgY29uc3QgdGFrZSA9IE51bWJlcihsaW1pdCk7XG5cbiAgICAgIGNvbnN0IFtsZWFkcywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICBwcmlzbWEubGVhZC5maW5kTWFueSh7XG4gICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgIHZlbmRlZG9yX2lkOiBpZCxcbiAgICAgICAgICAgIHN0YXR1czoge1xuICAgICAgICAgICAgICBub3RJbjogWydDT05WRVJUSURPJywgJ1BFUkRJRE8nLCAnQVJRVUlWQURPJ10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2tpcCxcbiAgICAgICAgICB0YWtlLFxuICAgICAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZF9hdDogJ2Rlc2MnIH0sXG4gICAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgICAgdmVpY3Vsbzoge1xuICAgICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgICBtYXJjYTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBtb2RlbG86IHRydWUsXG4gICAgICAgICAgICAgICAgcHJlY29fdmVuZGE6IHRydWUsXG4gICAgICAgICAgICAgICAgZm90b3M6IHsgLy8gTm90ZTogRm90byBtb2RlbCBtaWdodCBjaGVjayB2YWxpZGl0eSBidXQgUmVsYXRpb24gaXMgZmluZVxuICAgICAgICAgICAgICAgICAgLy8gSG93ZXZlciwgdmVyaWZ5IGlmICdmb3RvcycgaXMgY29tcGF0aWJsZS4gSW4gc2NoZW1hIGl0IGlzIGEgcmVsYXRpb24sIHNvIHllcy5cbiAgICAgICAgICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHByaW5jaXBhbDogdHJ1ZSwgLy8gRVJST1I6IFNjaGVtYSBkb2Vzbid0IGhhdmUgJ3ByaW5jaXBhbCcgYm9vbGVhbiBpbiBGb3RvIGFueW1vcmU/IFxuICAgICAgICAgICAgICAgICAgICAvLyBXYWl0LCBzY2hlbWEgaGFzIGBvcmRlbWAgaW4gRm90by4gYHByaW5jaXBhbGAgaXMgcHJvYmFibHkgbG9naWMgKG9yZGVtPTApLlxuICAgICAgICAgICAgICAgICAgICAvLyBJIG5lZWQgdG8gY2hlY2sgc2NoZW1hIGZvciBGb3RvLiBTY2hlbWEgc2F5czogYG9yZGVtIEludCBAZGVmYXVsdCgwKWAuXG4gICAgICAgICAgICAgICAgICAgIC8vIFNvIGBwcmluY2lwYWw6IHRydWVgIGlzIGludmFsaWQuIEkgc2hvdWxkIGNoYW5nZSB0byBgb3JkZW06IDBgLlxuICAgICAgICAgICAgICAgICAgICBvcmRlbTogMFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHRha2U6IDEsXG4gICAgICAgICAgICAgICAgICBzZWxlY3Q6IHsgdXJsOiB0cnVlIH0sIC8vIFNjaGVtYSBoYXMgYHVybGAsIG5vdCBgdXJsX3RodW1iYC5cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgcHJpc21hLmxlYWQuY291bnQoe1xuICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICB2ZW5kZWRvcl9pZDogaWQsXG4gICAgICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICAgICAgbm90SW46IFsnQ09OVkVSVElETycsICdQRVJESURPJywgJ0FSUVVJVkFETyddLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBsZWFkcy5tYXAobGVhZCA9PiAoe1xuICAgICAgICAgIC4uLmxlYWQsXG4gICAgICAgICAgLy8gRml4IHN0cnVjdHVyZSBpZiBuZWVkZWQsIGUuZy4gdmVpY3Vsby5mb3Rvc1swXS51cmwgLT4gZm90b191cmxcbiAgICAgICAgICB2ZWljdWxvOiB7XG4gICAgICAgICAgICAuLi5sZWFkLnZlaWN1bG8sXG4gICAgICAgICAgICBmb3RvX3ByaW5jaXBhbDogbGVhZC52ZWljdWxvLmZvdG9zWzBdPy51cmwgfHwgbnVsbFxuICAgICAgICAgIH1cbiAgICAgICAgfSkpLFxuICAgICAgICBtZXRhOiB7XG4gICAgICAgICAgcGFnZTogTnVtYmVyKHBhZ2UpLFxuICAgICAgICAgIGxpbWl0OiBOdW1iZXIobGltaXQpLFxuICAgICAgICAgIHRvdGFsLFxuICAgICAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIE51bWJlcihsaW1pdCkpLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0dldCBsZWFkcyBhdHVhaXMgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgdXNlckNvbnRyb2xsZXIgPSBuZXcgVXNlckNvbnRyb2xsZXIoKTsiXX0=