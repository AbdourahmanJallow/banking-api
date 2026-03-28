import prisma from '../../lib/prisma';
import {
    accountRepository,
    beneficiaryRepository,
    standingOrderRepository,
    accountPreferencesRepository,
    transactionLimitsRepository,
    alertRepository,
    statementRepository,
} from './account.repository';
import {
    CreateAccountInput,
    UpdateAccountStatusInput,
    type CreateBeneficiaryInput,
    type CreateStandingOrderInput,
    type AccountPreferences,
    type TransactionLimits,
    type CreateAlertInput,
    type SpendingByCategory,
    type SpendingTrend,
    type TopMerchant,
} from './account.types';
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

    async addBeneficiary(
        accountId: string,
        input: CreateBeneficiaryInput,
        requestingUserId: string,
    ) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        // Check limit (max 10 beneficiaries)
        const count = await (prisma as any).beneficiary.count({
            where: { accountId, deletedAt: null },
        });
        if (count >= 10)
            throw AppError.badRequest(
                'Maximum 10 beneficiaries allowed',
                'BENEFICIARY_LIMIT_EXCEEDED',
            );

        const beneficiary = await prisma.$transaction(async (tx) => {
            return beneficiaryRepository.create(accountId, input, tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'BENEFICIARY.ADD',
            resource: 'BENEFICIARY',
            resourceId: beneficiary.id,
            metadata: { accountId, beneficiaryName: input.name },
        });

        return beneficiary;
    }

    async removeBeneficiary(beneficiaryId: string, requestingUserId: string) {
        const beneficiary = await beneficiaryRepository.findById(beneficiaryId);

        if (!beneficiary) throw AppError.notFound('Beneficiary not found');

        const account = await accountRepository.findById(beneficiary.accountId);
        if (account?.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        await prisma.$transaction(async (tx) => {
            await beneficiaryRepository.softDelete(beneficiaryId, tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'BENEFICIARY.REMOVE',
            resource: 'BENEFICIARY',
            resourceId: beneficiaryId,
        });
    }

    async listBeneficiaries(accountId: string, requestingUserId: string) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return beneficiaryRepository.findByAccountId(accountId);
    }

    async createStandingOrder(
        fromAccountId: string,
        input: CreateStandingOrderInput,
        requestingUserId: string,
    ) {
        const fromAccount = await accountRepository.findById(fromAccountId);

        if (!fromAccount) throw AppError.notFound('Source account not found');

        if (fromAccount.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        const toAccount = await accountRepository.findById(input.toAccountId);
        if (!toAccount)
            throw AppError.notFound('Destination account not found');

        if (input.endDate && input.endDate <= input.startDate)
            throw AppError.badRequest(
                'End date must be after start date',
                'INVALID_DATE_RANGE',
            );

        const standingOrder = await prisma.$transaction(async (tx) => {
            return standingOrderRepository.create(fromAccountId, input, tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'STANDING_ORDER.CREATE',
            resource: 'STANDING_ORDER',
            resourceId: standingOrder.id,
            metadata: {
                fromAccountId,
                toAccountId: input.toAccountId,
                amount: input.amount,
                frequency: input.frequency,
            },
        });

        return standingOrder;
    }

    async pauseStandingOrder(orderId: string, requestingUserId: string) {
        const order = await standingOrderRepository.findById(orderId);

        if (!order) throw AppError.notFound('Standing order not found');

        const account = await accountRepository.findById(order.fromAccountId);

        if (account?.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        await prisma.$transaction(async (tx) => {
            await standingOrderRepository.updateStatus(orderId, 'PAUSED', tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'STANDING_ORDER.PAUSE',
            resource: 'STANDING_ORDER',
            resourceId: orderId,
        });
    }

    async resumeStandingOrder(orderId: string, requestingUserId: string) {
        const order = await standingOrderRepository.findById(orderId);

        if (!order) throw AppError.notFound('Standing order not found');

        const account = await accountRepository.findById(order.fromAccountId);
        if (account?.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        await prisma.$transaction(async (tx) => {
            await standingOrderRepository.updateStatus(orderId, 'ACTIVE', tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'STANDING_ORDER.RESUME',
            resource: 'STANDING_ORDER',
            resourceId: orderId,
        });
    }

    async listStandingOrders(accountId: string, requestingUserId: string) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return standingOrderRepository.findByAccountId(accountId);
    }

    async updatePreferences(
        accountId: string,
        prefs: Partial<AccountPreferences>,
        requestingUserId: string,
    ) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        const updated = await prisma.$transaction(async (tx) => {
            return accountPreferencesRepository.upsert(
                accountId,
                prefs as any,
                tx,
            );
        });

        auditService.log({
            userId: requestingUserId,
            action: 'ACCOUNT.PREFERENCES_UPDATE',
            resource: 'ACCOUNT',
            resourceId: accountId,
            metadata: { changedFields: Object.keys(prefs) },
        });

        return updated;
    }

    async getPreferences(accountId: string, requestingUserId: string) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return accountPreferencesRepository.findByAccountId(accountId);
    }

    async setTransactionLimits(
        accountId: string,
        limits: TransactionLimits,
        requestingUserId: string,
    ) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        const updated = await prisma.$transaction(async (tx) => {
            return transactionLimitsRepository.upsert(accountId, limits, tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'ACCOUNT.LIMITS_UPDATE',
            resource: 'ACCOUNT',
            resourceId: accountId,
            metadata: limits,
        });

        return updated;
    }

    async getTransactionLimits(accountId: string, requestingUserId: string) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return transactionLimitsRepository.findByAccountId(accountId);
    }

    async validateTransactionAgainstLimits(
        accountId: string,
        amount: number,
    ): Promise<{ valid: boolean; reason?: string }> {
        const limits =
            await transactionLimitsRepository.findByAccountId(accountId);

        if (!limits) return { valid: true };

        if (
            limits.singleTransactionMaximum &&
            amount > limits.singleTransactionMaximum
        ) {
            return {
                valid: false,
                reason: `Exceeds single transaction maximum of ${limits.singleTransactionMaximum}`,
            };
        }

        return { valid: true };
    }

    async createAlert(
        accountId: string,
        alert: CreateAlertInput,
        requestingUserId: string,
    ) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        const created = await prisma.$transaction(async (tx) => {
            return alertRepository.create(accountId, alert, tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'ALERT.CREATE',
            resource: 'ALERT',
            resourceId: created.id,
            metadata: { type: alert.type, threshold: alert.threshold },
        });

        return created;
    }

    async disableAlert(alertId: string, requestingUserId: string) {
        const alert = await alertRepository.findById(alertId);

        if (!alert) throw AppError.notFound('Alert not found');

        const account = await accountRepository.findById(alert.accountId);

        if (account?.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        await prisma.$transaction(async (tx) => {
            await alertRepository.update(alertId, { enabled: false }, tx);
        });

        auditService.log({
            userId: requestingUserId,
            action: 'ALERT.DISABLE',
            resource: 'ALERT',
            resourceId: alertId,
        });
    }

    async listAlerts(accountId: string, requestingUserId: string) {
        const account = await accountRepository.findById(accountId);
        if (!account) throw AppError.notFound('Account not found');
        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        return alertRepository.findByAccountId(accountId);
    }

    async generateStatement(
        accountId: string,
        startDate: Date,
        endDate: Date,
        requestingUserId: string,
    ) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        if (endDate <= startDate)
            throw AppError.badRequest(
                'End date must be after start date',
                'INVALID_DATE_RANGE',
            );

        // Calculate statement data
        const transactions = await prisma.ledgerEntry.findMany({
            where: {
                accountId,
                createdAt: { gte: startDate, lte: endDate },
            },
        });

        const totalCredits = transactions
            .filter((t) => t.entryType === 'CREDIT')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalDebits = transactions
            .filter((t) => t.entryType === 'DEBIT')
            .reduce((sum, t) => sum + t.amount, 0);

        const statement = await prisma.$transaction(async (tx) => {
            return statementRepository.create(
                {
                    accountId,
                    periodStart: startDate,
                    periodEnd: endDate,
                    openingBalance:
                        account.balance - (totalCredits - totalDebits),
                    closingBalance: account.balance,
                    totalCredits,
                    totalDebits,
                    transactionCount: transactions.length,
                } as any,
                tx,
            );
        });

        auditService.log({
            userId: requestingUserId,
            action: 'STATEMENT.GENERATE',
            resource: 'STATEMENT',
            resourceId: statement.id,
            metadata: {
                accountId,
                period: { start: startDate, end: endDate },
                transactionCount: transactions.length,
            },
        });

        return statement;
    }

    async listStatements(
        accountId: string,
        requestingUserId: string,
        page = 1,
        limit = 10,
    ) {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        const skip = (page - 1) * limit;
        const [statements, total] = await Promise.all([
            statementRepository.findByAccountId(accountId, skip, limit),
            statementRepository.countByAccountId(accountId),
        ]);

        return { statements, total, page, limit };
    }

    async getSpendingByCategory(
        accountId: string,
        requestingUserId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<SpendingByCategory[]> {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        const transactions = await prisma.transaction.findMany({
            where: {
                ledgerEntries: {
                    some: {
                        accountId,
                        entryType: 'DEBIT',
                        createdAt: { gte: startDate, lte: endDate },
                    },
                },
            },
            include: { ledgerEntries: true },
        });

        const total = transactions.reduce(
            (sum, t) =>
                sum +
                t.ledgerEntries.reduce(
                    (s, e) => s + (e.entryType === 'DEBIT' ? e.amount : 0),
                    0,
                ),
            0,
        );

        const categories: Record<string, { amount: number; count: number }> =
            {};

        transactions.forEach((t) => {
            const category = t.type || 'OTHER';
            if (!categories[category])
                categories[category] = { amount: 0, count: 0 };
            categories[category].amount += t.amount;
            categories[category].count += 1;
        });

        return Object.entries(categories).map(([cat, { amount, count }]) => ({
            category: cat,
            amount,
            transactionCount: count,
            percentage: total > 0 ? (amount / total) * 100 : 0,
        }));
    }

    async getMonthlySpendingTrend(
        accountId: string,
        requestingUserId: string,
        months = 12,
    ): Promise<SpendingTrend[]> {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        const trends: SpendingTrend[] = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const monthStart = new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1,
            );
            const monthEnd = new Date(
                now.getFullYear(),
                now.getMonth() - i + 1,
                0,
                23,
                59,
                59,
            );

            const entries = await prisma.ledgerEntry.findMany({
                where: {
                    accountId,
                    entryType: 'DEBIT',
                    createdAt: { gte: monthStart, lte: monthEnd },
                },
            });

            const amount = entries.reduce((sum, e) => sum + e.amount, 0);

            trends.push({
                month: monthStart.toISOString().slice(0, 7),
                amount,
                transactionCount: entries.length,
            });
        }

        return trends;
    }

    async getTopMerchants(
        accountId: string,
        requestingUserId: string,
        limit = 5,
    ): Promise<TopMerchant[]> {
        const account = await accountRepository.findById(accountId);

        if (!account) throw AppError.notFound('Account not found');

        if (account.userId !== requestingUserId)
            throw AppError.forbidden('Access denied');

        const transactions = await prisma.transaction.findMany({
            where: {
                ledgerEntries: {
                    some: { accountId, entryType: 'DEBIT' },
                },
            },
            include: { ledgerEntries: true },
            orderBy: { amount: 'desc' },
            take: limit,
        });

        return transactions.map((t) => ({
            merchant: t.reference || 'Unknown',
            amount: t.amount,
            transactionCount: 1,
        }));
    }
}

export const accountService = new AccountService();
