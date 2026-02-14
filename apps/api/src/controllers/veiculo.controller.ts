import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, VeiculoFilters } from '../types';

export class VeiculoController {
  /**
   * Listar veículos (público - catálogo)
   */
  async listPublic(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 12,
        categoria,
        marca,
        modelo,
        anoMin,
        anoMax,
        precoMin,
        precoMax,
        kmMin,
        kmMax,
        combustivel,
        transmissao,
        cor,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Construir where clause
      const where: any = {
        status: 'DISPONIVEL',
      };

      if (categoria) where.categoria = categoria;
      if (marca) where.marca = { contains: marca as string };
      if (modelo) where.modelo = { contains: modelo as string };
      if (combustivel) where.combustivel = combustivel;
      if (transmissao) where.transmissao = transmissao;
      if (cor) where.cor = { contains: cor as string };

      // Faixas de ano
      if (anoMin || anoMax) {
        where.ano_modelo = {};
        if (anoMin) where.ano_modelo.gte = Number(anoMin);
        if (anoMax) where.ano_modelo.lte = Number(anoMax);
      }

      // Faixas de preço
      if (precoMin || precoMax) {
        where.preco_venda = {};
        if (precoMin) where.preco_venda.gte = Number(precoMin);
        if (precoMax) where.preco_venda.lte = Number(precoMax);
      }

      // Faixas de km
      if (kmMin || kmMax) {
        where.quilometragem = {};
        if (kmMin) where.quilometragem.gte = Number(kmMin);
        if (kmMax) where.quilometragem.lte = Number(kmMax);
      }

      // Buscar veículos
      const [veiculos, total] = await Promise.all([
        prisma.veiculo.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy as string]: sortOrder },
          include: {
            fotos: {
              where: { ordem: 0 },
              take: 1,
              select: { url: true },
            },
          },
        }),
        prisma.veiculo.count({ where }),
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
    } catch (error) {
      console.error('List veiculos error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter detalhes de um veículo (público)
   */
  async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      const veiculo = await prisma.veiculo.findUnique({
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
    } catch (error) {
      console.error('Get veiculo error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Listar veículos (admin)
   */
  async listAdmin(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        categoria,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {};

      if (status) where.status = status;
      if (categoria) where.categoria = categoria;

      if (search) {
        where.OR = [
          { marca: { contains: search as string } },
          { modelo: { contains: search as string } },
          { codigo_interno: { contains: search as string } },
        ];
      }

      const [veiculos, total] = await Promise.all([
        prisma.veiculo.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy as string]: sortOrder },
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
        prisma.veiculo.count({ where }),
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
    } catch (error) {
      console.error('List admin veiculos error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter detalhes de um veículo (admin)
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const veiculo = await prisma.veiculo.findUnique({
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
    } catch (error) {
      console.error('Get veiculo admin error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Criar veículo
   */
  async create(req: AuthenticatedRequest, res: Response) {
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
      const existing = await prisma.veiculo.findUnique({
        where: { slug: veiculoData.slug },
      });

      if (existing) {
        veiculoData.slug = `${veiculoData.slug}-${Date.now()}`;
      }

      const veiculo = await prisma.veiculo.create({
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
    } catch (error) {
      console.error('Create veiculo error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Atualizar veículo
   */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const veiculoData = req.body;

      const veiculo = await prisma.veiculo.findUnique({
        where: { id },
      });

      if (!veiculo) {
        return res.status(404).json({ error: 'Veículo não encontrado' });
      }

      // Converter campos numéricos
      const updateData: any = { ...veiculoData };
      const numericFields = ['preco_venda', 'preco_custo', 'preco_minimo', 'ano_fabricacao', 'ano_modelo', 'portas', 'lugares', 'quilometragem'];

      numericFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updateData[field] = Number(updateData[field]);
        }
      });

      const veiculoAtualizado = await prisma.veiculo.update({
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
    } catch (error) {
      console.error('Update veiculo error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Arquivar veículo
   */
  async archive(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const veiculo = await prisma.veiculo.findUnique({
        where: { id },
      });

      if (!veiculo) {
        return res.status(404).json({ error: 'Veículo não encontrado' });
      }

      await prisma.veiculo.update({
        where: { id },
        data: { status: 'MANUTENCAO' },
      });

      return res.json({
        success: true,
        message: 'Veículo arquivado com sucesso',
      });
    } catch (error) {
      console.error('Archive veiculo error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter marcas disponíveis
   */
  async getMarcas(req: Request, res: Response) {
    try {
      const marcas = await prisma.veiculo.groupBy({
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
    } catch (error) {
      console.error('Get marcas error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter faixas de preço
   */
  async getFaixaPrecos(req: Request, res: Response) {
    try {
      const result = await prisma.veiculo.aggregate({
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
    } catch (error) {
      console.error('Get faixa precos error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Obter veículos em destaque
   */
  async getDestaques(req: Request, res: Response) {
    try {
      const veiculos = await prisma.veiculo.findMany({
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
    } catch (error) {
      console.error('Get destaques error:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

export const veiculoController = new VeiculoController();