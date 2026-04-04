import { ledgerRepository } from './ledger.repository';
import { accountRepository } from '../accounts/account.repository';
import type { PrismaTx } from '../../lib/prisma';
import { EntryType } from '../transactions/transaction.types';
import { AppError, NotFoundError, BadRequestError } from '../../utils/AppError';

/**
 * Writes double-entry bookkeeping pairs inside the caller's DB transaction.
 * All methods require a `tx` (Prisma transaction client) — they must always
 * be called from within a `prisma.$transaction()` block so that ledger
 * entries and balance updates are atomic with the parent operation.
 *
 * Responsibility: financial validation (balance / currency) + ledger entries
 * + balance mutations. Setting the transaction status to COMPLETED is left
 * to the caller (TransactionService) so it controls the full unit-of-work.
 */
class LedgerService {
    async recordTransfer(
        transactionId: string,
        fromAccountId: string,
        toAccountId: string,
        amount: number,
        tx: PrismaTx,
    ): Promise<void> {
        const [from, to] = await Promise.all([
            accountRepository.findById(fromAccountId, tx),
            accountRepository.findById(toAccountId, tx),
        ]);

        if (!from) throw new NotFoundError('Source account not found');
        if (!to) throw new NotFoundError('Destination account not found');

        if (from.balance < amount)
            throw new BadRequestError(
                'Insufficient funds',
                'INSUFFICIENT_FUNDS',
            );

        if (from.currency !== to.currency)
            throw new BadRequestError('Currency mismatch', 'CURRENCY_MISMATCH');

        await Promise.all([
            ledgerRepository.createEntry(
                {
                    transactionId,
                    accountId: fromAccountId,
                    entryType: EntryType.DEBIT,
                    amount,
                },
                tx,
            ),
            ledgerRepository.createEntry(
                {
                    transactionId,
                    accountId: toAccountId,
                    entryType: EntryType.CREDIT,
                    amount,
                },
                tx,
            ),
            accountRepository.updateBalance(
                fromAccountId,
                from.balance - amount,
                tx,
            ),
            accountRepository.updateBalance(
                toAccountId,
                to.balance + amount,
                tx,
            ),
        ]);
    }

    async recordDeposit(
        transactionId: string,
        accountId: string,
        amount: number,
        tx: PrismaTx,
    ): Promise<void> {
        const account = await accountRepository.findById(accountId, tx);
        if (!account) throw new NotFoundError('Account not found');

        await Promise.all([
            ledgerRepository.createEntry(
                {
                    transactionId,
                    accountId,
                    entryType: EntryType.CREDIT,
                    amount,
                },
                tx,
            ),
            accountRepository.updateBalance(
                accountId,
                account.balance + amount,
                tx,
            ),
        ]);
    }

    async recordWithdrawal(
        transactionId: string,
        accountId: string,
        amount: number,
        tx: PrismaTx,
    ): Promise<void> {
        const account = await accountRepository.findById(accountId, tx);
        if (!account) throw new NotFoundError('Account not found');

        if (account.balance < amount)
            throw new BadRequestError(
                'Insufficient funds',
                'INSUFFICIENT_FUNDS',
            );

        await Promise.all([
            ledgerRepository.createEntry(
                {
                    transactionId,
                    accountId,
                    entryType: EntryType.DEBIT,
                    amount,
                },
                tx,
            ),
            accountRepository.updateBalance(
                accountId,
                account.balance - amount,
                tx,
            ),
        ]);
    }
}

export const ledgerService = new LedgerService();
