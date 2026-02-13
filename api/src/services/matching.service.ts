import { prisma } from '../lib/prisma';
import { VendedorScore } from '../types';

export class MatchingService {
  /**
   * Calcula o score de compatibilidade para cada vendedor disponível
   */
  async calcularScores(veiculoId: string): Promise<VendedorScore[]> {
    // Buscar veículo
    const veiculo = await prisma.veiculo.findUnique({
      where: { id: veiculoId },
    });

    if (!veiculo) {
      throw new Error('Veículo não encontrado');
    }

    // Buscar vendedores ativos com capacidade disponível
    const vendedores = await prisma.user.findMany({
      where: {
        role: 'VENDEDOR',
        status: 'ATIVO',
      },
    });

    const scores: VendedorScore[] = [];

    for (const vendedor of vendedores) {
      // Verificar carga atual do vendedor
      const leadsAtuais = await prisma.lead.count({
        where: {
          vendedor_id: vendedor.id,
          status: {
            notIn: ['CONVERTIDO', 'PERDIDO', 'ARQUIVADO'],
          },
        },
      });

      // Se atingiu capacidade máxima, pular
      if (leadsAtuais >= vendedor.capacidade_max_leads) {
        continue;
      }

      const score = await this.calcularScoreVendedor(vendedor, veiculo, leadsAtuais);
      scores.push(score);
    }

    // Ordenar por score decrescente
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Calcula o score individual de um vendedor
   */
  private async calcularScoreVendedor(
    vendedor: any,
    veiculo: any,
    leadsAtuais: number
  ): Promise<VendedorScore> {
    const regras = (vendedor.regras_atribuicao as any) || {};
    const motivos: string[] = [];

    // 1. CATEGORIA_MATCH (30%)
    const categoriaMatch = this.calcularCategoriaMatch(vendedor, veiculo, motivos);

    // 2. VALOR_MATCH (25%)
    const valorMatch = this.calcularValorMatch(vendedor, veiculo, regras, motivos);

    // 3. NIVEL_MATCH (20%)
    const nivelMatch = this.calcularNivelMatch(vendedor, veiculo, motivos);

    // 4. CARGA_MATCH (15%)
    const cargaMatch = this.calcularCargaMatch(vendedor, leadsAtuais, motivos);

    // 5. DESEMPENHO_MATCH (10%)
    const desempenhoMatch = await this.calcularDesempenhoMatch(vendedor, motivos);

    // Calcular score total (ponderado)
    const score = Math.round(
      categoriaMatch * 0.30 +
      valorMatch * 0.25 +
      nivelMatch * 0.20 +
      cargaMatch * 0.15 +
      desempenhoMatch * 0.10
    );

    return {
      vendedor,
      score,
      detalhes: {
        categoriaMatch,
        valorMatch,
        nivelMatch,
        cargaMatch,
        desempenhoMatch,
      },
      motivos,
    };
  }

  /**
   * Calcula match de categoria (30%)
   */
  private calcularCategoriaMatch(vendedor: any, veiculo: any, motivos: string[]): number {
    const especialidades = vendedor.especialidades || [];

    if (especialidades.includes(veiculo.categoria)) {
      motivos.push(`✅ Especialista em ${veiculo.categoria}`);
      return 100;
    }

    // Se não tem especialidade na categoria, mas também não tem restrição
    const regras = (vendedor.regras_atribuicao as any) || {};
    const categoriasPermitidas = regras.categorias_permitidas || [];

    if (categoriasPermitidas.length === 0 || categoriasPermitidas.includes(veiculo.categoria)) {
      motivos.push(`⚠️ Não é especialista em ${veiculo.categoria}, mas pode atender`);
      return 50;
    }

    motivos.push(`❌ Categoria ${veiculo.categoria} não permitida`);
    return 0;
  }

  /**
   * Calcula match de valor (25%)
   */
  private calcularValorMatch(vendedor: any, veiculo: any, regras: any, motivos: string[]): number {
    const valorMinimo = regras.valor_minimo;
    const valorMaximo = regras.valor_maximo;
    const preco = veiculo.preco_venda;

    // Se tem valor mínimo definido e o veículo está abaixo
    if (valorMinimo && preco < valorMinimo) {
      motivos.push(`❌ Valor abaixo do mínimo (R$ ${valorMinimo.toLocaleString('pt-BR')})`);
      return 0;
    }

    // Se tem valor máximo definido e o veículo está acima
    if (valorMaximo && preco > valorMaximo) {
      motivos.push(`❌ Valor acima do máximo (R$ ${valorMaximo.toLocaleString('pt-BR')})`);
      return 0;
    }

    // Valor dentro da faixa ideal
    if (valorMinimo && preco >= valorMinimo) {
      motivos.push(`✅ Valor ideal para ${vendedor.nivel}`);
      return 100;
    }

    if (valorMaximo && preco <= valorMaximo) {
      motivos.push(`✅ Valor dentro da faixa`);
      return 100;
    }

    motivos.push(`✅ Sem restrições de valor`);
    return 100;
  }

  /**
   * Calcula match de nível (20%)
   */
  private calcularNivelMatch(vendedor: any, veiculo: any, motivos: string[]): number {
    const preco = veiculo.preco_venda;
    const nivel = vendedor.nivel;

    // Veículos premium (> 100k) → Sênior ideal
    if (preco > 100000) {
      if (nivel === 'SENIOR') {
        motivos.push(`✅ Sênior para valores > R$ 100k`);
        return 100;
      } else {
        motivos.push(`⚠️ ${nivel} para valor alto`);
        return 20;
      }
    }

    // Veículos de entrada (< 50k) → Junior ideal
    if (preco <= 50000) {
      if (nivel === 'JUNIOR') {
        motivos.push(`✅ Junior para valores até R$ 50k`);
        return 100;
      } else {
        motivos.push(`⚠️ ${nivel} para valor de entrada`);
        return 50;
      }
    }

    // Faixa intermediária (50k-100k) → Pleno ideal
    if (preco > 50000 && preco <= 100000) {
      if (nivel === 'PLENO') {
        motivos.push(`✅ Pleno para faixa intermediária`);
        return 100;
      } else {
        motivos.push(`⚠️ ${nivel} para faixa intermediária`);
        return 50;
      }
    }

    return 50;
  }

  /**
   * Calcula match de carga de trabalho (15%)
   */
  private calcularCargaMatch(vendedor: any, leadsAtuais: number, motivos: string[]): number {
    const capacidade = vendedor.capacidade_max_leads;
    const ocupacao = leadsAtuais / capacidade;
    const score = Math.round((1 - ocupacao) * 100);

    if (ocupacao < 0.3) {
      motivos.push(`✅ Carga baixa (${leadsAtuais}/${capacidade})`);
    } else if (ocupacao < 0.7) {
      motivos.push(`⚠️ Carga média (${leadsAtuais}/${capacidade})`);
    } else {
      motivos.push(`⚠️ Carga alta (${leadsAtuais}/${capacidade})`);
    }

    return score;
  }

  /**
   * Calcula match de desempenho (10%)
   */
  private async calcularDesempenhoMatch(vendedor: any, motivos: string[]): Promise<number> {
    // Buscar leads do mês atual
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const leadsRecebidos = await prisma.lead.count({
      where: {
        vendedor_id: vendedor.id,
        created_at: {
          gte: inicioMes,
        },
      },
    });

    const vendasRealizadas = await prisma.lead.count({
      where: {
        vendedor_id: vendedor.id,
        status: 'CONVERTIDO',
        updated_at: {
          gte: inicioMes,
        },
      },
    });

    const taxaConversao = leadsRecebidos > 0 ? (vendasRealizadas / leadsRecebidos) : 0;
    const score = Math.round(taxaConversao * 100);

    if (taxaConversao >= 0.3) {
      motivos.push(`✅ Excelente taxa de conversão (${(taxaConversao * 100).toFixed(0)}%)`);
    } else if (taxaConversao >= 0.15) {
      motivos.push(`⚠️ Boa taxa de conversão (${(taxaConversao * 100).toFixed(0)}%)`);
    } else {
      motivos.push(`⚠️ Taxa de conversão em desenvolvimento`);
    }

    return score;
  }

  /**
   * Retorna os top 3 vendedores recomendados
   */
  async getTopRecomendacoes(veiculoId: string, limit: number = 3): Promise<VendedorScore[]> {
    const scores = await this.calcularScores(veiculoId);
    return scores.slice(0, limit);
  }

  /**
   * Verifica se deve fazer atribuição automática
   */
  async deveAtribuirAutomaticamente(veiculoId: string): Promise<{ deveAtribuir: boolean; vendedorId?: string }> {
    const scores = await this.calcularScores(veiculoId);

    if (scores.length === 0) {
      return { deveAtribuir: false };
    }

    const topScore = scores[0];

    // Atribuir automaticamente se score > 80%
    if (topScore.score >= 80) {
      return { deveAtribuir: true, vendedorId: topScore.vendedor.id };
    }

    return { deveAtribuir: false };
  }
}

export const matchingService = new MatchingService();