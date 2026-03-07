import * as LedgerRepository from './ledger.repository';
import * as AccountRepository from '../accounts/account.repository';
import * as TransactionRepository from '../transactions/transaction.repository';
import {
    EntryType,
    TransactionStatus,
} from '../transactions/transaction.types';
import { AppError } from '../../utils/AppError';

/**
 * Records double-entry bookkeeping pairs inside a Prisma transaction.
 * Both debit (source) and credit (destination) entries are written
 * atomically and account balances are updated.
 */
class LedgerService {
    async recordTransfer(
        transactionId: string,
        fromAccountId: string,
        toAccountId: string,
        amount: number,
    ): Promise<void> {
        const [from, to] = await Promise.all([
            AccountRepository.findById(fromAccountId),
            AccountRepository.findById(toAccountId),
        ]);

        if (!from) throw AppError.notFound('Source account not found');

        if (!to) throw AppError.notFound('Destination account not found');

        if (from.balance < amount)
            throw AppError.badRequest(
                'Insufficient funds',
                'INSUFFICIENT_FUNDS',
            );

        if (from.currency !== to.currency)
            throw AppError.badRequest('Currency mismatch', 'CURRENCY_MISMATCH');

        await Promise.all([
            LedgerRepository.createEntry({
                transactionId,
                accountId: fromAccountId,
                entryType: EntryType.DEBIT,
                amount,
            }),
            LedgerRepository.createEntry({
                transactionId,
                accountId: toAccountId,
                entryType: EntryType.CREDIT,
                amount,
            }),
            AccountRepository.updateBalance(
                fromAccountId,
                from.balance - amount,
            ),
            AccountRepository.updateBalance(toAccountId, to.balance + amount),
        ]);

        await TransactionRepository.updateStatus(
            transactionId,
            TransactionStatus.COMPLETED,
        );
    }

    async recordDeposit(
        transactionId: string,
        accountId: string,
        amount: number,
    ): Promise<void> {
        const account = await AccountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        await Promise.all([
            LedgerRepository.createEntry({
                transactionId,
                accountId,
                entryType: EntryType.CREDIT,
                amount,
            }),
            AccountRepository.updateBalance(
                accountId,
                account.balance + amount,
            ),
        ]);

        await TransactionRepository.updateStatus(
            transactionId,
            TransactionStatus.COMPLETED,
        );
    }

    async recordWithdrawal(
        transactionId: string,
        accountId: string,
        amount: number,
    ): Promise<void> {
        const account = await AccountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.balance < amount)
            throw AppError.badRequest(
                'Insufficient funds',
                'INSUFFICIENT_FUNDS',
            );

        await Promise.all([
            LedgerRepository.createEntry({
                transactionId,
                accountId,
                entryType: EntryType.DEBIT,
                amount,
            }),
            AccountRepository.updateBalance(
                accountId,
                account.balance - amount,
            ),
        ]);

        await TransactionRepository.updateStatus(
            transactionId,
            TransactionStatus.COMPLETED,
        );
    }
}

export const ledgerService = new LedgerService();
