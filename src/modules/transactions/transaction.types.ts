import { z } from 'zod';

export enum TransactionType {
    TRANSFER = 'TRANSFER',
    DEPOSIT = 'DEPOSIT',
    WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REVERSED = 'REVERSED',
}

export enum EntryType {
    DEBIT = 'DEBIT',
    CREDIT = 'CREDIT',
}

export const TransferSchema = z.object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.number().positive('Amount must be positive'),
    currency: z.string().length(3).toUpperCase(),
    idempotencyKey: z.string().min(1).max(255).optional(),
});

export const DepositSchema = z.object({
    accountId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().length(3).toUpperCase(),
    idempotencyKey: z.string().min(1).max(255).optional(),
});

export const WithdrawalSchema = z.object({
    accountId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().length(3).toUpperCase(),
    idempotencyKey: z.string().min(1).max(255).optional(),
});

export type TransferInput = z.infer<typeof TransferSchema>;
export type DepositInput = z.infer<typeof DepositSchema>;
export type WithdrawalInput = z.infer<typeof WithdrawalSchema>;
