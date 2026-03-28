import { Router } from 'express';
import {
    verifyEmail,
    resetPassword,
    getMe,
    getKYCStatus,
    getUserById,
    updateMe,
    changePassword,
    enableTOTP,
    confirmTOTP,
    validateTOTP,
    disableTOTP,
    submitKYC,
    listUsers,
    deactivateUser,
    approveKYC,
    rejectKYC,
    sendVerificationEmail,
    initiatePasswordReset,
} from './user.controller';

import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// PUBLIC ROUTES (No authentication required)

// Email verification
router.post('/email/verify', verifyEmail);
router.post('/email/resend-verification', sendVerificationEmail); // Actually requires auth - moved below

// Password reset
router.post('/password/reset-initiate', initiatePasswordReset);
router.post('/password/reset-complete', resetPassword);

// AUTHENTICATED ROUTES
router.use(authenticate);

// Core user management
router.get('/me', getMe);
router.patch('/me', updateMe);
router.patch('/me/password', changePassword);

// Email verification
router.post('/email/resend-verification', sendVerificationEmail);

// 2FA / TOTP
router.post('/2fa/enable', enableTOTP);
router.post('/2fa/confirm', confirmTOTP);
router.post('/2fa/validate', validateTOTP);
router.post('/2fa/disable', disableTOTP);

// KYC / Compliance
router.post('/kyc/submit', submitKYC);
router.get('/kyc/status', getKYCStatus);

// ADMIN ROUTES

// User management
router.get('/', listUsers);
router.get('/:id', getUserById);
router.patch('/:id/deactivate', deactivateUser);

// KYC Admin
router.patch('/:id/kyc/approve', approveKYC);
router.patch('/:id/kyc/reject', rejectKYC);

export { router as userRouter };
