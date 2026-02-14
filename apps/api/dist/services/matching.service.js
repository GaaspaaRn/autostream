"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchingService = exports.MatchingService = void 0;
const prisma_1 = require("../lib/prisma");
class MatchingService {
    /**
     * Calcula o score de compatibilidade para cada vendedor disponível
     */
    async calcularScores(veiculoId) {
        // Buscar veículo
        const veiculo = await prisma_1.prisma.veiculo.findUnique({
            where: { id: veiculoId },
        });
        if (!veiculo) {
            throw new Error('Veículo não encontrado');
        }
        // Buscar vendedores ativos com capacidade disponível
        const vendedores = await prisma_1.prisma.user.findMany({
            where: {
                role: 'VENDEDOR',
                status: 'ATIVO',
            },
        });
        const scores = [];
        for (const vendedor of vendedores) {
            // Verificar carga atual do vendedor
            const leadsAtuais = await prisma_1.prisma.lead.count({
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
    async calcularScoreVendedor(vendedor, veiculo, leadsAtuais) {
        const regras = vendedor.regras_atribuicao || {};
        const motivos = [];
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
        const score = Math.round(categoriaMatch * 0.30 +
            valorMatch * 0.25 +
            nivelMatch * 0.20 +
            cargaMatch * 0.15 +
            desempenhoMatch * 0.10);
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
    calcularCategoriaMatch(vendedor, veiculo, motivos) {
        const especialidades = vendedor.especialidades || [];
        if (especialidades.includes(veiculo.categoria)) {
            motivos.push(`✅ Especialista em ${veiculo.categoria}`);
            return 100;
        }
        // Se não tem especialidade na categoria, mas também não tem restrição
        const regras = vendedor.regras_atribuicao || {};
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
    calcularValorMatch(vendedor, veiculo, regras, motivos) {
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
    calcularNivelMatch(vendedor, veiculo, motivos) {
        const preco = veiculo.preco_venda;
        const nivel = vendedor.nivel;
        // Veículos premium (> 100k) → Sênior ideal
        if (preco > 100000) {
            if (nivel === 'SENIOR') {
                motivos.push(`✅ Sênior para valores > R$ 100k`);
                return 100;
            }
            else {
                motivos.push(`⚠️ ${nivel} para valor alto`);
                return 20;
            }
        }
        // Veículos de entrada (< 50k) → Junior ideal
        if (preco <= 50000) {
            if (nivel === 'JUNIOR') {
                motivos.push(`✅ Junior para valores até R$ 50k`);
                return 100;
            }
            else {
                motivos.push(`⚠️ ${nivel} para valor de entrada`);
                return 50;
            }
        }
        // Faixa intermediária (50k-100k) → Pleno ideal
        if (preco > 50000 && preco <= 100000) {
            if (nivel === 'PLENO') {
                motivos.push(`✅ Pleno para faixa intermediária`);
                return 100;
            }
            else {
                motivos.push(`⚠️ ${nivel} para faixa intermediária`);
                return 50;
            }
        }
        return 50;
    }
    /**
     * Calcula match de carga de trabalho (15%)
     */
    calcularCargaMatch(vendedor, leadsAtuais, motivos) {
        const capacidade = vendedor.capacidade_max_leads;
        const ocupacao = leadsAtuais / capacidade;
        const score = Math.round((1 - ocupacao) * 100);
        if (ocupacao < 0.3) {
            motivos.push(`✅ Carga baixa (${leadsAtuais}/${capacidade})`);
        }
        else if (ocupacao < 0.7) {
            motivos.push(`⚠️ Carga média (${leadsAtuais}/${capacidade})`);
        }
        else {
            motivos.push(`⚠️ Carga alta (${leadsAtuais}/${capacidade})`);
        }
        return score;
    }
    /**
     * Calcula match de desempenho (10%)
     */
    async calcularDesempenhoMatch(vendedor, motivos) {
        // Buscar leads do mês atual
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        const leadsRecebidos = await prisma_1.prisma.lead.count({
            where: {
                vendedor_id: vendedor.id,
                created_at: {
                    gte: inicioMes,
                },
            },
        });
        const vendasRealizadas = await prisma_1.prisma.lead.count({
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
        }
        else if (taxaConversao >= 0.15) {
            motivos.push(`⚠️ Boa taxa de conversão (${(taxaConversao * 100).toFixed(0)}%)`);
        }
        else {
            motivos.push(`⚠️ Taxa de conversão em desenvolvimento`);
        }
        return score;
    }
    /**
     * Retorna os top 3 vendedores recomendados
     */
    async getTopRecomendacoes(veiculoId, limit = 3) {
        const scores = await this.calcularScores(veiculoId);
        return scores.slice(0, limit);
    }
    /**
     * Verifica se deve fazer atribuição automática
     */
    async deveAtribuirAutomaticamente(veiculoId) {
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
exports.MatchingService = MatchingService;
exports.matchingService = new MatchingService();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0Y2hpbmcuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2aWNlcy9tYXRjaGluZy5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDBDQUF1QztBQUd2QyxNQUFhLGVBQWU7SUFDMUI7O09BRUc7SUFDSCxLQUFLLENBQUMsY0FBYyxDQUFDLFNBQWlCO1FBQ3BDLGlCQUFpQjtRQUNqQixNQUFNLE9BQU8sR0FBRyxNQUFNLGVBQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO1lBQzlDLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUU7U0FDekIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFFRCxxREFBcUQ7UUFDckQsTUFBTSxVQUFVLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUM1QyxLQUFLLEVBQUU7Z0JBQ0wsSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLE1BQU0sRUFBRSxPQUFPO2FBQ2hCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLEdBQW9CLEVBQUUsQ0FBQztRQUVuQyxLQUFLLE1BQU0sUUFBUSxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2xDLG9DQUFvQztZQUNwQyxNQUFNLFdBQVcsR0FBRyxNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUMxQyxLQUFLLEVBQUU7b0JBQ0wsV0FBVyxFQUFFLFFBQVEsQ0FBQyxFQUFFO29CQUN4QixNQUFNLEVBQUU7d0JBQ04sS0FBSyxFQUFFLENBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUM7cUJBQzlDO2lCQUNGO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsc0NBQXNDO1lBQ3RDLElBQUksV0FBVyxJQUFJLFFBQVEsQ0FBQyxvQkFBb0Is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QUNmLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxTQUFpQixFQUFFLFFBQWdCLENBQUM7UUFDNUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3BELE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLDJCQUEyQixDQUFDLFNBQWlCO1FBQ2pELE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVwRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDeEIsT0FBTyxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUNqQyxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTNCLDBDQUEwQztRQUMxQyxJQUFJLFFBQVEsQ0FBQyxLQUFLLElBQUksRUFBRSxFQUFFLENBQUM7WUFDekIsT0FBTyxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDbEUsQ0FBQztRQUVELE9BQU8sRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBL1JELDBDQStSQztBQUVZLFFBQUEsZUFBZSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwcmlzbWEgfSBmcm9tICcuLi9saWIvcHJpc21hJztcbmltcG9ydCB7IFZlbmRlZG9yU2NvcmUgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBjbGFzcyBNYXRjaGluZ1NlcnZpY2Uge1xuICAvKipcbiAgICogQ2FsY3VsYSBvIHNjb3JlIGRlIGNvbXBhdGliaWxpZGFkZSBwYXJhIGNhZGEgdmVuZGVkb3IgZGlzcG9uw612ZWxcbiAgICovXG4gIGFzeW5jIGNhbGN1bGFyU2NvcmVzKHZlaWN1bG9JZDogc3RyaW5nKTogUHJvbWlzZTxWZW5kZWRvclNjb3JlW10+IHtcbiAgICAvLyBCdXNjYXIgdmXDrWN1bG9cbiAgICBjb25zdCB2ZWljdWxvID0gYXdhaXQgcHJpc21hLnZlaWN1bG8uZmluZFVuaXF1ZSh7XG4gICAgICB3aGVyZTogeyBpZDogdmVpY3Vsb0lkIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXZlaWN1bG8pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVmXDrWN1bG8gbsOjbyBlbmNvbnRyYWRvJyk7XG4gICAgfVxuXG4gICAgLy8gQnVzY2FyIHZlbmRlZG9yZXMgYXRpdm9zIGNvbSBjYXBhY2lkYWRlIGRpc3BvbsOtdmVsXG4gICAgY29uc3QgdmVuZGVkb3JlcyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHJvbGU6ICdWRU5ERURPUicsXG4gICAgICAgIHN0YXR1czogJ0FUSVZPJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBzY29yZXM6IFZlbmRlZG9yU2NvcmVbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCB2ZW5kZWRvciBvZiB2ZW5kZWRvcmVzKSB7XG4gICAgICAvLyBWZXJpZmljYXIgY2FyZ2EgYXR1YWwgZG8gdmVuZGVkb3JcbiAgICAgIGNvbnN0IGxlYWRzQXR1YWlzID0gYXdhaXQgcHJpc21hLmxlYWQuY291bnQoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIHZlbmRlZG9yX2lkOiB2ZW5kZWRvci5pZCxcbiAgICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICAgIG5vdEluOiBbJ0NPTlZFUlRJRE8nLCAnUEVSRElETycsICdBUlFVSVZBRE8nXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFNlIGF0aW5naXUgY2FwYWNpZGFkZSBtw6F4aW1hLCBwdWxhclxuICAgICAgaWYgKGxlYWRzQXR1YWlzID49IHZlbmRlZG9yLmNhcGFjaWRhZGVfbWF4X2xlYWRzKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzY29yZSA9IGF3YWl0IHRoaXMuY2FsY3VsYXJTY29yZVZlbmRlZG9yKHZlbmRlZG9yLCB2ZWljdWxvLCBsZWFkc0F0dWFpcyk7XG4gICAgICBzY29yZXMucHVzaChzY29yZSk7XG4gICAgfVxuXG4gICAgLy8gT3JkZW5hciBwb3Igc2NvcmUgZGVjcmVzY2VudGVcbiAgICByZXR1cm4gc2NvcmVzLnNvcnQoKGEsIGIpID0+IGIuc2NvcmUgLSBhLnNjb3JlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhIG8gc2NvcmUgaW5kaXZpZHVhbCBkZSB1bSB2ZW5kZWRvclxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjYWxjdWxhclNjb3JlVmVuZGVkb3IoXG4gICAgdmVuZGVkb3I6IGFueSxcbiAgICB2ZWljdWxvOiBhbnksXG4gICAgbGVhZHNBdHVhaXM6IG51bWJlclxuICApOiBQcm9taXNlPFZlbmRlZG9yU2NvcmU+IHtcbiAgICBjb25zdCByZWdyYXMgPSAodmVuZGVkb3IucmVncmFzX2F0cmlidWljYW8gYXMgYW55KSB8fCB7fTtcbiAgICBjb25zdCBtb3Rpdm9zOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gMS4gQ0FURUdPUklBX01BVENIICgzMCUpXG4gICAgY29uc3QgY2F0ZWdvcmlhTWF0Y2ggPSB0aGlzLmNhbGN1bGFyQ2F0ZWdvcmlhTWF0Y2godmVuZGVkb3IsIHZlaWN1bG8sIG1vdGl2b3MpO1xuXG4gICAgLy8gMi4gVkFMT1JfTUFUQ0ggKDI1JSlcbiAgICBjb25zdCB2YWxvck1hdGNoID0gdGhpcy5jYWxjdWxhclZhbG9yTWF0Y2godmVuZGVkb3IsIHZlaWN1bG8sIHJlZ3JhcywgbW90aXZvcyk7XG5cbiAgICAvLyAzLiBOSVZFTF9NQVRDSCAoMjAlKVxuICAgIGNvbnN0IG5pdmVsTWF0Y2ggPSB0aGlzLmNhbGN1bGFyTml2ZWxNYXRjaCh2ZW5kZWRvciwgdmVpY3VsbywgbW90aXZvcyk7XG5cbiAgICAvLyA0LiBDQVJHQV9NQVRDSCAoMTUlKVxuICAgIGNvbnN0IGNhcmdhTWF0Y2ggPSB0aGlzLmNhbGN1bGFyQ2FyZ2FNYXRjaCh2ZW5kZWRvciwgbGVhZHNBdHVhaXMsIG1vdGl2b3MpO1xuXG4gICAgLy8gNS4gREVTRU1QRU5IT19NQVRDSCAoMTAlKVxuICAgIGNvbnN0IGRlc2VtcGVuaG9NYXRjaCA9IGF3YWl0IHRoaXMuY2FsY3VsYXJEZXNlbXBlbmhvTWF0Y2godmVuZGVkb3IsIG1vdGl2b3MpO1xuXG4gICAgLy8gQ2FsY3VsYXIgc2NvcmUgdG90YWwgKHBvbmRlcmFkbylcbiAgICBjb25zdCBzY29yZSA9IE1hdGgucm91bmQoXG4gICAgICBjYXRlZ29yaWFNYXRjaCAqIDAuMzAgK1xuICAgICAgdmFsb3JNYXRjaCAqIDAuMjUgK1xuICAgICAgbml2ZWxNYXRjaCAqIDAuMjAgK1xuICAgICAgY2FyZ2FNYXRjaCAqIDAuMTUgK1xuICAgICAgZGVzZW1wZW5ob01hdGNoICogMC4xMFxuICAgICk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdmVuZGVkb3IsXG4gICAgICBzY29yZSxcbiAgICAgIGRldGFsaGVzOiB7XG4gICAgICAgIGNhdGVnb3JpYU1hdGNoLFxuICAgICAgICB2YWxvck1hdGNoLFxuICAgICAgICBuaXZlbE1hdGNoLFxuICAgICAgICBjYXJnYU1hdGNoLFxuICAgICAgICBkZXNlbXBlbmhvTWF0Y2gsXG4gICAgICB9LFxuICAgICAgbW90aXZvcyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGN1bGEgbWF0Y2ggZGUgY2F0ZWdvcmlhICgzMCUpXG4gICAqL1xuICBwcml2YXRlIGNhbGN1bGFyQ2F0ZWdvcmlhTWF0Y2godmVuZGVkb3I6IGFueSwgdmVpY3VsbzogYW55LCBtb3Rpdm9zOiBzdHJpbmdbXSk6IG51bWJlciB7XG4gICAgY29uc3QgZXNwZWNpYWxpZGFkZXMgPSB2ZW5kZWRvci5lc3BlY2lhbGlkYWRlcyB8fCBbXTtcblxuICAgIGlmIChlc3BlY2lhbGlkYWRlcy5pbmNsdWRlcyh2ZWljdWxvLmNhdGVnb3JpYSkpIHtcbiAgICAgIG1vdGl2b3MucHVzaChg4pyFIEVzcGVjaWFsaXN0YSBlbSAke3ZlaWN1bG8uY2F0ZWdvcmlhfWApO1xuICAgICAgcmV0dXJuIDEwMDtcbiAgICB9XG5cbiAgICAvLyBTZSBuw6NvIHRlbSBlc3BlY2lhbGlkYWRlIG5hIGNhdGVnb3JpYSwgbWFzIHRhbWLDqW0gbsOjbyB0ZW0gcmVzdHJpw6fDo29cbiAgICBjb25zdCByZWdyYXMgPSAodmVuZGVkb3IucmVncmFzX2F0cmlidWljYW8gYXMgYW55KSB8fCB7fTtcbiAgICBjb25zdCBjYXRlZ29yaWFzUGVybWl0aWRhcyA9IHJlZ3Jhcy5jYXRlZ29yaWFzX3Blcm1pdGlkYXMgfHwgW107XG5cbiAgICBpZiAoY2F0ZWdvcmlhc1Blcm1pdGlkYXMubGVuZ3RoID09PSAwIHx8IGNhdGVnb3JpYXNQZXJtaXRpZGFzLmluY2x1ZGVzKHZlaWN1bG8uY2F0ZWdvcmlhKSkge1xuICAgICAgbW90aXZvcy5wdXNoKGDimqDvuI8gTsOjbyDDqSBlc3BlY2lhbGlzdGEgZW0gJHt2ZWljdWxvLmNhdGVnb3JpYX0sIG1hcyBwb2RlIGF0ZW5kZXJgKTtcbiAgICAgIHJldHVybiA1MDtcbiAgICB9XG5cbiAgICBtb3Rpdm9zLnB1c2goYOKdjCBDYXRlZ29yaWEgJHt2ZWljdWxvLmNhdGVnb3JpYX0gbsOjbyBwZXJtaXRpZGFgKTtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhIG1hdGNoIGRlIHZhbG9yICgyNSUpXG4gICAqL1xuICBwcml2YXRlIGNhbGN1bGFyVmFsb3JNYXRjaCh2ZW5kZWRvcjogYW55LCB2ZWljdWxvOiBhbnksIHJlZ3JhczogYW55LCBtb3Rpdm9zOiBzdHJpbmdbXSk6IG51bWJlciB7XG4gICAgY29uc3QgdmFsb3JNaW5pbW8gPSByZWdyYXMudmFsb3JfbWluaW1vO1xuICAgIGNvbnN0IHZhbG9yTWF4aW1vID0gcmVncmFzLnZhbG9yX21heGltbztcbiAgICBjb25zdCBwcmVjbyA9IHZlaWN1bG8ucHJlY29fdmVuZGE7XG5cbiAgICAvLyBTZSB0ZW0gdmFsb3IgbcOtbmltbyBkZWZpbmlkbyBlIG8gdmXDrWN1bG8gZXN0w6EgYWJhaXhvXG4gICAgaWYgKHZhbG9yTWluaW1vICYmIHByZWNvIDwgdmFsb3JNaW5pbW8pIHtcbiAgICAgIG1vdGl2b3MucHVzaChg4p2MIFZhbG9yIGFiYWl4byBkbyBtw61uaW1vIChSJCAke3ZhbG9yTWluaW1vLnRvTG9jYWxlU3RyaW5nKCdwdC1CUicpfSlgKTtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIC8vIFNlIHRlbSB2YWxvciBtw6F4aW1vIGRlZmluaWRvIGUgbyB2ZcOtY3VsbyBlc3TDoSBhY2ltYVxuICAgIGlmICh2YWxvck1heGltbyAmJiBwcmVjbyA+IHZhbG9yTWF4aW1vKSB7XG4gICAgICBtb3Rpdm9zLnB1c2goYOKdjCBWYWxvciBhY2ltYSBkbyBtw6F4aW1vIChSJCAke3ZhbG9yTWF4aW1vLnRvTG9jYWxlU3RyaW5nKCdwdC1CUicpfSlgKTtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIC8vIFZhbG9yIGRlbnRybyBkYSBmYWl4YSBpZGVhbFxuICAgIGlmICh2YWxvck1pbmltbyAmJiBwcmVjbyA+PSB2YWxvck1pbmltbykge1xuICAgICAgbW90aXZvcy5wdXNoKGDinIUgVmFsb3IgaWRlYWwgcGFyYSAke3ZlbmRlZG9yLm5pdmVsfWApO1xuICAgICAgcmV0dXJuIDEwMDtcbiAgICB9XG5cbiAgICBpZiAodmFsb3JNYXhpbW8gJiYgcHJlY28gPD0gdmFsb3JNYXhpbW8pIHtcbiAgICAgIG1vdGl2b3MucHVzaChg4pyFIFZhbG9yIGRlbnRybyBkYSBmYWl4YWApO1xuICAgICAgcmV0dXJuIDEwMDtcbiAgICB9XG5cbiAgICBtb3Rpdm9zLnB1c2goYOKchSBTZW0gcmVzdHJpw6fDtWVzIGRlIHZhbG9yYCk7XG4gICAgcmV0dXJuIDEwMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhIG1hdGNoIGRlIG7DrXZlbCAoMjAlKVxuICAgKi9cbiAgcHJpdmF0ZSBjYWxjdWxhck5pdmVsTWF0Y2godmVuZGVkb3I6IGFueSwgdmVpY3VsbzogYW55LCBtb3Rpdm9zOiBzdHJpbmdbXSk6IG51bWJlciB7XG4gICAgY29uc3QgcHJlY28gPSB2ZWljdWxvLnByZWNvX3ZlbmRhO1xuICAgIGNvbnN0IG5pdmVsID0gdmVuZGVkb3Iubml2ZWw7XG5cbiAgICAvLyBWZcOtY3Vsb3MgcHJlbWl1bSAoPiAxMDBrKSDihpIgU8OqbmlvciBpZGVhbFxuICAgIGlmIChwcmVjbyA+IDEwMDAwMCkge1xuICAgICAgaWYgKG5pdmVsID09PSAnU0VOSU9SJykge1xuICAgICAgICBtb3Rpdm9zLnB1c2goYOKchSBTw6puaW9yIHBhcmEgdmFsb3JlcyA+IFIkIDEwMGtgKTtcbiAgICAgICAgcmV0dXJuIDEwMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1vdGl2b3MucHVzaChg4pqg77iPICR7bml2ZWx9IHBhcmEgdmFsb3IgYWx0b2ApO1xuICAgICAgICByZXR1cm4gMjA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVmXDrWN1bG9zIGRlIGVudHJhZGEgKDwgNTBrKSDihpIgSnVuaW9yIGlkZWFsXG4gICAgaWYgKHByZWNvIDw9IDUwMDAwKSB7XG4gICAgICBpZiAobml2ZWwgPT09ICdKVU5JT1InKSB7XG4gICAgICAgIG1vdGl2b3MucHVzaChg4pyFIEp1bmlvciBwYXJhIHZhbG9yZXMgYXTDqSBSJCA1MGtgKTtcbiAgICAgICAgcmV0dXJuIDEwMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1vdGl2b3MucHVzaChg4pqg77iPICR7bml2ZWx9IHBhcmEgdmFsb3IgZGUgZW50cmFkYWApO1xuICAgICAgICByZXR1cm4gNTA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmFpeGEgaW50ZXJtZWRpw6FyaWEgKDUway0xMDBrKSDihpIgUGxlbm8gaWRlYWxcbiAgICBpZiAocHJlY28gPiA1MDAwMCAmJiBwcmVjbyA8PSAxMDAwMDApIHtcbiAgICAgIGlmIChuaXZlbCA9PT0gJ1BMRU5PJykge1xuICAgICAgICBtb3Rpdm9zLnB1c2goYOKchSBQbGVubyBwYXJhIGZhaXhhIGludGVybWVkacOhcmlhYCk7XG4gICAgICAgIHJldHVybiAxMDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtb3Rpdm9zLnB1c2goYOKaoO+4jyAke25pdmVsfSBwYXJhIGZhaXhhIGludGVybWVkacOhcmlhYCk7XG4gICAgICAgIHJldHVybiA1MDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gNTA7XG4gIH1cblxuICAvKipcbiAgICogQ2FsY3VsYSBtYXRjaCBkZSBjYXJnYSBkZSB0cmFiYWxobyAoMTUlKVxuICAgKi9cbiAgcHJpdmF0ZSBjYWxjdWxhckNhcmdhTWF0Y2godmVuZGVkb3I6IGFueSwgbGVhZHNBdHVhaXM6IG51bWJlciwgbW90aXZvczogc3RyaW5nW10pOiBudW1iZXIge1xuICAgIGNvbnN0IGNhcGFjaWRhZGUgPSB2ZW5kZWRvci5jYXBhY2lkYWRlX21heF9sZWFkcztcbiAgICBjb25zdCBvY3VwYWNhbyA9IGxlYWRzQXR1YWlzIC8gY2FwYWNpZGFkZTtcbiAgICBjb25zdCBzY29yZSA9IE1hdGgucm91bmQoKDEgLSBvY3VwYWNhbykgKiAxMDApO1xuXG4gICAgaWYgKG9jdXBhY2FvIDwgMC4zKSB7XG4gICAgICBtb3Rpdm9zLnB1c2goYOKchSBDYXJnYSBiYWl4YSAoJHtsZWFkc0F0dWFpc30vJHtjYXBhY2lkYWRlfSlgKTtcbiAgICB9IGVsc2UgaWYgKG9jdXBhY2FvIDwgMC43KSB7XG4gICAgICBtb3Rpdm9zLnB1c2goYOKaoO+4jyBDYXJnYSBtw6lkaWEgKCR7bGVhZHNBdHVhaXN9LyR7Y2FwYWNpZGFkZX0pYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1vdGl2b3MucHVzaChg4pqg77iPIENhcmdhIGFsdGEgKCR7bGVhZHNBdHVhaXN9LyR7Y2FwYWNpZGFkZX0pYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjb3JlO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGN1bGEgbWF0Y2ggZGUgZGVzZW1wZW5obyAoMTAlKVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjYWxjdWxhckRlc2VtcGVuaG9NYXRjaCh2ZW5kZWRvcjogYW55LCBtb3Rpdm9zOiBzdHJpbmdbXSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgLy8gQnVzY2FyIGxlYWRzIGRvIG3DqnMgYXR1YWxcbiAgICBjb25zdCBpbmljaW9NZXMgPSBuZXcgRGF0ZSgpO1xuICAgIGluaWNpb01lcy5zZXREYXRlKDEpO1xuICAgIGluaWNpb01lcy5zZXRIb3VycygwLCAwLCAwLCAwKTtcblxuICAgIGNvbnN0IGxlYWRzUmVjZWJpZG9zID0gYXdhaXQgcHJpc21hLmxlYWQuY291bnQoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdmVuZGVkb3JfaWQ6IHZlbmRlZG9yLmlkLFxuICAgICAgICBjcmVhdGVkX2F0OiB7XG4gICAgICAgICAgZ3RlOiBpbmljaW9NZXMsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgdmVuZGFzUmVhbGl6YWRhcyA9IGF3YWl0IHByaXNtYS5sZWFkLmNvdW50KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHZlbmRlZG9yX2lkOiB2ZW5kZWRvci5pZCxcbiAgICAgICAgc3RhdHVzOiAnQ09OVkVSVElETycsXG4gICAgICAgIHVwZGF0ZWRfYXQ6IHtcbiAgICAgICAgICBndGU6IGluaWNpb01lcyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB0YXhhQ29udmVyc2FvID0gbGVhZHNSZWNlYmlkb3MgPiAwID8gKHZlbmRhc1JlYWxpemFkYXMgLyBsZWFkc1JlY2ViaWRvcykgOiAwO1xuICAgIGNvbnN0IHNjb3JlID0gTWF0aC5yb3VuZCh0YXhhQ29udmVyc2FvICogMTAwKTtcblxuICAgIGlmICh0YXhhQ29udmVyc2FvID49IDAuMykge1xuICAgICAgbW90aXZvcy5wdXNoKGDinIUgRXhjZWxlbnRlIHRheGEgZGUgY29udmVyc8OjbyAoJHsodGF4YUNvbnZlcnNhbyAqIDEwMCkudG9GaXhlZCgwKX0lKWApO1xuICAgIH0gZWxzZSBpZiAodGF4YUNvbnZlcnNhbyA+PSAwLjE1KSB7XG4gICAgICBtb3Rpdm9zLnB1c2goYOKaoO+4jyBCb2EgdGF4YSBkZSBjb252ZXJzw6NvICgkeyh0YXhhQ29udmVyc2FvICogMTAwKS50b0ZpeGVkKDApfSUpYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1vdGl2b3MucHVzaChg4pqg77iPIFRheGEgZGUgY29udmVyc8OjbyBlbSBkZXNlbnZvbHZpbWVudG9gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2NvcmU7XG4gIH1cblxuICAvKipcbiAgICogUmV0b3JuYSBvcyB0b3AgMyB2ZW5kZWRvcmVzIHJlY29tZW5kYWRvc1xuICAgKi9cbiAgYXN5bmMgZ2V0VG9wUmVjb21lbmRhY29lcyh2ZWljdWxvSWQ6IHN0cmluZywgbGltaXQ6IG51bWJlciA9IDMpOiBQcm9taXNlPFZlbmRlZG9yU2NvcmVbXT4ge1xuICAgIGNvbnN0IHNjb3JlcyA9IGF3YWl0IHRoaXMuY2FsY3VsYXJTY29yZXModmVpY3Vsb0lkKTtcbiAgICByZXR1cm4gc2NvcmVzLnNsaWNlKDAsIGxpbWl0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWZXJpZmljYSBzZSBkZXZlIGZhemVyIGF0cmlidWnDp8OjbyBhdXRvbcOhdGljYVxuICAgKi9cbiAgYXN5bmMgZGV2ZUF0cmlidWlyQXV0b21hdGljYW1lbnRlKHZlaWN1bG9JZDogc3RyaW5nKTogUHJvbWlzZTx7IGRldmVBdHJpYnVpcjogYm9vbGVhbjsgdmVuZGVkb3JJZD86IHN0cmluZyB9PiB7XG4gICAgY29uc3Qgc2NvcmVzID0gYXdhaXQgdGhpcy5jYWxjdWxhclNjb3Jlcyh2ZWljdWxvSWQpO1xuXG4gICAgaWYgKHNjb3Jlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB7IGRldmVBdHJpYnVpcjogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBjb25zdCB0b3BTY29yZSA9IHNjb3Jlc1swXTtcblxuICAgIC8vIEF0cmlidWlyIGF1dG9tYXRpY2FtZW50ZSBzZSBzY29yZSA+IDgwJVxuICAgIGlmICh0b3BTY29yZS5zY29yZSA+PSA4MCkge1xuICAgICAgcmV0dXJuIHsgZGV2ZUF0cmlidWlyOiB0cnVlLCB2ZW5kZWRvcklkOiB0b3BTY29yZS52ZW5kZWRvci5pZCB9O1xuICAgIH1cblxuICAgIHJldHVybiB7IGRldmVBdHJpYnVpcjogZmFsc2UgfTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgbWF0Y2hpbmdTZXJ2aWNlID0gbmV3IE1hdGNoaW5nU2VydmljZSgpOyJdfQ==