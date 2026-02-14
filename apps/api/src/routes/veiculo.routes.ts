import { Router } from 'express';
import { veiculoController } from '../controllers/veiculo.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Rotas públicas
router.get('/public', veiculoController.listPublic);
router.get('/destaques', veiculoController.getDestaques);
router.get('/marcas', veiculoController.getMarcas);
router.get('/faixa-precos', veiculoController.getFaixaPrecos);
router.get('/slug/:slug', veiculoController.getBySlug);

// Rotas protegidas (admin)
router.get('/', authenticate, authorize('ADMIN', 'GERENTE'), veiculoController.listAdmin);
router.get('/:id', authenticate, authorize('ADMIN', 'GERENTE'), veiculoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'GERENTE'), veiculoController.create);
router.patch('/:id', authenticate, authorize('ADMIN', 'GERENTE'), veiculoController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'GERENTE'), veiculoController.archive);

export { router as veiculoRoutes };