import { Router } from 'express';
import { leadController } from '../controllers/lead.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Rotas públicas
router.post('/', leadController.create);

// Rotas protegidas
router.get('/', authenticate, leadController.list);
router.get('/:id', authenticate, leadController.getById);
router.patch('/:id', authenticate, leadController.update);
router.delete('/:id', authenticate, leadController.archive);
router.get('/:id/recomendacoes', authenticate, authorize('ADMIN', 'GERENTE'), leadController.getRecomendacoes);
router.post('/:id/atribuir', authenticate, authorize('ADMIN', 'GERENTE'), leadController.atribuirVendedor);
router.post('/:id/atividades', authenticate, leadController.addAtividade);

export { router as leadRoutes };