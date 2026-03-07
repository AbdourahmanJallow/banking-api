import { randomUUID } from 'crypto';
import * as TransactionRepository from './transaction.repository';
import * as AccountRepository from '../accounts/account.repository';
import * as LedgerService from '../ledger/ledger.service';
import {
    TransferInput,
    DepositInput,
    WithdrawalInput,
    TransactionType,
    TransactionStatus,
} from './transaction.types';
import { AppError } from '../../utils/AppError';

function generateReference(): string {
    return `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function transfer(input: TransferInput, requestingUserId: string) {
    const fromAccount = await AccountRepository.findById(input.fromAccountId);
    if (!fromAccount) throw AppError.notFound('Source account not found');
    if (fromAccount.userId !== requestingUserId)
        throw AppError.forbidden('Access denied to source account');
    if (fromAccount.status !== 'ACTIVE')
        throw AppError.badRequest('Source account is not active');
    if (input.fromAccountId === input.toAccountId)
        throw AppError.badRequest('Cannot transfer to the same account');

    const transaction = await TransactionRepository.create({
        reference: generateReference(),
        type: TransactionType.TRANSFER,
        amount: input.amount,
        currency: input.currency,
        status: TransactionStatus.PENDING,
    });

    await LedgerService.recordTransfer(
        transaction.id,
        input.fromAccountId,
        input.toAccountId,
        input.amount,
    );

    return TransactionRepository.findById(transaction.id);
}

export async function deposit(input: DepositInput) {
    const account = await AccountRepository.findById(input.accountId);
    if (!account) throw AppError.notFound('Account not found');
    if (account.status !== 'ACTIVE')
        throw AppError.badRequest('Account is not active');

    const transaction = await TransactionRepository.create({
        reference: generateReference(),
        type: TransactionType.DEPOSIT,
        amount: input.amount,
        currency: input.currency,
        status: TransactionStatus.PENDING,
    });

    await LedgerService.recordDeposit(
        transaction.id,
        input.accountId,
        input.amount,
    );
    return TransactionRepository.findById(transaction.id);
}

export async function withdrawal(
    input: WithdrawalInput,
    requestingUserId: string,
) {
    const account = await AccountRepository.findById(input.accountId);
    if (!account) throw AppError.notFound('Account not found');
    if (account.userId !== requestingUserId)
        throw AppError.forbidden('Access denied');
    if (account.status !== 'ACTIVE')
        throw AppError.badRequest('Account is not active');

    const transaction = await TransactionRepository.create({
        reference: generateReference(),
        type: TransactionType.WITHDRAWAL,
        amount: input.amount,
        currency: input.currency,
        status: TransactionStatus.PENDING,
    });

    await LedgerService.recordWithdrawal(
        transaction.id,
        input.accountId,
        input.amount,
    );
    return TransactionRepository.findById(transaction.id);
}

export async function getTransaction(id: string, requestingUserId: string) {
    const transaction = await TransactionRepository.findById(id);
    if (!transaction) throw AppError.notFound('Transaction not found');

    // Verify the requesting user owns at least one of the involved accounts
    const accountIds = transaction.ledgerEntries.map((e) => e.accountId);
    const accounts = await Promise.all(
        accountIds.map((aid) => AccountRepository.findById(aid)),
    );
    const hasAccess = accounts.some((a) => a?.userId === requestingUserId);
    if (!hasAccess) throw AppError.forbidden('Access denied');

    return transaction;
}

export async function getAccountTransactions(
    accountId: string,
    requestingUserId: string,
    page: number,
    limit: number,
) {
    const account = await AccountRepository.findById(accountId);
    if (!account) throw AppError.notFound('Account not found');
    if (account.userId !== requestingUserId)
        throw AppError.forbidden('Access denied');

    return TransactionRepository.findByAccountId(accountId, page, limit);
}
