import { randomUUID } from 'crypto';
import { transactionRepository } from './transaction.repository';
import { accountRepository } from '../accounts/account.repository';
import { ledgerService } from '../ledger/ledger.service';
import {
    TransferInput,
    DepositInput,
    WithdrawalInput,
    TransactionType,
    TransactionStatus,
} from './transaction.types';
import { AppError } from '../../utils/AppError';

class TransactionService {
    private generateReference(): string {
        return `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    }

    async transfer(input: TransferInput, requestingUserId: string) {
        const { fromAccountId, toAccountId, amount, currency, idempotencyKey } =
            input;

        const fromAccount = await accountRepository.findById(fromAccountId);

        if (!fromAccount) throw AppError.notFound('Source account not found');

        if (fromAccount.userId !== requestingUserId)
            throw AppError.forbidden('Access denied to source account');

        if (fromAccount.status !== 'ACTIVE')
            throw AppError.badRequest('Source account is not active');

        if (fromAccountId === toAccountId)
            throw AppError.badRequest('Cannot transfer to the same account');

        const transaction = await transactionRepository.create({
            reference: this.generateReference(),
            type: TransactionType.TRANSFER,
            amount: amount,
            currency: currency,
            status: TransactionStatus.PENDING,
        });

        await ledgerService.recordTransfer(
            transaction.id,
            fromAccountId,
            toAccountId,
            amount,
        );

        return transactionRepository.findById(transaction.id);
    }

    async deposit(input: DepositInput) {
        const { accountId, amount, currency } = input;

        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.status !== 'ACTIVE')
            throw AppError.badRequest('Account is not active');

        const transaction = await transactionRepository.create({
            reference: this.generateReference(),
            type: TransactionType.DEPOSIT,
            amount: amount,
            currency: currency,
            status: TransactionStatus.PENDING,
        });

        await ledgerService.recordDeposit(transaction.id, accountId, amount);
        return transactionRepository.findById(transaction.id);
    }

    async withdrawal(input: WithdrawalInput, requestingUserId: string) {
        const { accountId, amount, currency } = input;

        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        if (account.status !== 'ACTIVE')
            throw AppError.badRequest('Account is not active');

        const transaction = await transactionRepository.create({
            reference: this.generateReference(),
            type: TransactionType.WITHDRAWAL,
            amount: amount,
            currency: currency,
            status: TransactionStatus.PENDING,
        });

        await ledgerService.recordWithdrawal(transaction.id, accountId, amount);

        return transactionRepository.findById(transaction.id);
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
