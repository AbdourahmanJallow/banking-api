import { Router } from 'express';
import {
    createAccount,
    getAccount,
    getMyAccounts,
    updateAccountStatus,
} from './account.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', createAccount);
router.get('/', getMyAccounts);
router.get('/:id', getAccount);
router.patch('/:id/status', updateAccountStatus);

export { router as accountRouter };
