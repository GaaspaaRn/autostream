import { Router } from 'express';
import { negociacaoController } from '../controllers/negociacao.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', negociacaoController.list);
router.get('/kanban', negociacaoController.getKanban);
router.get('/:id', negociacaoController.getById);
router.post('/', negociacaoController.create);
router.patch('/:id/status', negociacaoController.updateStatus);
router.post('/:id/propostas', negociacaoController.addProposta);
router.post('/:id/atividades', negociacaoController.addAtividade);
router.post('/:id/documentos', negociacaoController.addDocumento);

export { router as negociacaoRoutes };