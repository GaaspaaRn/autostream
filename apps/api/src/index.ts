import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { authRoutes } from './routes/auth.routes';
import { leadRoutes } from './routes/lead.routes';
import { userRoutes } from './routes/user.routes';
import { veiculoRoutes } from './routes/veiculo.routes';
import { negociacaoRoutes } from './routes/negociacao.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { configuracaoRoutes } from './routes/configuracao.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/veiculos', veiculoRoutes);
app.use('/api/negociacoes', negociacaoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/configuracoes', configuracaoRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 API AutoStream rodando na porta ${PORT}`);
  console.log(`📚 Documentação: http://localhost:${PORT}/health`);
});