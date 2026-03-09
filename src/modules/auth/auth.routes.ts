import { Router } from 'express';
import { register, login, logout, me, refresh } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout); // requires valid token
router.get('/me', authenticate, me);

export { router as authRouter };
