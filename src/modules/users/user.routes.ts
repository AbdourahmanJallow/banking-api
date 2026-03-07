import { Router } from 'express';
import * as UserController from './user.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get('/me', UserController.getMe);
router.patch('/me', UserController.updateMe);
router.patch('/me/password', UserController.changePassword);

export { router as userRouter };
