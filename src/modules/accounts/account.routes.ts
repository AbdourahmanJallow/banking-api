import { Router } from 'express';
import {
    createAccount,
    getAccount,
    getMyAccounts,
    updateAccountStatus,
    addBeneficiary,
    removeBeneficiary,
    listBeneficiaries,
    createStandingOrder,
    pauseStandingOrder,
    resumeStandingOrder,
    listStandingOrders,
    updatePreferences,
    getPreferences,
    setTransactionLimits,
    getTransactionLimits,
    createAlert,
    disableAlert,
    listAlerts,
    generateStatement,
    listStatements,
    getSpendingByCategory,
    getMonthlySpendingTrend,
    getTopMerchants,
} from './account.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Account Management
router.post('/', createAccount);
router.get('/', getMyAccounts);
router.get('/:id', getAccount);
router.patch('/:id/status', updateAccountStatus);

// Beneficiary Management
router.post('/:accountId/beneficiaries', addBeneficiary);
router.get('/:accountId/beneficiaries', listBeneficiaries);
router.delete('/:accountId/beneficiaries/:beneficiaryId', removeBeneficiary);

// Standing Orders
router.post('/:accountId/standing-orders', createStandingOrder);
router.get('/:accountId/standing-orders', listStandingOrders);
router.patch('/:accountId/standing-orders/:orderId/pause', pauseStandingOrder);
router.patch(
    '/:accountId/standing-orders/:orderId/resume',
    resumeStandingOrder,
);

// Preferences
router.get('/:accountId/preferences', getPreferences);
router.put('/:accountId/preferences', updatePreferences);

// Transaction Limits
router.post('/:accountId/limits', setTransactionLimits);
router.get('/:accountId/limits', getTransactionLimits);

// Alerts
router.post('/:accountId/alerts', createAlert);
router.get('/:accountId/alerts', listAlerts);
router.delete('/:accountId/alerts/:alertId', disableAlert);

// Statements
router.post('/:accountId/statements', generateStatement);
router.get('/:accountId/statements', listStatements);

// Analytics
router.get('/:accountId/analytics/spending', getSpendingByCategory);
router.get('/:accountId/analytics/trends', getMonthlySpendingTrend);
router.get('/:accountId/analytics/merchants', getTopMerchants);

export { router as accountRouter };
