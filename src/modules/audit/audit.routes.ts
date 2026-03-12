import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getLogs, getLog, getUserLogs } from './audit.controller';

const router = Router();

// All audit routes require authentication (admin-only in practice)
router.use(authenticate);

router.get('/logs', getLogs);
router.get('/logs/:id', getLog);
router.get('/users/:userId/logs', getUserLogs);

export { router as auditRouter };
