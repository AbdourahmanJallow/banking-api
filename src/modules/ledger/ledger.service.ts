import { ledgerRepository } from './ledger.repository';
import { accountRepository } from '../accounts/account.repository';
import { transactionRepository } from '../transactions/transaction.repository';
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
            accountRepository.findById(fromAccountId),
            accountRepository.findById(toAccountId),
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
            ledgerRepository.createEntry({
                transactionId,
                accountId: fromAccountId,
                entryType: EntryType.DEBIT,
                amount,
            }),
            ledgerRepository.createEntry({
                transactionId,
                accountId: toAccountId,
                entryType: EntryType.CREDIT,
                amount,
            }),
            accountRepository.updateBalance(
                fromAccountId,
                from.balance - amount,
            ),
            accountRepository.updateBalance(toAccountId, to.balance + amount),
        ]);

        await transactionRepository.updateStatus(
            transactionId,
            TransactionStatus.COMPLETED,
        );
    }

    async recordDeposit(
        transactionId: string,
        accountId: string,
        amount: number,
    ): Promise<void> {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        await Promise.all([
            ledgerRepository.createEntry({
                transactionId,
                accountId,
                entryType: EntryType.CREDIT,
                amount,
            }),
            accountRepository.updateBalance(
                accountId,
                account.balance + amount,
            ),
        ]);

        await transactionRepository.updateStatus(
            transactionId,
            TransactionStatus.COMPLETED,
        );
    }

    async recordWithdrawal(
        transactionId: string,
        accountId: string,
        amount: number,
    ): Promise<void> {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.balance < amount)
            throw AppError.badRequest(
                'Insufficient funds',
                'INSUFFICIENT_FUNDS',
            );

        await Promise.all([
            ledgerRepository.createEntry({
                transactionId,
                accountId,
                entryType: EntryType.DEBIT,
                amount,
            }),
            accountRepository.updateBalance(
                accountId,
                account.balance - amount,
            ),
        ]);

        await transactionRepository.updateStatus(
            transactionId,
            TransactionStatus.COMPLETED,
        );
    }
}

export const ledgerService = new LedgerService();
