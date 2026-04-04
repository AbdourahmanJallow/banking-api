import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
    getDashboard,
    listUsers,
    setUserStatus,
    getTransactions,
    getAuditLogs,
    getUserActivity,
    getSystemHealth,
    getKYCAnalytics,
} from './admin.controller';

const router = Router();

// All admin routes require authentication
// TODO: add an isAdmin middleware once you add roles to the User model
router.use(authenticate);

// Dashboard & Analytics
router.get('/dashboard', getDashboard);
router.get('/system-health', getSystemHealth);
router.get('/kyc-analytics', getKYCAnalytics);

// User Management
router.get('/users', listUsers);
router.patch('/users/:userId/status', setUserStatus);
router.get('/users/:userId/activity', getUserActivity);

// Monitoring
router.get('/transactions', getTransactions);
router.get('/audit-logs', getAuditLogs);

export { router as adminRouter };
