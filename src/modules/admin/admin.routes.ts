import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
    getDashboard,
    listUsers,
    getAuditLogs,
    setUserStatus,
} from './admin.controller';

const router = Router();

// All admin routes require authentication
// TODO: add an isAdmin middleware once you add roles to the User model
router.use(authenticate);

router.get('/dashboard', getDashboard);
router.get('/users', listUsers);
router.patch('/users/:userId/status', setUserStatus);
router.get('/audit-logs', getAuditLogs);

export { router as adminRouter };
