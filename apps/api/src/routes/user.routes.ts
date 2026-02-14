import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'GERENTE'), userController.list);
router.get('/:id', userController.getById);
router.post('/', authorize('ADMIN'), userController.create);
router.patch('/:id', userController.update);
router.delete('/:id', authorize('ADMIN'), userController.deactivate);
router.get('/:id/performance', userController.getPerformance);
router.get('/:id/leads', userController.getLeadsAtuais);

export { router as userRoutes };