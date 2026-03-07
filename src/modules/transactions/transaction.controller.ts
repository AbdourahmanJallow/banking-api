import { Request, Response } from 'express';
import { transactionService } from './transaction.service';
import {
    TransferSchema,
    DepositSchema,
    WithdrawalSchema,
} from './transaction.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export const transfer = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const input = TransferSchema.parse(req.body);

    const tx = await transactionService.transfer(input, req.user.userId);

    sendCreated(res, tx, 'Transfer successful');
});

export const deposit = asyncHandler(async (req: Request, res: Response) => {
    const input = DepositSchema.parse(req.body);

    const tx = await transactionService.deposit(input);

    sendCreated(res, tx, 'Deposit successful');
});

export const withdrawal = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const input = WithdrawalSchema.parse(req.body);

    const tx = await transactionService.withdrawal(input, req.user.userId);

    sendCreated(res, tx, 'Withdrawal successful');
});

export const getTransaction = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const tx = await transactionService.getTransaction(
            req.params.id as string,
            req.user.userId,
        );

        sendSuccess(res, tx);
    },
);

export const getAccountTransactions = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) throw AppError.unauthorized();

        const page = Number(req.query.page) || 1;

        const limit = Math.min(Number(req.query.limit) || 20, 100);

        const { transactions, total } =
            await transactionService.getAccountTransactions(
                req.params.accountId as string,
                req.user.userId,
                page,
                limit,
            );

        sendPaginated(res, transactions, total, page, limit);
    },
);
