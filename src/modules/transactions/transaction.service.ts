import { randomUUID } from 'crypto';
import prisma from '../../lib/prisma';
import { transactionRepository } from './transaction.repository';
import { accountRepository } from '../accounts/account.repository';
import { ledgerService } from '../ledger/ledger.service';
import { idempotencyService, IdempotencyResult } from '../../utils/idempotency';
import {
    TransferInput,
    DepositInput,
    WithdrawalInput,
    TransactionType,
    TransactionStatus,
} from './transaction.types';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

/**
 * Isolation level used for every financial mutation.
 *
 * SERIALIZABLE makes Postgres treat each transaction as if it ran alone —
 * preventing phantom reads, non-repeatable reads, and double-spend races.
 * If two concurrent requests conflict, Postgres aborts one with a
 * serialization error; the caller (idempotency layer or client) can retry.
 */
const TX_OPTIONS = { isolationLevel: 'Serializable' } as const;

class TransactionService {
    private generateReference(): string {
        return `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    }

    // ── Private ACID helpers ─────────────────────────────────────────────
    // Each method runs entirely inside a single prisma.$transaction().
    // If any step throws, Postgres rolls back every write atomically.

    private async _transfer(input: TransferInput, requestingUserId: string) {
        const { fromAccountId, toAccountId, amount, currency = 'GMD' } = input;

        if (fromAccountId === toAccountId)
            throw AppError.badRequest('Cannot transfer to the same account');

        return prisma.$transaction(async (tx) => {
            // Read both accounts inside the transaction so Postgres can
            // detect conflicts under Serializable isolation.
            const [fromAccount, toAccount] = await Promise.all([
                accountRepository.findById(fromAccountId, tx),
                accountRepository.findById(toAccountId, tx),
            ]);

            if (!fromAccount)
                throw AppError.notFound('Source account not found');

            if (fromAccount.userId !== requestingUserId)
                throw AppError.forbidden('Access denied to source account');

            if (fromAccount.status !== 'ACTIVE')
                throw AppError.badRequest('Source account is not active');

            if (!toAccount)
                throw AppError.notFound('Destination account not found');

            if (toAccount.status !== 'ACTIVE')
                throw AppError.badRequest('Destination account is not active');

            const transaction = await transactionRepository.create(
                {
                    reference: this.generateReference(),
                    type: TransactionType.TRANSFER,
                    amount,
                    currency,
                    status: TransactionStatus.PENDING,
                },
                tx,
            );

            // Ledger service performs balance/currency validation, writes
            // debit + credit entries, and updates both account balances.
            await ledgerService.recordTransfer(
                transaction.id,
                fromAccountId,
                toAccountId,
                amount,
                tx,
            );

            await transactionRepository.updateStatus(
                transaction.id,
                TransactionStatus.COMPLETED,
                tx,
            );

            return transactionRepository.findById(transaction.id, tx);
        }, TX_OPTIONS);
    }

    private async _deposit(input: DepositInput, requestingUserId: string) {
        const { accountId, amount, currency = 'GMD' } = input;

        return prisma.$transaction(async (tx) => {
            const account = await accountRepository.findById(accountId, tx);

            if (!account) throw AppError.notFound('Account not found');

            if (account.userId !== requestingUserId)
                throw AppError.forbidden('Access denied');

            if (account.status !== 'ACTIVE')
                throw AppError.badRequest('Account is not active');

            const transaction = await transactionRepository.create(
                {
                    reference: this.generateReference(),
                    type: TransactionType.DEPOSIT,
                    amount,
                    currency,
                    status: TransactionStatus.PENDING,
                },
                tx,
            );

            await ledgerService.recordDeposit(
                transaction.id,
                accountId,
                amount,
                tx,
            );

            await transactionRepository.updateStatus(
                transaction.id,
                TransactionStatus.COMPLETED,
                tx,
            );

            return transactionRepository.findById(transaction.id, tx);
        }, TX_OPTIONS);
    }

    private async _withdrawal(
        input: WithdrawalInput,
        requestingUserId: string,
    ) {
        const { accountId, amount, currency = 'GMD' } = input;

        return prisma.$transaction(async (tx) => {
            const account = await accountRepository.findById(accountId, tx);

            if (!account) throw AppError.notFound('Account not found');

            if (account.userId !== requestingUserId)
                throw AppError.forbidden('Access denied');

            if (account.status !== 'ACTIVE')
                throw AppError.badRequest('Account is not active');

            const transaction = await transactionRepository.create(
                {
                    reference: this.generateReference(),
                    type: TransactionType.WITHDRAWAL,
                    amount,
                    currency,
                    status: TransactionStatus.PENDING,
                },
                tx,
            );

            await ledgerService.recordWithdrawal(
                transaction.id,
                accountId,
                amount,
                tx,
            );

            await transactionRepository.updateStatus(
                transaction.id,
                TransactionStatus.COMPLETED,
                tx,
            );

            return transactionRepository.findById(transaction.id, tx);
        }, TX_OPTIONS);
    }

    // ── Public methods ────────────────────────────────────────────────────

    async transfer(
        input: TransferInput,
        requestingUserId: string,
    ): Promise<
        IdempotencyResult<Awaited<ReturnType<TransactionService['_transfer']>>>
    > {
        if (input.idempotencyKey) {
            return idempotencyService.execute(
                requestingUserId,
                input.idempotencyKey,
                async () => ({
                    statusCode: 201,
                    data: await this._transfer(input, requestingUserId),
                }),
            );
        }

        const result = {
            data: await this._transfer(input, requestingUserId),
            statusCode: 201,
            replayed: false,
        };

        auditService.log({
            userId: requestingUserId,
            action: 'TRANSACTION.TRANSFER',
            resource: 'TRANSACTION',
            resourceId: result.data?.id ?? null,
            metadata: {
                fromAccountId: input.fromAccountId,
                toAccountId: input.toAccountId,
                amount: input.amount,
                currency: input.currency ?? 'GMD',
                reference: result.data?.reference,
            },
        });

        return result;
    }

    async deposit(
        input: DepositInput,
        requestingUserId: string,
    ): Promise<
        IdempotencyResult<Awaited<ReturnType<TransactionService['_deposit']>>>
    > {
        if (input.idempotencyKey) {
            return idempotencyService.execute(
                requestingUserId,
                input.idempotencyKey,
                async () => ({
                    statusCode: 201,
                    data: await this._deposit(input, requestingUserId),
                }),
            );
        }

        const result = {
            data: await this._deposit(input, requestingUserId),
            statusCode: 201,
            replayed: false,
        };

        auditService.log({
            userId: requestingUserId,
            action: 'TRANSACTION.DEPOSIT',
            resource: 'TRANSACTION',
            resourceId: result.data?.id ?? null,
            metadata: {
                accountId: input.accountId,
                amount: input.amount,
                currency: input.currency ?? 'GMD',
                reference: result.data?.reference,
            },
        });

        return result;
    }

    async withdrawal(
        input: WithdrawalInput,
        requestingUserId: string,
    ): Promise<
        IdempotencyResult<
            Awaited<ReturnType<TransactionService['_withdrawal']>>
        >
    > {
        if (input.idempotencyKey) {
            return idempotencyService.execute(
                requestingUserId,
                input.idempotencyKey,
                async () => ({
                    statusCode: 201,
                    data: await this._withdrawal(input, requestingUserId),
                }),
            );
        }

        const result = {
            data: await this._withdrawal(input, requestingUserId),
            statusCode: 201,
            replayed: false,
        };

        auditService.log({
            userId: requestingUserId,
            action: 'TRANSACTION.WITHDRAWAL',
            resource: 'TRANSACTION',
            resourceId: result.data?.id ?? null,
            metadata: {
                accountId: input.accountId,
                amount: input.amount,
                currency: input.currency ?? 'GMD',
                reference: result.data?.reference,
            },
        });

        return result;
    }

    async getTransaction(id: string, requestingUserId: string) {
        const transaction = await transactionRepository.findById(id);
        if (!transaction) throw AppError.notFound('Transaction not found');

        // Verify the requesting user owns at least one of the involved accounts
        const accountIds = transaction.ledgerEntries.map((e) => e.accountId);
        const accounts = await Promise.all(
            accountIds.map((aid) => accountRepository.findById(aid)),
        );
        const hasAccess = accounts.some((a) => a?.userId === requestingUserId);
        if (!hasAccess) throw AppError.forbidden('Access denied');

        return transaction;
    }

    async getAccountTransactions(
        accountId: string,
        requestingUserId: string,
        page: number,
        limit: number,
    ) {
        const account = await accountRepository.findById(accountId);
        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return transactionRepository.findByAccountId(accountId, page, limit);
    }
}

export const transactionService = new TransactionService();
