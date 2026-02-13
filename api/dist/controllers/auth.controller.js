"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-change-in-production';
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
class AuthController {
    async login(req, res) {
        try {
            const { email, password, rememberMe } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email e senha são obrigatórios' });
            }
            // Buscar usuário
            const userRaw = await prisma_1.prisma.user.findUnique({
                where: { email },
            });
            if (!userRaw) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            // Verificar se usuário está ativo
            if (userRaw.status !== 'ATIVO') {
                return res.status(401).json({ error: 'Usuário inativo ou em férias' });
            }
            // Verificar senha
            const isValidPassword = await bcryptjs_1.default.compare(password, userRaw.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            const user = parseUserFields(userRaw);
            // Gerar tokens
            const accessToken = jsonwebtoken_1.default.sign({
                userId: user.id,
                email: user.email,
                role: user.role,
                nome: user.nome,
            }, JWT_SECRET, { expiresIn: '15m' });
            const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: rememberMe ? '30d' : '7d' });
            // Retornar dados do usuário e tokens
            return res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        nome: user.nome,
                        telefone: user.telefone,
                        foto_url: user.foto_url,
                        role: user.role,
                        nivel: user.nivel,
                        // Add parsed fields if needed in frontend login response, usually yes
                        especialidades: user.especialidades,
                    },
                    tokens: {
                        accessToken,
                        refreshToken,
                    },
                },
            });
        }
        catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    async refresh(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({ error: 'Refresh token não fornecido' });
            }
            // Verificar refresh token
            const decoded = jsonwebtoken_1.default.verify(refreshToken, REFRESH_SECRET);
            // Buscar usuário
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: decoded.userId },
            });
            if (!user || user.status !== 'ATIVO') {
                return res.status(401).json({ error: 'Usuário inválido ou inativo' });
            }
            // Gerar novo access token
            const newAccessToken = jsonwebtoken_1.default.sign({
                userId: user.id,
                email: user.email,
                role: user.role,
                nome: user.nome,
            }, JWT_SECRET, { expiresIn: '15m' });
            return res.json({
                success: true,
                data: {
                    accessToken: newAccessToken,
                },
            });
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                return res.status(401).json({ error: 'Refresh token expirado' });
            }
            return res.status(401).json({ error: 'Token inválido' });
        }
    }
    async logout(req, res) {
        // Em uma implementação mais completa, invalidaríamos o token no banco
        // Por enquanto, apenas retornamos sucesso
        return res.json({
            success: true,
            message: 'Logout realizado com sucesso',
        });
    }
    async me(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Não autenticado' });
            }
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: req.user.id },
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
            console.error('Me error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    async changePassword(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Não autenticado' });
            }
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
            }
            // Buscar usuário com senha
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: req.user.id },
            });
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            // Verificar senha atual
            const isValid = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
            if (!isValid) {
                return res.status(400).json({ error: 'Senha atual incorreta' });
            }
            // Hash nova senha
            const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 10);
            // Atualizar senha
            await prisma_1.prisma.user.update({
                where: { id: req.user.id },
                data: { password_hash: newPasswordHash },
            });
            return res.json({
                success: true,
                message: 'Senha alterada com sucesso',
            });
        }
        catch (error) {
            console.error('Change password error:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5jb250cm9sbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnRyb2xsZXJzL2F1dGguY29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFDQSx3REFBOEI7QUFDOUIsZ0VBQStCO0FBQy9CLDBDQUF1QztBQUd2QyxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxzQ0FBc0MsQ0FBQztBQUNwRixNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsSUFBSSwwQ0FBMEMsQ0FBQztBQUVoRyxtQ0FBbUM7QUFDbkMsTUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFTLEVBQUUsRUFBRTtJQUNwQyxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQ3ZCLE9BQU87UUFDTCxHQUFHLElBQUk7UUFDUCxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDMUUsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO0tBQ3RGLENBQUM7QUFDSixDQUFDLENBQUM7QUFFRixNQUFhLGNBQWM7SUFDekIsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFZLEVBQUUsR0FBYTtRQUNyQyxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBRWpELElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDeEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxD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a0JBQWtCO1lBQ2xCLE1BQU0sZUFBZSxHQUFHLE1BQU0sa0JBQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRTNELGtCQUFrQjtZQUNsQixNQUFNLGVBQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUN2QixLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUU7Z0JBQzFCLElBQUksRUFBRSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUU7YUFDekMsQ0FBQyxDQUFDO1lBRUgsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUNkLE9BQU8sRUFBRSxJQUFJO2dCQUNiLE9BQU8sRUFBRSw0QkFBNEI7YUFDdEMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQy9DLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUE5TkQsd0NBOE5DO0FBRVksUUFBQSxjQUFjLEdBQUcsSUFBSSxjQUFjLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgYmNyeXB0IGZyb20gJ2JjcnlwdGpzJztcbmltcG9ydCBqd3QgZnJvbSAnanNvbndlYnRva2VuJztcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gJy4uL2xpYi9wcmlzbWEnO1xuaW1wb3J0IHsgQXV0aGVudGljYXRlZFJlcXVlc3QgfSBmcm9tICcuLi90eXBlcyc7XG5cbmNvbnN0IEpXVF9TRUNSRVQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUIHx8ICd5b3VyLXNlY3JldC1rZXktY2hhbmdlLWluLXByb2R1Y3Rpb24nO1xuY29uc3QgUkVGUkVTSF9TRUNSRVQgPSBwcm9jZXNzLmVudi5SRUZSRVNIX1NFQ1JFVCB8fCAneW91ci1yZWZyZXNoLXNlY3JldC1jaGFuZ2UtaW4tcHJvZHVjdGlvbic7XG5cbi8vIEhlbHBlciB0byBwYXJzZS9zdHJpbmdpZnkgZmllbGRzXG5jb25zdCBwYXJzZVVzZXJGaWVsZHMgPSAodXNlcjogYW55KSA9PiB7XG4gIGlmICghdXNlcikgcmV0dXJuIG51bGw7XG4gIHJldHVybiB7XG4gICAgLi4udXNlcixcbiAgICBlc3BlY2lhbGlkYWRlczogdXNlci5lc3BlY2lhbGlkYWRlcyA/IEpTT04ucGFyc2UodXNlci5lc3BlY2lhbGlkYWRlcykgOiBbXSxcbiAgICByZWdyYXNfYXRyaWJ1aWNhbzogdXNlci5yZWdyYXNfYXRyaWJ1aWNhbyA/IEpTT04ucGFyc2UodXNlci5yZWdyYXNfYXRyaWJ1aWNhbykgOiBudWxsLFxuICB9O1xufTtcblxuZXhwb3J0IGNsYXNzIEF1dGhDb250cm9sbGVyIHtcbiAgYXN5bmMgbG9naW4ocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkLCByZW1lbWJlck1lIH0gPSByZXEuYm9keTtcblxuICAgICAgaWYgKCFlbWFpbCB8fCAhcGFzc3dvcmQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdFbWFpbCBlIHNlbmhhIHPDo28gb2JyaWdhdMOzcmlvcycgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEJ1c2NhciB1c3XDoXJpb1xuICAgICAgY29uc3QgdXNlclJhdyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgICB3aGVyZTogeyBlbWFpbCB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghdXNlclJhdykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDEpLmpzb24oeyBlcnJvcjogJ0NyZWRlbmNpYWlzIGludsOhbGlkYXMnIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgc2UgdXN1w6FyaW8gZXN0w6EgYXRpdm9cbiAgICAgIGlmICh1c2VyUmF3LnN0YXR1cyAhPT0gJ0FUSVZPJykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDEpLmpzb24oeyBlcnJvcjogJ1VzdcOhcmlvIGluYXRpdm8gb3UgZW0gZsOpcmlhcycgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFZlcmlmaWNhciBzZW5oYVxuICAgICAgY29uc3QgaXNWYWxpZFBhc3N3b3JkID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUocGFzc3dvcmQsIHVzZXJSYXcucGFzc3dvcmRfaGFzaCk7XG5cbiAgICAgIGlmICghaXNWYWxpZFBhc3N3b3JkKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMSkuanNvbih7IGVycm9yOiAnQ3JlZGVuY2lhaXMgaW52w6FsaWRhcycgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHVzZXIgPSBwYXJzZVVzZXJGaWVsZHModXNlclJhdyk7XG5cbiAgICAgIC8vIEdlcmFyIHRva2Vuc1xuICAgICAgY29uc3QgYWNjZXNzVG9rZW4gPSBqd3Quc2lnbihcbiAgICAgICAge1xuICAgICAgICAgIHVzZXJJZDogdXNlci5pZCxcbiAgICAgICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgICAgICByb2xlOiB1c2VyLnJvbGUsXG4gICAgICAgICAgbm9tZTogdXNlci5ub21lLFxuICAgICAgICB9LFxuICAgICAgICBKV1RfU0VDUkVULFxuICAgICAgICB7IGV4cGlyZXNJbjogJzE1bScgfVxuICAgICAgKTtcblxuICAgICAgY29uc3QgcmVmcmVzaFRva2VuID0gand0LnNpZ24oXG4gICAgICAgIHsgdXNlcklkOiB1c2VyLmlkIH0sXG4gICAgICAgIFJFRlJFU0hfU0VDUkVULFxuICAgICAgICB7IGV4cGlyZXNJbjogcmVtZW1iZXJNZSA/ICczMGQnIDogJzdkJyB9XG4gICAgICApO1xuXG4gICAgICAvLyBSZXRvcm5hciBkYWRvcyBkbyB1c3XDoXJpbyBlIHRva2Vuc1xuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHVzZXI6IHtcbiAgICAgICAgICAgIGlkOiB1c2VyLmlkLFxuICAgICAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgICAgICBub21lOiB1c2VyLm5vbWUsXG4gICAgICAgICAgICB0ZWxlZm9uZTogdXNlci50ZWxlZm9uZSxcbiAgICAgICAgICAgIGZvdG9fdXJsOiB1c2VyLmZvdG9fdXJsLFxuICAgICAgICAgICAgcm9sZTogdXNlci5yb2xlLFxuICAgICAgICAgICAgbml2ZWw6IHVzZXIubml2ZWwsXG4gICAgICAgICAgICAvLyBBZGQgcGFyc2VkIGZpZWxkcyBpZiBuZWVkZWQgaW4gZnJvbnRlbmQgbG9naW4gcmVzcG9uc2UsIHVzdWFsbHkgeWVzXG4gICAgICAgICAgICBlc3BlY2lhbGlkYWRlczogdXNlci5lc3BlY2lhbGlkYWRlcyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRva2Vuczoge1xuICAgICAgICAgICAgYWNjZXNzVG9rZW4sXG4gICAgICAgICAgICByZWZyZXNoVG9rZW4sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdMb2dpbiBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVmcmVzaChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyByZWZyZXNoVG9rZW4gfSA9IHJlcS5ib2R5O1xuXG4gICAgICBpZiAoIXJlZnJlc2hUb2tlbikge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ1JlZnJlc2ggdG9rZW4gbsOjbyBmb3JuZWNpZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgcmVmcmVzaCB0b2tlblxuICAgICAgY29uc3QgZGVjb2RlZCA9IGp3dC52ZXJpZnkocmVmcmVzaFRva2VuLCBSRUZSRVNIX1NFQ1JFVCkgYXMgeyB1c2VySWQ6IHN0cmluZyB9O1xuXG4gICAgICAvLyBCdXNjYXIgdXN1w6FyaW9cbiAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IGRlY29kZWQudXNlcklkIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCF1c2VyIHx8IHVzZXIuc3RhdHVzICE9PSAnQVRJVk8nKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMSkuanNvbih7IGVycm9yOiAnVXN1w6FyaW8gaW52w6FsaWRvIG91IGluYXRpdm8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXJhciBub3ZvIGFjY2VzcyB0b2tlblxuICAgICAgY29uc3QgbmV3QWNjZXNzVG9rZW4gPSBqd3Quc2lnbihcbiAgICAgICAge1xuICAgICAgICAgIHVzZXJJZDogdXNlci5pZCxcbiAgICAgICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgICAgICByb2xlOiB1c2VyLnJvbGUsXG4gICAgICAgICAgbm9tZTogdXNlci5ub21lLFxuICAgICAgICB9LFxuICAgICAgICBKV1RfU0VDUkVULFxuICAgICAgICB7IGV4cGlyZXNJbjogJzE1bScgfVxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGFjY2Vzc1Rva2VuOiBuZXdBY2Nlc3NUb2tlbixcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBqd3QuVG9rZW5FeHBpcmVkRXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAxKS5qc29uKHsgZXJyb3I6ICdSZWZyZXNoIHRva2VuIGV4cGlyYWRvJyB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMSkuanNvbih7IGVycm9yOiAnVG9rZW4gaW52w6FsaWRvJyB9KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBsb2dvdXQocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSB7XG4gICAgLy8gRW0gdW1hIGltcGxlbWVudGHDp8OjbyBtYWlzIGNvbXBsZXRhLCBpbnZhbGlkYXLDrWFtb3MgbyB0b2tlbiBubyBiYW5jb1xuICAgIC8vIFBvciBlbnF1YW50bywgYXBlbmFzIHJldG9ybmFtb3Mgc3VjZXNzb1xuICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogJ0xvZ291dCByZWFsaXphZG8gY29tIHN1Y2Vzc28nLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgbWUocmVxOiBBdXRoZW50aWNhdGVkUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgIHRyeSB7XG4gICAgICBpZiAoIXJlcS51c2VyKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMSkuanNvbih7IGVycm9yOiAnTsOjbyBhdXRlbnRpY2FkbycgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IHJlcS51c2VyLmlkIH0sXG4gICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgIG5vbWU6IHRydWUsXG4gICAgICAgICAgdGVsZWZvbmU6IHRydWUsXG4gICAgICAgICAgZm90b191cmw6IHRydWUsXG4gICAgICAgICAgcm9sZTogdHJ1ZSxcbiAgICAgICAgICBuaXZlbDogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgZXNwZWNpYWxpZGFkZXM6IHRydWUsXG4gICAgICAgICAgbWV0YV9tZW5zYWxfdW5pZGFkZXM6IHRydWUsXG4gICAgICAgICAgbWV0YV9tZW5zYWxfdmFsb3I6IHRydWUsXG4gICAgICAgICAgY2FwYWNpZGFkZV9tYXhfbGVhZHM6IHRydWUsXG4gICAgICAgICAgcmVncmFzX2F0cmlidWljYW86IHRydWUsXG4gICAgICAgICAgY3JlYXRlZF9hdDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdVc3XDoXJpbyBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBwYXJzZVVzZXJGaWVsZHModXNlciksXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignTWUgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdFcnJvIGludGVybm8gZG8gc2Vydmlkb3InIH0pO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNoYW5nZVBhc3N3b3JkKHJlcTogQXV0aGVudGljYXRlZFJlcXVlc3QsIHJlczogUmVzcG9uc2UpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFyZXEudXNlcikge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDEpLmpzb24oeyBlcnJvcjogJ07Do28gYXV0ZW50aWNhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGN1cnJlbnRQYXNzd29yZCwgbmV3UGFzc3dvcmQgfSA9IHJlcS5ib2R5O1xuXG4gICAgICBpZiAoIWN1cnJlbnRQYXNzd29yZCB8fCAhbmV3UGFzc3dvcmQpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdTZW5oYSBhdHVhbCBlIG5vdmEgc2VuaGEgc8OjbyBvYnJpZ2F0w7NyaWFzJyB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1Bhc3N3b3JkLmxlbmd0aCA8IDYpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdOb3ZhIHNlbmhhIGRldmUgdGVyIHBlbG8gbWVub3MgNiBjYXJhY3RlcmVzJyB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gQnVzY2FyIHVzdcOhcmlvIGNvbSBzZW5oYVxuICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgICB3aGVyZTogeyBpZDogcmVxLnVzZXIuaWQgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdVc3XDoXJpbyBuw6NvIGVuY29udHJhZG8nIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZmljYXIgc2VuaGEgYXR1YWxcbiAgICAgIGNvbnN0IGlzVmFsaWQgPSBhd2FpdCBiY3J5cHQuY29tcGFyZShjdXJyZW50UGFzc3dvcmQsIHVzZXIucGFzc3dvcmRfaGFzaCk7XG5cbiAgICAgIGlmICghaXNWYWxpZCkge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ1NlbmhhIGF0dWFsIGluY29ycmV0YScgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEhhc2ggbm92YSBzZW5oYVxuICAgICAgY29uc3QgbmV3UGFzc3dvcmRIYXNoID0gYXdhaXQgYmNyeXB0Lmhhc2gobmV3UGFzc3dvcmQsIDEwKTtcblxuICAgICAgLy8gQXR1YWxpemFyIHNlbmhhXG4gICAgICBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogcmVxLnVzZXIuaWQgfSxcbiAgICAgICAgZGF0YTogeyBwYXNzd29yZF9oYXNoOiBuZXdQYXNzd29yZEhhc2ggfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiAnU2VuaGEgYWx0ZXJhZGEgY29tIHN1Y2Vzc28nLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYW5nZSBwYXNzd29yZCBlcnJvcjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0Vycm8gaW50ZXJubyBkbyBzZXJ2aWRvcicgfSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBhdXRoQ29udHJvbGxlciA9IG5ldyBBdXRoQ29udHJvbGxlcigpOyJdfQ==