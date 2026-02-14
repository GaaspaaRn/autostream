"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.veiculoController = exports.VeiculoController = void 0;
const prisma_1 = require("../lib/prisma");
class VeiculoController {
    /**
     * Listar veículos (público - catálogo)
     */
    async listPublic(req, res) {
        try {
            const { page = 1, limit = 12, categoria, marca, modelo, anoMin, anoMax, precoMin, precoMax, kmMin, kmMax, combustivel, transmissao, cor, sortBy = 'created_at', sortOrder = 'desc', } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const take = Number(limit);
            // Construir where clause
            const where = {
                status: 'DISPONIVEL',
            };
            if (categoria)
                where.categoria = categoria;
            if (marca)
                where.marca = { contains: marca };
            if (modelo)
                where.modelo = { contains: modelo };
            if (combustivel)
                where.combustivel = combustivel;
            if (transmissao)
                where.transmissao = transmissao;
            if (cor)
                where.cor = { contains: cor };
            // Faixas de ano
            if (anoMin || anoMax) {
                where.ano_modelo = {};
                if (anoMin)
                    where.ano_modelo.gte = Number(anoMin);
                if (anoMax)
                    where.ano_modelo.lte = Number(anoMax);
            }
            // Faixas de preço
            if (precoMin || precoMax) {
                where.preco_venda = {};
                if (precoMin)
                    where.preco_venda.gte = Number(precoMin);
                if (precoMax)
                    where.preco_venda.lte = Number(precoMax);
            }
            // Faixas de km
            if (kmMin || kmMax) {
                where.quilometragem = {};
                if (kmMin)
                    where.quilometragem.gte = Number(kmMin);
                if (kmMax)
                    where.quilometragem.lte = Number(kmMax);
            }
            // Buscar veículos
            const [veiculos, total] = await Promise.all([
                prisma_1.prisma.veiculo.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { [sortBy]: sortOrder },
                    include: {
                        fotos: {
                            where: { ordem: 0 },
                            take: 1,
                            select: { url: true },
                        },
                    },
                }),
                prisma_1.prisma.veiculo.count({ where }),
            ]);
            return res.json({
                success: true,
                data: veiculos,
                meta: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit)),
                },
            });
        }
        catch (error) {
            console.error('List veiculos error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter detalhes de um veículo (público)
     */
    async getBySlug(req, res) {
        try {
            const { slug } = req.params;
            const veiculo = await prisma_1.prisma.veiculo.findUnique({
                where: { slug },
                include: {
                    fotos: {
                        orderBy: { ordem: 'asc' },
                    },
                },
            });
            if (!veiculo) {
                return res.status(404).json({ error: 'Veículo não encontrado' });
            }
            // Se não estiver disponível, retornar erro
            if (veiculo.status !== 'DISPONIVEL') {
                return res.status(404).json({ error: 'Veículo não disponível' });
            }
            return res.json({
                success: true,
                data: veiculo,
            });
        }
        catch (error) {
            console.error('Get veiculo error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Listar veículos (admin)
     */
    async listAdmin(req, res) {
        try {
            const { page = 1, limit = 20, status, categoria, search, sortBy = 'created_at', sortOrder = 'desc', } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const take = Number(limit);
            const where = {};
            if (status)
                where.status = status;
            if (categoria)
                where.categoria = categoria;
            if (search) {
                where.OR = [
                    { marca: { contains: search } },
                    { modelo: { contains: search } },
                    { codigo_interno: { contains: search } },
                ];
            }
            const [veiculos, total] = await Promise.all([
                prisma_1.prisma.veiculo.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { [sortBy]: sortOrder },
                    include: {
                        fotos: {
                            where: { ordem: 0 },
                            take: 1,
                            select: { url: true },
                        },
                        _count: {
                            select: {
                                leads: true,
                                negociacoes: true,
                            },
                        },
                    },
                }),
                prisma_1.prisma.veiculo.count({ where }),
            ]);
            return res.json({
                success: true,
                data: veiculos,
                meta: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit)),
                },
            });
        }
        catch (error) {
            console.error('List admin veiculos error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter detalhes de um veículo (admin)
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const veiculo = await prisma_1.prisma.veiculo.findUnique({
                where: { id },
                include: {
                    fotos: {
                        orderBy: { ordem: 'asc' },
                    },
                    leads: {
                        select: {
                            id: true,
                            nome: true,
                            status: true,
                            created_at: true,
                        },
                        orderBy: { created_at: 'desc' },
                        take: 10,
                    },
                    negociacoes: {
                        select: {
                            id: true,
                            status: true,
                            created_at: true,
                            vendedor: {
                                select: { nome: true },
                            },
                        },
                        orderBy: { created_at: 'desc' },
                        take: 10,
                    },
                },
            });
            if (!veiculo) {
                return res.status(404).json({ error: 'Veículo não encontrado' });
            }
            return res.json({
                success: true,
                data: veiculo,
            });
        }
        catch (error) {
            console.error('Get veiculo admin error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Criar veículo
     */
    async create(req, res) {
        try {
            const veiculoData = req.body;
            // Gerar slug se não fornecido
            if (!veiculoData.slug) {
                veiculoData.slug = `${veiculoData.marca}-${veiculoData.modelo}-${veiculoData.ano_modelo}`
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^a-z0-9-]/g, '');
            }
            // Verificar se slug já existe
            const existing = await prisma_1.prisma.veiculo.findUnique({
                where: { slug: veiculoData.slug },
            });
            if (existing) {
                veiculoData.slug = `${veiculoData.slug}-${Date.now()}`;
            }
            const veiculo = await prisma_1.prisma.veiculo.create({
                data: {
                    ...veiculoData,
                    preco_venda: Number(veiculoData.preco_venda),
                    preco_custo: Number(veiculoData.preco_custo),
                    preco_minimo: veiculoData.preco_minimo ? Number(veiculoData.preco_minimo) : null,
                    ano_fabricacao: Number(veiculoData.ano_fabricacao),
                    ano_modelo: Number(veiculoData.ano_modelo),
                    portas: Number(veiculoData.portas),
                    lugares: Number(veiculoData.lugares),
                    quilometragem: Number(veiculoData.quilometragem),
                },
                include: {
                    fotos: true,
                },
            });
            return res.status(201).json({
                success: true,
                data: veiculo,
            });
        }
        catch (error) {
            console.error('Create veiculo error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Atualizar veículo
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const veiculoData = req.body;
            const veiculo = await prisma_1.prisma.veiculo.findUnique({
                where: { id },
            });
            if (!veiculo) {
                return res.status(404).json({ error: 'Veículo não encontrado' });
            }
            // Converter campos numéricos
            const updateData = { ...veiculoData };
            const numericFields = ['preco_venda', 'preco_custo', 'preco_minimo', 'ano_fabricacao', 'ano_modelo', 'portas', 'lugares', 'quilometragem'];
            numericFields.forEach((field) => {
                if (updateData[field] !== undefined) {
                    updateData[field] = Number(updateData[field]);
                }
            });
            const veiculoAtualizado = await prisma_1.prisma.veiculo.update({
                where: { id },
                data: updateData,
                include: {
                    fotos: true,
                },
            });
            return res.json({
                success: true,
                data: veiculoAtualizado,
            });
        }
        catch (error) {
            console.error('Update veiculo error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Arquivar veículo
     */
    async archive(req, res) {
        try {
            const { id } = req.params;
            const veiculo = await prisma_1.prisma.veiculo.findUnique({
                where: { id },
            });
            if (!veiculo) {
                return res.status(404).json({ error: 'Veículo não encontrado' });
            }
            await prisma_1.prisma.veiculo.update({
                where: { id },
                data: { status: 'MANUTENCAO' },
            });
            return res.json({
                success: true,
                message: 'Veículo arquivado com sucesso',
            });
        }
        catch (error) {
            console.error('Archive veiculo error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter marcas disponíveis
     */
    async getMarcas(req, res) {
        try {
            const marcas = await prisma_1.prisma.veiculo.groupBy({
                by: ['marca'],
                where: { status: 'DISPONIVEL' },
                _count: { marca: true },
                orderBy: { marca: 'asc' },
            });
            return res.json({
                success: true,
                data: marcas.map((m) => ({
                    marca: m.marca,
                    quantidade: m._count.marca,
                })),
            });
        }
        catch (error) {
            console.error('Get marcas error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter faixas de preço
     */
    async getFaixaPrecos(req, res) {
        try {
            const result = await prisma_1.prisma.veiculo.aggregate({
                where: { status: 'DISPONIVEL' },
                _min: { preco_venda: true },
                _max: { preco_venda: true },
            });
            return res.json({
                success: true,
                data: {
                    min: result._min.preco_venda || 0,
                    max: result._max.preco_venda || 0,
                },
            });
        }
        catch (error) {
            console.error('Get faixa precos error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter veículos em destaque
     */
    async getDestaques(req, res) {
        try {
            const veiculos = await prisma_1.prisma.veiculo.findMany({
                where: {
                    status: 'DISPONIVEL',
                    destaque: true,
                },
                take: 6,
                orderBy: { created_at: 'desc' },
                include: {
                    fotos: {
                        where: { ordem: 0 },
                        take: 1,
                        select: { url: true },
                    },
                },
            });
            return res.json({
                success: true,
                data: veiculos,
            });
        }
        catch (error) {
            console.error('Get destaques error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}
exports.VeiculoController = VeiculoController;
exports.veiculoController = new VeiculoController();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVpY3Vsby5jb250cm9sbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnRyb2xsZXJzL3ZlaWN1bG8uY29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwwQ0FBdUM7QUFHdkMsTUFBYSxpQkFBaUI7SUFDNUI7O09BRUc7SUFDSCxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQVksRUFBRSxHQUFhO1FBQzFDLElBQUksQ0FBQztZQUNILE1BQU0sRUFDSixJQUFJLEdBQUcsQ0FBQyxFQUNSLEtBQUssR0FBRyxFQUFFLEVBQ1YsU0FBUyxFQUNULEtBQUssRUFDTCxNQUFNLEVBQ04sTUFBTSxFQUNOLE1BQU0sRUFDTixRQUFRLEVBQ1IsUUFBUSxFQUNSLEtBQUssRUFDTCxLQUFLLEVBQ0wsV0FBVyxFQUNYLFdBQVcsRUFDWCxHQUFHLEVBQ0gsTUFBTSxHQUFHLFlBQVksRUFDckIsU0FBUyxHQUFHLE1BQU0sR0FDbkIsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDO1lBRWQsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUUzQix5QkFBeUI7WUFDekIsTUFBTSxLQUFLLEdBQVE7Z0JBQ2pCLE1BQU0sRUFBRSxZQUFZO2FBQ3JCLENBQUM7WUFFRixJQUFJLFNBQVM7Z0JBQUUsS0FBSyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7WUFDM0MsSUFBSSxLQUFLO2dCQUFFLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxRQUFRLEVBQUUsS0FBZSxFQUFFLENBQUM7WUFDdkQsSUFBSSxNQUFNO2dCQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsRUFBRSxRQUFRLEVBQUUsTUFBZ0IsRUFBRSxDQUFDO1lBQzFELElBQUksV0FBVztn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RUFBRSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUU7cUJBQ3RCO2lCQUNGO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUNkLE9BQU8sRUFBRSxJQUFJO2dCQUNiLElBQUksRUFBRSxRQUFRO2FBQ2YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzdDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUF4Y0QsOENBd2NDO0FBRVksUUFBQSxpQkFBaUIsR0FBRyxJQUFJLGlCQUFpQixFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSAnLi4vbGliL3ByaXNtYSc7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGVkUmVxdWVzdCwgVmVpY3Vsb0ZpbHRlcnMgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBjbGFzcyBWZWljdWxvQ29udHJvbGxlciB7XG4gIC8qKlxuICAgKiBMaXN0YXIgdmXDrWN1bG9zIChww7pibGljbyAtIGNhdMOhbG9nbylcbiAgICovXG4gIGFzeW5jIGxpc3RQdWJsaWMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgcGFnZSA9IDEsXG4gICAgICAgIGxpbWl0ID0gMTIsXG4gICAgICAgIGNhdGVnb3JpYSxcbiAgICAgICAgbWFyY2EsXG4gICAgICAgIG1vZGVsbyxcbiAgICAgICAgYW5vTWluLFxuICAgICAgICBhbm9NYXgsXG4gICAgICAgIHByZWNvTWluLFxuICAgICAgICBwcmVjb01heCxcbiAgICAgICAga21NaW4sXG4gICAgICAgIGttTWF4LFxuICAgICAgICBjb21idXN0aXZlbCxcbiAgICAgICAgdHJhbnNtaXNzYW8sXG4gICAgICAgIGNvcixcbiAgICAgICAgc29ydEJ5ID0gJ2NyZWF0ZWRfYXQnLFxuICAgICAgICBzb3J0T3JkZXIgPSAnZGVzYycsXG4gICAgICB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgICBjb25zdCBza2lwID0gKE51bWJlcihwYWdlKSAtIDEpICogTnVtYmVyKGxpbWl0KTtcbiAgICAgIGNvbnN0IHRha2UgPSBOdW1iZXIobGltaXQpO1xuXG4gICAgICAvLyBDb25zdHJ1aXIgd2hlcmUgY2xhdXNlXG4gICAgICBjb25zdCB3aGVyZTogYW55ID0ge1xuICAgICAgICBzdGF0dXM6ICdESVNQT05JVkVMJyxcbiAgICAgIH07XG5cbiAgICAgIGlmIChjYXRlZ29yaWEpIHdoZXJlLmNhdGVnb3JpYSA9IGNhdGVnb3JpYTtcbiAgICAgIGlmIChtYXJjYSkgd2hlcmUubWFyY2EgPSB7IGNvbnRhaW5zOiBtYXJjYSBhcyBzdHJpbmcgfTtcbiAgICAgIGlmIChtb2RlbG8pIHdoZXJlLm1vZGVsbyA9IHsgY29udGFpbnM6IG1vZGVsbyBhcyBzdHJpbmcgfTtcbiAgICAgIGlmIChjb21idXN0aXZlbCkgd2hlcmUuY29tYnVzdGl2ZWwgPSBjb21idXN0aXZlbDtcbiAgICAgIGlmICh0cmFuc21pc3Nhbykgd2hlcmUudHJhbnNtaXNzYW8gPSB0cmFuc21pc3NhbztcbiAgICAgIGlmIChjb3IpIHdoZXJlLmNvciA9IHsgY29udGFpbnM6IGNvciBhcyBzdHJpbmcgfTtcblxuICAgICAgLy8gRmFpeGFzIGRlIGFub1xuICAgICAgaWYgKGFub01pbiB8fCBhbm9NYXgpIHtcbiAgICAgICAgd2hlcmUuYW5vX21vZGVsbyA9IHt9O1xuICAgICAgICBpZiAoYW5vTWluKSB3aGVyZS5hbm9fbW9kZWxvLmd0ZSA9IE51bWJlcihhbm9NaW4pO1xuICAgICAgICBpZiAoYW5vTWF4KSB3aGVyZS5hbm9fbW9kZWxvLmx0ZSA9IE51bWJlcihhbm9NYXgpO1xuICAgICAgfVxuXG4gICAgICAvLyBGYWl4YXMgZGUgcHJlw6dvXG4gICAgICBpZiAocHJlY29NaW4gfHwgcHJlY29NYXgpIHtcbiAgICAgICAgd2hlcmUucHJlY29fdmVuZGEgPSB7fTtcbiAgICAgICAgaWYgKHByZWNvTWluKSB3aGVyZS5wcmVjb192ZW5kYS5ndGUgPSBOdW1iZXIocHJlY29NaW4pO1xuICAgICAgICBpZiAocHJlY29NYXgpIHdoZXJlLnByZWNvX3ZlbmRhLmx0ZSA9IE51bWJlcihwcmVjb01heCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEZhaXhhcyBkZSBrbVxuICAgICAgaWYgKGttTWluIHx8IGttTWF4KSB7XG4gICAgICAgIHdoZXJlLnF1aWxvbWV0cmFnZW0gPSB7fTtcbiAgICAgICAgaWYgKGttTWluKSB3aGVyZS5xdWlsb21ldHJhZ2VtLmd0ZSA9IE51bWJlcihrbU1pbik7XG4gICAgICAgIGlmIChrbU1heCkgd2hlcmUucXVpbG9tZXRyYWdlbS5sdGUgPSBOdW1iZXIoa21NYXgpO1xuICAgICAgfVxuXG4gICAgICAvLyBCdXNjYXIgdmXDrWN1bG9zXG4gICAgICBjb25zdCBbdmVpY3Vsb3MsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgcHJpc21hLnZlaWN1bG8uZmluZE1hbnkoe1xuICAgICAgICAgIHdoZXJlLFxuICAgICAgICAgIHNraXAsXG4gICAgICAgICAgdGFrZSxcbiAgICAgICAgICBvcmRlckJ5OiB7IFtzb3J0QnkgYXMgc3RyaW5nXTogc29ydE9yZGVyIH0sXG4gICAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgICAgZm90b3M6IHtcbiAgICAgICAgICAgICAgd2hlcmU6IHsgb3JkZW06IDAgfSxcbiAgICAgICAgICAgICAgdGFrZTogMSxcbiAgICAgICAgICAgICAgc2VsZWN0OiB7IHVybDogdHJ1ZSB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgcHJpc21hLnZlaWN1bG8uY291bnQoeyB3aGVyZSB9KSxcbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB2ZWljdWxvcyxcbiAgICAgICAgbWV0YToge1xuICAgICAgICAgIHBhZ2U6IE51bWJlcihwYWdlKSxcbiAgICAgICAgICBsaW1pdDogTnVtYmVyKGxpbWl0KSxcbiAgICAgICAgICB0b3RhbCxcbiAgICAgICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBOdW1iZXIobGltaXQpKSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdMaXN0IHZlaWN1bG9zIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgZGV0YWxoZXMgZGUgdW0gdmXDrWN1bG8gKHDDumJsaWNvKVxuICAgKi9cbiAgYXN5bmMgZ2V0QnlTbHVnKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IHNsdWcgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICAgIGNvbnN0IHZlaWN1bG8gPSBhd2FpdCBwcmlzbWEudmVpY3Vsby5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgc2x1ZyB9LFxuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgZm90b3M6IHtcbiAgICAgICAgICAgIG9yZGVyQnk6IHsgb3JkZW06ICdhc2MnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXZlaWN1bG8pIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdWZcOtY3VsbyBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBTZSBuw6NvIGVzdGl2ZXIgZGlzcG9uw612ZWwsIHJldG9ybmFyIGVycm9cbiAgICAgIGlmICh2ZWljdWxvLnN0YXR1cyAhPT0gJ0RJU1BPTklWRUwnKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnVmXDrWN1bG8gbsOjbyBkaXNwb27DrXZlbCcgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IHZlaWN1bG8sXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignR2V0IHZlaWN1bG8gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMaXN0YXIgdmXDrWN1bG9zIChhZG1pbilcbiAgICovXG4gIGFzeW5jIGxpc3RBZG1pbihyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgcGFnZSA9IDEsXG4gICAgICAgIGxpbWl0ID0gMjAsXG4gICAgICAgIHN0YXR1cyxcbiAgICAgICAgY2F0ZWdvcmlhLFxuICAgICAgICBzZWFyY2gsXG4gICAgICAgIHNvcnRCeSA9ICdjcmVhdGVkX2F0JyxcbiAgICAgICAgc29ydE9yZGVyID0gJ2Rlc2MnLFxuICAgICAgfSA9IHJlcS5xdWVyeTtcblxuICAgICAgY29uc3Qgc2tpcCA9IChOdW1iZXIocGFnZSkgLSAxKSAqIE51bWJlcihsaW1pdCk7XG4gICAgICBjb25zdCB0YWtlID0gTnVtYmVyKGxpbWl0KTtcblxuICAgICAgY29uc3Qgd2hlcmU6IGFueSA9IHt9O1xuXG4gICAgICBpZiAoc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBzdGF0dXM7XG4gICAgICBpZiAoY2F0ZWdvcmlhKSB3aGVyZS5jYXRlZ29yaWEgPSBjYXRlZ29yaWE7XG5cbiAgICAgIGlmIChzZWFyY2gpIHtcbiAgICAgICAgd2hlcmUuT1IgPSBbXG4gICAgICAgICAgeyBtYXJjYTogeyBjb250YWluczogc2VhcmNoIGFzIHN0cmluZyB9IH0sXG4gICAgICAgICAgeyBtb2RlbG86IHsgY29udGFpbnM6IHNlYXJjaCBhcyBzdHJpbmcgfSB9LFxuICAgICAgICAgIHsgY29kaWdvX2ludGVybm86IHsgY29udGFpbnM6IHNlYXJjaCBhcyBzdHJpbmcgfSB9LFxuICAgICAgICBdO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBbdmVpY3Vsb3MsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgcHJpc21hLnZlaWN1bG8uZmluZE1hbnkoe1xuICAgICAgICAgIHdoZXJlLFxuICAgICAgICAgIHNraXAsXG4gICAgICAgICAgdGFrZSxcbiAgICAgICAgICBvcmRlckJ5OiB7IFtzb3J0QnkgYXMgc3RyaW5nXTogc29ydE9yZGVyIH0sXG4gICAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgICAgZm90b3M6IHtcbiAgICAgICAgICAgICAgd2hlcmU6IHsgb3JkZW06IDAgfSxcbiAgICAgICAgICAgICAgdGFrZTogMSxcbiAgICAgICAgICAgICAgc2VsZWN0OiB7IHVybDogdHJ1ZSB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF9jb3VudDoge1xuICAgICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgICBsZWFkczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuZWdvY2lhY29lczogdHJ1ZSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIHByaXNtYS52ZWljdWxvLmNvdW50KHsgd2hlcmUgfSksXG4gICAgICBdKTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogdmVpY3Vsb3MsXG4gICAgICAgIG1ldGE6IHtcbiAgICAgICAgICBwYWdlOiBOdW1iZXIocGFnZSksXG4gICAgICAgICAgbGltaXQ6IE51bWJlcihsaW1pdCksXG4gICAgICAgICAgdG90YWwsXG4gICAgICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gTnVtYmVyKGxpbWl0KSksXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignTGlzdCBhZG1pbiB2ZWljdWxvcyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9idGVyIGRldGFsaGVzIGRlIHVtIHZlw61jdWxvIChhZG1pbilcbiAgICovXG4gIGFzeW5jIGdldEJ5SWQocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGlkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgICBjb25zdCB2ZWljdWxvID0gYXdhaXQgcHJpc21hLnZlaWN1bG8uZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICBmb3Rvczoge1xuICAgICAgICAgICAgb3JkZXJCeTogeyBvcmRlbTogJ2FzYycgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGxlYWRzOiB7XG4gICAgICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgICAgICAgIG5vbWU6IHRydWUsXG4gICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgICAgY3JlYXRlZF9hdDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRfYXQ6ICdkZXNjJyB9LFxuICAgICAgICAgICAgdGFrZTogMTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBuZWdvY2lhY29lczoge1xuICAgICAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgICAgIGNyZWF0ZWRfYXQ6IHRydWUsXG4gICAgICAgICAgICAgIHZlbmRlZG9yOiB7XG4gICAgICAgICAgICAgICAgc2VsZWN0OiB7IG5vbWU6IHRydWUgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRfYXQ6ICdkZXNjJyB9LFxuICAgICAgICAgICAgdGFrZTogMTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXZlaWN1bG8pIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdWZcOtY3VsbyBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB2ZWljdWxvLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0dldCB2ZWljdWxvIGFkbWluIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JpYXIgdmXDrWN1bG9cbiAgICovXG4gIGFzeW5jIGNyZWF0ZShyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHZlaWN1bG9EYXRhID0gcmVxLmJvZHk7XG5cbiAgICAgIC8vIEdlcmFyIHNsdWcgc2UgbsOjbyBmb3JuZWNpZG9cbiAgICAgIGlmICghdmVpY3Vsb0RhdGEuc2x1Zykge1xuICAgICAgICB2ZWljdWxvRGF0YS5zbHVnID0gYCR7dmVpY3Vsb0RhdGEubWFyY2F9LSR7dmVpY3Vsb0RhdGEubW9kZWxvfS0ke3ZlaWN1bG9EYXRhLmFub19tb2RlbG99YFxuICAgICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgLnJlcGxhY2UoL1xccysvZywgJy0nKVxuICAgICAgICAgIC5yZXBsYWNlKC9bXmEtejAtOS1dL2csICcnKTtcbiAgICAgIH1cblxuICAgICAgLy8gVmVyaWZpY2FyIHNlIHNsdWcgasOhIGV4aXN0ZVxuICAgICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEudmVpY3Vsby5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgc2x1ZzogdmVpY3Vsb0RhdGEuc2x1ZyB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChleGlzdGluZykge1xuICAgICAgICB2ZWljdWxvRGF0YS5zbHVnID0gYCR7dmVpY3Vsb0RhdGEuc2x1Z30tJHtEYXRlLm5vdygpfWA7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHZlaWN1bG8gPSBhd2FpdCBwcmlzbWEudmVpY3Vsby5jcmVhdGUoe1xuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgLi4udmVpY3Vsb0RhdGEsXG4gICAgICAgICAgcHJlY29fdmVuZGE6IE51bWJlcih2ZWljdWxvRGF0YS5wcmVjb192ZW5kYSksXG4gICAgICAgICAgcHJlY29fY3VzdG86IE51bWJlcih2ZWljdWxvRGF0YS5wcmVjb19jdXN0byksXG4gICAgICAgICAgcHJlY29fbWluaW1vOiB2ZWljdWxvRGF0YS5wcmVjb19taW5pbW8gPyBOdW1iZXIodmVpY3Vsb0RhdGEucHJlY29fbWluaW1vKSA6IG51bGwsXG4gICAgICAgICAgYW5vX2ZhYnJpY2FjYW86IE51bWJlcih2ZWljdWxvRGF0YS5hbm9fZmFicmljYWNhbyksXG4gICAgICAgICAgYW5vX21vZGVsbzogTnVtYmVyKHZlaWN1bG9EYXRhLmFub19tb2RlbG8pLFxuICAgICAgICAgIHBvcnRhczogTnVtYmVyKHZlaWN1bG9EYXRhLnBvcnRhcyksXG4gICAgICAgICAgbHVnYXJlczogTnVtYmVyKHZlaWN1bG9EYXRhLmx1Z2FyZXMpLFxuICAgICAgICAgIHF1aWxvbWV0cmFnZW06IE51bWJlcih2ZWljdWxvRGF0YS5xdWlsb21ldHJhZ2VtKSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgIGZvdG9zOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDIwMSkuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IHZlaWN1bG8sXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignQ3JlYXRlIHZlaWN1bG8gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBdHVhbGl6YXIgdmXDrWN1bG9cbiAgICovXG4gIGFzeW5jIHVwZGF0ZShyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgICBjb25zdCB2ZWljdWxvRGF0YSA9IHJlcS5ib2R5O1xuXG4gICAgICBjb25zdCB2ZWljdWxvID0gYXdhaXQgcHJpc21hLnZlaWN1bG8uZmluZFVuaXF1ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCF2ZWljdWxvKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnVmXDrWN1bG8gbsOjbyBlbmNvbnRyYWRvJyB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29udmVydGVyIGNhbXBvcyBudW3DqXJpY29zXG4gICAgICBjb25zdCB1cGRhdGVEYXRhOiBhbnkgPSB7IC4uLnZlaWN1bG9EYXRhIH07XG4gICAgICBjb25zdCBudW1lcmljRmllbGRzID0gWydwcmVjb192ZW5kYScsICdwcmVjb19jdXN0bycsICdwcmVjb19taW5pbW8nLCAnYW5vX2ZhYnJpY2FjYW8nLCAnYW5vX21vZGVsbycsICdwb3J0YXMnLCAnbHVnYXJlcycsICdxdWlsb21ldHJhZ2VtJ107XG5cbiAgICAgIG51bWVyaWNGaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcbiAgICAgICAgaWYgKHVwZGF0ZURhdGFbZmllbGRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB1cGRhdGVEYXRhW2ZpZWxkXSA9IE51bWJlcih1cGRhdGVEYXRhW2ZpZWxkXSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB2ZWljdWxvQXR1YWxpemFkbyA9IGF3YWl0IHByaXNtYS52ZWljdWxvLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIGRhdGE6IHVwZGF0ZURhdGEsXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICBmb3RvczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB2ZWljdWxvQXR1YWxpemFkbyxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdVcGRhdGUgdmVpY3VsbyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFycXVpdmFyIHZlw61jdWxvXG4gICAqL1xuICBhc3luYyBhcmNoaXZlKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBpZCB9ID0gcmVxLnBhcmFtcztcblxuICAgICAgY29uc3QgdmVpY3VsbyA9IGF3YWl0IHByaXNtYS52ZWljdWxvLmZpbmRVbmlxdWUoe1xuICAgICAgICB3aGVyZTogeyBpZCB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghdmVpY3Vsbykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ1Zlw61jdWxvIG7Do28gZW5jb250cmFkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHByaXNtYS52ZWljdWxvLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiAnTUFOVVRFTkNBTycgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiAnVmXDrWN1bG8gYXJxdWl2YWRvIGNvbSBzdWNlc3NvJyxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdBcmNoaXZlIHZlaWN1bG8gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPYnRlciBtYXJjYXMgZGlzcG9uw612ZWlzXG4gICAqL1xuICBhc3luYyBnZXRNYXJjYXMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1hcmNhcyA9IGF3YWl0IHByaXNtYS52ZWljdWxvLmdyb3VwQnkoe1xuICAgICAgICBieTogWydtYXJjYSddLFxuICAgICAgICB3aGVyZTogeyBzdGF0dXM6ICdESVNQT05JVkVMJyB9LFxuICAgICAgICBfY291bnQ6IHsgbWFyY2E6IHRydWUgfSxcbiAgICAgICAgb3JkZXJCeTogeyBtYXJjYTogJ2FzYycgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBtYXJjYXMubWFwKChtKSA9PiAoe1xuICAgICAgICAgIG1hcmNhOiBtLm1hcmNhLFxuICAgICAgICAgIHF1YW50aWRhZGU6IG0uX2NvdW50Lm1hcmNhLFxuICAgICAgICB9KSksXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignR2V0IG1hcmNhcyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9idGVyIGZhaXhhcyBkZSBwcmXDp29cbiAgICovXG4gIGFzeW5jIGdldEZhaXhhUHJlY29zKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEudmVpY3Vsby5hZ2dyZWdhdGUoe1xuICAgICAgICB3aGVyZTogeyBzdGF0dXM6ICdESVNQT05JVkVMJyB9LFxuICAgICAgICBfbWluOiB7IHByZWNvX3ZlbmRhOiB0cnVlIH0sXG4gICAgICAgIF9tYXg6IHsgcHJlY29fdmVuZGE6IHRydWUgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgbWluOiByZXN1bHQuX21pbi5wcmVjb192ZW5kYSB8fCAwLFxuICAgICAgICAgIG1heDogcmVzdWx0Ll9tYXgucHJlY29fdmVuZGEgfHwgMCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdHZXQgZmFpeGEgcHJlY29zIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgdmXDrWN1bG9zIGVtIGRlc3RhcXVlXG4gICAqL1xuICBhc3luYyBnZXREZXN0YXF1ZXMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHZlaWN1bG9zID0gYXdhaXQgcHJpc21hLnZlaWN1bG8uZmluZE1hbnkoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIHN0YXR1czogJ0RJU1BPTklWRUwnLFxuICAgICAgICAgIGRlc3RhcXVlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICB0YWtlOiA2LFxuICAgICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRfYXQ6ICdkZXNjJyB9LFxuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgZm90b3M6IHtcbiAgICAgICAgICAgIHdoZXJlOiB7IG9yZGVtOiAwIH0sXG4gICAgICAgICAgICB0YWtlOiAxLFxuICAgICAgICAgICAgc2VsZWN0OiB7IHVybDogdHJ1ZSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogdmVpY3Vsb3MsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignR2V0IGRlc3RhcXVlcyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCB2ZWljdWxvQ29udHJvbGxlciA9IG5ldyBWZWljdWxvQ29udHJvbGxlcigpOyJdfQ==