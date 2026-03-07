import { Router } from 'express';
import * as TransactionController from './transaction.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/transfer', TransactionController.transfer);
router.post('/deposit', TransactionController.deposit);
router.post('/withdrawal', TransactionController.withdrawal);
router.get('/:id', TransactionController.getTransaction);
router.get('/account/:accountId', TransactionController.getAccountTransactions);

export { router as transactionRouter };
