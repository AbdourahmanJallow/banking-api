import { Router } from 'express';
import * as AccountController from './account.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', AccountController.createAccount);
router.get('/', AccountController.getMyAccounts);
router.get('/:id', AccountController.getAccount);
router.patch('/:id/status', AccountController.updateAccountStatus);

export { router as accountRouter };
