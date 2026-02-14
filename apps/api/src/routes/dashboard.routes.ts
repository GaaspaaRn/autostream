import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/metricas', dashboardController.getMetricas);
router.get('/funil', dashboardController.getFunil);
router.get('/leads-por-dia', dashboardController.getLeadsPorDia);
router.get('/vendedores', authorize('ADMIN', 'GERENTE'), dashboardController.getRankingVendedores);
router.get('/categorias', dashboardController.getDistribuicaoCategoria);
router.get('/leads-atencao', dashboardController.getLeadsAtencao);

export { router as dashboardRoutes };