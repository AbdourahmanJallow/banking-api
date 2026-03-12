import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { userRouter } from '../modules/users/user.routes';
import { accountRouter } from '../modules/accounts/account.routes';
import { transactionRouter } from '../modules/transactions/transaction.routes';
import { adminRouter } from '../modules/admin/admin.routes';
import { auditRouter } from '../modules/audit/audit.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/accounts', accountRouter);
router.use('/transactions', transactionRouter);
router.use('/admin', adminRouter);
router.use('/audit', auditRouter);

export default router;
