import { Router } from 'express';
import * as AdminController from './admin.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication
// TODO: add an isAdmin middleware once you add roles to the User model
router.use(authenticate);

router.get('/dashboard', AdminController.getDashboard);
router.get('/users', AdminController.listUsers);
router.patch('/users/:userId/status', AdminController.setUserStatus);
router.get('/audit-logs', AdminController.getAuditLogs);

export { router as adminRouter };
