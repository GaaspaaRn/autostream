import { Router } from 'express';
import { configuracaoController } from '../controllers/configuracao.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Rota pública
router.get('/public', configuracaoController.getPublic);

// Rotas protegidas
router.use(authenticate);
router.use(authorize('ADMIN', 'GERENTE'));

router.get('/', configuracaoController.list);
router.get('/:chave', configuracaoController.getByChave);
router.post('/', configuracaoController.upsert);
router.post('/bulk', configuracaoController.bulkUpdate);
router.delete('/:chave', configuracaoController.delete);

export { router as configuracaoRoutes };