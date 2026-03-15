import prisma from '../../lib/prisma';
import { accountRepository } from './account.repository';
import { CreateAccountInput, UpdateAccountStatusInput } from './account.types';
import { generateAccountNumber } from '../../utils/generateAccountNumber';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

class AccountService {
    async createAccount(userId: string, input: CreateAccountInput) {
        // Generate a unique account number (retry on collision)
        let accountNumber: string;
        let attempts = 0;
        do {
            accountNumber = generateAccountNumber();

            const existing =
                await accountRepository.findByAccountNumber(accountNumber);

            if (!existing) break;

            attempts++;
        } while (attempts < 3);

        // Wrap in transaction: check user exists + create account atomically
        // This ensures a deleted user cannot have orphaned accounts.
        const account = await prisma.$transaction(async (tx) => {
            // Verify user exists within the transaction
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (!user) throw AppError.notFound('User not found');

            return accountRepository.create(
                userId,
                input.currency,
                accountNumber!,
                tx,
            );
        });

        auditService.log({
            userId,
            action: 'ACCOUNT.CREATE',
            resource: 'ACCOUNT',
            resourceId: account.id,
            metadata: {
                accountNumber: account.accountNumber,
                currency: account.currency,
            },
        });

        return account;
    }

    async getAccount(accountId: string, requestingUserId: string) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return account;
    }

    async getUserAccounts(userId: string) {
        return accountRepository.findByUserId(userId);
    }

    async getAccountStats(userId: string) {
        const accounts = await accountRepository.findByUserId(userId);

        const stats = {
            totalAccounts: accounts.length,
            activeAccounts: accounts.filter((a) => a.status === 'ACTIVE')
                .length,
            totalBalance: accounts.reduce((sum, a) => sum + a.balance, 0),
            balanceByStatus: {
                active: accounts
                    .filter((a) => a.status === 'ACTIVE')
                    .reduce((sum, a) => sum + a.balance, 0),
                inactive: accounts
                    .filter((a) => a.status === 'INACTIVE')
                    .reduce((sum, a) => sum + a.balance, 0),
                frozen: accounts
                    .filter((a) => a.status === 'FROZEN')
                    .reduce((sum, a) => sum + a.balance, 0),
            },
        };

        return stats;
    }

    async updateAccountStatus(
        accountId: string,
        input: UpdateAccountStatusInput,
        requestingUserId: string,
    ) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        // Wrap in transaction to ensure consistent state
        const updated = await prisma.$transaction(async (tx) => {
            return accountRepository.updateStatus(accountId, input.status, tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'ACCOUNT.STATUS_UPDATE',
            resource: 'ACCOUNT',
            resourceId: accountId,
            metadata: {
                previousStatus: account.status,
                newStatus: input.status,
            },
        });

        return updated;
    }

    async deleteAccount(
        accountId: string,
        requestingUserId: string,
    ): Promise<void> {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        if (account.balance > 0)
            throw AppError.badRequest(
                'Cannot delete account with non-zero balance',
                'NON_ZERO_BALANCE',
            );

        // Wrap in transaction: delete cascading ledger entries + account
        await prisma.$transaction(async (tx) => {
            // Delete associated ledger entries first
            await tx.ledgerEntry.deleteMany({
                where: {
                    account: { id: accountId },
                },
            });

            // Then delete the account
            await accountRepository.deleteById(accountId, tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'ACCOUNT.DELETE',
            resource: 'ACCOUNT',
            resourceId: accountId,
            metadata: {
                accountNumber: account.accountNumber,
                currency: account.currency,
                finalBalance: account.balance,
            },
        });
    }

    async deleteAllUserAccounts(userId: string): Promise<void> {
        const accounts = await accountRepository.findByUserId(userId);

        if (accounts.length === 0) return;

        // Verify all accounts have zero balance
        const nonZero = accounts.filter((a) => a.balance > 0);
        if (nonZero.length > 0) {
            throw AppError.badRequest(
                `Cannot delete accounts with balances: ${nonZero.map((a) => a.accountNumber).join(', ')}`,
                'NON_ZERO_BALANCE',
            );
        }

        // Wrap in transaction: delete all ledger entries + all accounts
        await prisma.$transaction(async (tx) => {
            const accountIds = accounts.map((a) => a.id);

            // Delete ledger entries for all user accounts
            await tx.ledgerEntry.deleteMany({
                where: {
                    accountId: { in: accountIds },
                },
            });

            // Delete all user accounts
            await accountRepository.deleteByUserId(userId, tx);
        });

        auditService.log({
            userId,
            action: 'ACCOUNT.DELETE_ALL_USER_ACCOUNTS',
            resource: 'ACCOUNT',
            metadata: {
                accountsDeleted: accounts.length,
                accountNumbers: accounts.map((a) => a.accountNumber),
            },
        });
    }
}

export const accountService = new AccountService();
