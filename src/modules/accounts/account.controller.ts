import { Request, Response } from 'express';
import * as AccountService from './account.service';
import {
    CreateAccountSchema,
    UpdateAccountStatusSchema,
} from './account.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export const createAccount = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const input = CreateAccountSchema.parse(req.body);
        const account = await AccountService.createAccount(
            req.user.userId,
            input,
        );
        sendCreated(res, account, 'Account created successfully');
    },
);

export const getMyAccounts = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const accounts = await AccountService.getUserAccounts(req.user.userId);
        sendSuccess(res, accounts);
    },
);

export const getAccount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const account = await AccountService.getAccount(
        req.params.id,
        req.user.userId,
    );
    sendSuccess(res, account);
});

export const updateAccountStatus = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const input = UpdateAccountStatusSchema.parse(req.body);
        const account = await AccountService.updateAccountStatus(
            req.params.id,
            input,
            req.user.userId,
        );
        sendSuccess(res, account, 'Account status updated');
    },
);
