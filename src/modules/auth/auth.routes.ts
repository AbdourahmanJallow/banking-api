import { Router } from 'express';
import * as AuthController from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', authenticate, AuthController.logout); // requires valid token
router.get('/me', authenticate, AuthController.me);

export { router as authRouter };
