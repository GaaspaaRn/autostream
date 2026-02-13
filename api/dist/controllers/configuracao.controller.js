"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuracaoController = exports.ConfiguracaoController = void 0;
const prisma_1 = require("../lib/prisma");
class ConfiguracaoController {
    /**
     * Listar todas as configurações
     */
    async list(req, res) {
        try {
            const configuracoes = await prisma_1.prisma.configuracao.findMany({
                orderBy: { chave: 'asc' },
            });
            return res.json({
                success: true,
                data: configuracoes,
            });
        }
        catch (error) {
            console.error('List configuracoes error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter configuração por chave
     */
    async getByChave(req, res) {
        try {
            const { chave } = req.params;
            const configuracao = await prisma_1.prisma.configuracao.findUnique({
                where: { chave },
            });
            if (!configuracao) {
                return res.status(404).json({ error: 'Configuração não encontrada' });
            }
            return res.json({
                success: true,
                data: configuracao,
            });
        }
        catch (error) {
            console.error('Get configuracao error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Criar ou atualizar configuração
     */
    async upsert(req, res) {
        try {
            const { chave, valor, descricao } = req.body;
            if (!chave || valor === undefined) {
                return res.status(400).json({ error: 'Chave e valor são obrigatórios' });
            }
            const configuracao = await prisma_1.prisma.configuracao.upsert({
                where: { chave },
                update: {
                    valor: String(valor),
                    descricao,
                },
                create: {
                    chave,
                    valor: String(valor),
                    descricao,
                },
            });
            return res.json({
                success: true,
                data: configuracao,
            });
        }
        catch (error) {
            console.error('Upsert configuracao error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Atualizar múltiplas configurações
     */
    async bulkUpdate(req, res) {
        try {
            const { configuracoes } = req.body;
            if (!Array.isArray(configuracoes)) {
                return res.status(400).json({ error: 'Configurações devem ser um array' });
            }
            const resultados = await Promise.all(configuracoes.map(async (config) => {
                return prisma_1.prisma.configuracao.upsert({
                    where: { chave: config.chave },
                    update: {
                        valor: String(config.valor),
                        descricao: config.descricao,
                    },
                    create: {
                        chave: config.chave,
                        valor: String(config.valor),
                        descricao: config.descricao,
                    },
                });
            }));
            return res.json({
                success: true,
                data: resultados,
            });
        }
        catch (error) {
            console.error('Bulk update configuracoes error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Deletar configuração
     */
    async delete(req, res) {
        try {
            const { chave } = req.params;
            await prisma_1.prisma.configuracao.delete({
                where: { chave },
            });
            return res.json({
                success: true,
                message: 'Configuração removida com sucesso',
            });
        }
        catch (error) {
            console.error('Delete configuracao error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    /**
     * Obter configurações públicas (para o site)
     */
    async getPublic(req, res) {
        try {
            const configuracoes = await prisma_1.prisma.configuracao.findMany({
                where: {
                    chave: {
                        in: [
                            'nome_revenda',
                            'telefone_revenda',
                            'whatsapp_revenda',
                            'email_revenda',
                            'endereco_revenda',
                        ],
                    },
                },
            });
            const configMap = configuracoes.reduce((acc, config) => {
                acc[config.chave] = config.valor;
                return acc;
            }, {});
            return res.json({
                success: true,
                data: configMap,
            });
        }
        catch (error) {
            console.error('Get public configuracoes error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}
exports.ConfiguracaoController = ConfiguracaoController;
exports.configuracaoController = new ConfiguracaoController();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhY2FvLmNvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJvbGxlcnMvY29uZmlndXJhY2FvLmNvbnRyb2xsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsMENBQXVDO0FBR3ZDLE1BQWEsc0JBQXNCO0lBQ2pDOztPQUVHO0lBQ0gsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUF5QixFQUFFLEdBQWE7UUFDakQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxhQUFhLEdBQUcsTUFBTSxlQUFNLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztnQkFDdkQsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTthQUMxQixDQUFDLENBQUM7WUFFSCxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7Z0JBQ2QsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsSUFBSSxFQUFFLGFBQWE7YUFDcEIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLDJCQUEyQixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2xELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQVksRUFBRSxHQUFhO1FBQzFDLElBQUksQ0FBQztZQUNILE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO1lBRTdCLE1BQU0sWUFBWSxHQUFHLE1BQU0sZUFBTSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUM7Z0JBQ3hELEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRTthQUNqQixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsWUFBWSxFQUFF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cXVlc3QsIFJlc3BvbnNlIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tICcuLi9saWIvcHJpc21hJztcbmltcG9ydCB7IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgQ29uZmlndXJhY2FvQ29udHJvbGxlciB7XG4gIC8qKlxuICAgKiBMaXN0YXIgdG9kYXMgYXMgY29uZmlndXJhw6fDtWVzXG4gICAqL1xuICBhc3luYyBsaXN0KHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29uZmlndXJhY29lcyA9IGF3YWl0IHByaXNtYS5jb25maWd1cmFjYW8uZmluZE1hbnkoe1xuICAgICAgICBvcmRlckJ5OiB7IGNoYXZlOiAnYXNjJyB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IGNvbmZpZ3VyYWNvZXMsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignTGlzdCBjb25maWd1cmFjb2VzIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT2J0ZXIgY29uZmlndXJhw6fDo28gcG9yIGNoYXZlXG4gICAqL1xuICBhc3luYyBnZXRCeUNoYXZlKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGNoYXZlIH0gPSByZXEucGFyYW1zO1xuXG4gICAgICBjb25zdCBjb25maWd1cmFjYW8gPSBhd2FpdCBwcmlzbWEuY29uZmlndXJhY2FvLmZpbmRVbmlxdWUoe1xuICAgICAgICB3aGVyZTogeyBjaGF2ZSB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghY29uZmlndXJhY2FvKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnQ29uZmlndXJhw6fDo28gbsOjbyBlbmNvbnRyYWRhJyB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogY29uZmlndXJhY2FvLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0dldCBjb25maWd1cmFjYW8gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmlhciBvdSBhdHVhbGl6YXIgY29uZmlndXJhw6fDo29cbiAgICovXG4gIGFzeW5jIHVwc2VydChyZXE6IEF1dGhlbnRpY2F0ZWRSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgY2hhdmUsIHZhbG9yLCBkZXNjcmljYW8gfSA9IHJlcS5ib2R5O1xuXG4gICAgICBpZiAoIWNoYXZlIHx8IHZhbG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdDaGF2ZSBlIHZhbG9yIHPDo28gb2JyaWdhdMOzcmlvcycgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZ3VyYWNhbyA9IGF3YWl0IHByaXNtYS5jb25maWd1cmFjYW8udXBzZXJ0KHtcbiAgICAgICAgd2hlcmU6IHsgY2hhdmUgfSxcbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgdmFsb3I6IFN0cmluZyh2YWxvciksXG4gICAgICAgICAgZGVzY3JpY2FvLFxuICAgICAgICB9LFxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBjaGF2ZSxcbiAgICAgICAgICB2YWxvcjogU3RyaW5nKHZhbG9yKSxcbiAgICAgICAgICBkZXNjcmljYW8sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogY29uZmlndXJhY2FvLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vwc2VydCBjb25maWd1cmFjYW8gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBdHVhbGl6YXIgbcO6bHRpcGxhcyBjb25maWd1cmHDp8O1ZXNcbiAgICovXG4gIGFzeW5jIGJ1bGtVcGRhdGUocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGNvbmZpZ3VyYWNvZXMgfSA9IHJlcS5ib2R5O1xuXG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkoY29uZmlndXJhY29lcykpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdDb25maWd1cmHDp8O1ZXMgZGV2ZW0gc2VyIHVtIGFycmF5JyB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0YWRvcyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICBjb25maWd1cmFjb2VzLm1hcChhc3luYyAoY29uZmlnKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHByaXNtYS5jb25maWd1cmFjYW8udXBzZXJ0KHtcbiAgICAgICAgICAgIHdoZXJlOiB7IGNoYXZlOiBjb25maWcuY2hhdmUgfSxcbiAgICAgICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgICAgICB2YWxvcjogU3RyaW5nKGNvbmZpZy52YWxvciksXG4gICAgICAgICAgICAgIGRlc2NyaWNhbzogY29uZmlnLmRlc2NyaWNhbyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICAgICAgY2hhdmU6IGNvbmZpZy5jaGF2ZSxcbiAgICAgICAgICAgICAgdmFsb3I6IFN0cmluZyhjb25maWcudmFsb3IpLFxuICAgICAgICAgICAgICBkZXNjcmljYW86IGNvbmZpZy5kZXNjcmljYW8sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YTogcmVzdWx0YWRvcyxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdCdWxrIHVwZGF0ZSBjb25maWd1cmFjb2VzIGVycm9yOicsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRXJybyBpbnRlcm5vIGRvIHNlcnZpZG9yJyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRhciBjb25maWd1cmHDp8Ojb1xuICAgKi9cbiAgYXN5bmMgZGVsZXRlKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBjaGF2ZSB9ID0gcmVxLnBhcmFtcztcblxuICAgICAgYXdhaXQgcHJpc21hLmNvbmZpZ3VyYWNhby5kZWxldGUoe1xuICAgICAgICB3aGVyZTogeyBjaGF2ZSB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIG1lc3NhZ2U6ICdDb25maWd1cmHDp8OjbyByZW1vdmlkYSBjb20gc3VjZXNzbycsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRGVsZXRlIGNvbmZpZ3VyYWNhbyBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9idGVyIGNvbmZpZ3VyYcOnw7VlcyBww7pibGljYXMgKHBhcmEgbyBzaXRlKVxuICAgKi9cbiAgYXN5bmMgZ2V0UHVibGljKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb25maWd1cmFjb2VzID0gYXdhaXQgcHJpc21hLmNvbmZpZ3VyYWNhby5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgY2hhdmU6IHtcbiAgICAgICAgICAgIGluOiBbXG4gICAgICAgICAgICAgICdub21lX3JldmVuZGEnLFxuICAgICAgICAgICAgICAndGVsZWZvbmVfcmV2ZW5kYScsXG4gICAgICAgICAgICAgICd3aGF0c2FwcF9yZXZlbmRhJyxcbiAgICAgICAgICAgICAgJ2VtYWlsX3JldmVuZGEnLFxuICAgICAgICAgICAgICAnZW5kZXJlY29fcmV2ZW5kYScsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgY29uZmlnTWFwID0gY29uZmlndXJhY29lcy5yZWR1Y2UoKGFjYywgY29uZmlnKSA9PiB7XG4gICAgICAgIGFjY1tjb25maWcuY2hhdmVdID0gY29uZmlnLnZhbG9yO1xuICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgfSwge30gYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPik7XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IGNvbmZpZ01hcCxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdHZXQgcHVibGljIGNvbmZpZ3VyYWNvZXMgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgY29uZmlndXJhY2FvQ29udHJvbGxlciA9IG5ldyBDb25maWd1cmFjYW9Db250cm9sbGVyKCk7Il19