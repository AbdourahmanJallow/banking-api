import prisma from '../../lib/prisma';
import { accountRepository } from '../accounts/account.repository';
import { AppError, NotFoundError } from '../../utils/AppError';
import { redisService } from '../../config/redis';

interface DashboardStats {
    totalUsers: number;
    activeUsers: number;
    totalAccounts: number;
    totalTransactions: number;
    volumeToday: number;
    volumeThisMonth: number;
    pendingKYC: number;
    suspiciousTransactions: number;
}

interface TransactionFilter {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    minAmount?: number;
    maxAmount?: number;
    startDate?: Date;
    endDate?: Date;
}

interface AuditLogFilter {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
}

class AdminService {
    async getDashboardStats(): Promise<DashboardStats> {
        const now = new Date();
        const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalUsers,
            activeUsers,
            totalAccounts,
            totalTransactions,
            todayTransactions,
            monthTransactions,
            pendingKYC,
        ] = await prisma.$transaction([
            prisma.user.count(),
            prisma.user.count({ where: { status: 'ACTIVE' } }),
            prisma.account.count(),
            prisma.transaction.count(),
            prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                    createdAt: { gte: startOfToday },
                    status: 'COMPLETED',
                },
            }),
            prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                    createdAt: { gte: startOfMonth },
                    status: 'COMPLETED',
                },
            }),
            prisma.user.count({
                where: { kycStatus: 'PENDING' },
            }),
        ]);

        // Count transactions flagged as suspicious (would be from risk scoring)
        const suspiciousTransactions = await prisma.transaction.count({
            where: {
                metadata: {
                    path: ['riskScore'],
                    gte: 70, // High risk score
                },
            } as any,
        });

        return {
            totalUsers,
            activeUsers,
            totalAccounts,
            totalTransactions,
            volumeToday: todayTransactions._sum.amount || 0,
            volumeThisMonth: monthTransactions._sum.amount || 0,
            pendingKYC,
            suspiciousTransactions,
        };
    }

    async listAllUsers(page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    phone: true,
                    status: true,
                    kycStatus: true,
                    accountTier: true,
                    createdAt: true,
                    _count: { select: { accounts: true } },
                },
            }),
            prisma.user.count(),
        ]);

        return { users, total, page, limit };
    }

    async getTransactionMonitoring(filter: TransactionFilter) {
        const page = filter.page || 1;
        const limit = filter.limit || 50;
        const skip = (page - 1) * limit;

        const whereClause: any = {};

        if (filter.status) whereClause.status = filter.status;
        if (filter.type) whereClause.type = filter.type;
        if (filter.minAmount || filter.maxAmount) {
            whereClause.amount = {};
            if (filter.minAmount) whereClause.amount.gte = filter.minAmount;
            if (filter.maxAmount) whereClause.amount.lte = filter.maxAmount;
        }
        if (filter.startDate || filter.endDate) {
            whereClause.createdAt = {};
            if (filter.startDate) whereClause.createdAt.gte = filter.startDate;
            if (filter.endDate) whereClause.createdAt.lte = filter.endDate;
        }

        const [transactions, total] = await prisma.$transaction([
            prisma.transaction.findMany({
                skip,
                take: limit,
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    reference: true,
                    type: true,
                    amount: true,
                    currency: true,
                    status: true,
                    createdAt: true,
                },
            }),
            prisma.transaction.count({ where: whereClause }),
        ]);

        return { transactions, total, page, limit };
    }

    async getAuditLogs(filter: AuditLogFilter) {
        const page = filter.page || 1;
        const limit = filter.limit || 50;
        const skip = (page - 1) * limit;

        const whereClause: any = {};

        if (filter.userId) whereClause.userId = filter.userId;
        if (filter.action) whereClause.action = filter.action;
        if (filter.resource) whereClause.resource = filter.resource;
        if (filter.startDate || filter.endDate) {
            whereClause.createdAt = {};
            if (filter.startDate) whereClause.createdAt.gte = filter.startDate;
            if (filter.endDate) whereClause.createdAt.lte = filter.endDate;
        }

        const [logs, total] = await prisma.$transaction([
            prisma.auditLog.findMany({
                skip,
                take: limit,
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    userId: true,
                    action: true,
                    resource: true,
                    resourceId: true,
                    metadata: true,
                    ipAddress: true,
                    userAgent: true,
                    createdAt: true,
                },
            }),
            prisma.auditLog.count({ where: whereClause }),
        ]);

        return { logs, total, page, limit };
    }

    async getUserActivityTimeline(userId: string) {
        const userAccounts = await prisma.account.findMany({
            where: { userId },
            select: { id: true },
        });

        const accountIds = userAccounts.map((account) => account.id);

        const transactionWhere: any = {
            OR: [
                { fromAccountId: { in: accountIds } },
                { toAccountId: { in: accountIds } },
            ],
        };

        const [auditLogs, transactions] = await prisma.$transaction([
            prisma.auditLog.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    action: true,
                    resource: true,
                    metadata: true,
                    createdAt: true,
                },
            }),
            prisma.transaction.findMany({
                where: transactionWhere,
                orderBy: { createdAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    currency: true,
                    status: true,
                    reference: true,
                    createdAt: true,
                },
            }),
        ]);

        // Merge and sort by timestamp
        const combined = [
            ...auditLogs.map((log) => ({
                type: 'audit',
                action: log.action,
                resource: log.resource,
                metadata: log.metadata,
                timestamp: log.createdAt,
            })),
            ...transactions.map((tx) => ({
                type: 'transaction',
                action: `${tx.type}_TRANSACTION`,
                resource: 'TRANSACTION',
                metadata: {
                    reference: tx.reference,
                    amount: tx.amount,
                    status: tx.status,
                },
                timestamp: tx.createdAt,
            })),
        ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return combined;
    }

    async getSystemHealth() {
        const healthChecks = {
            database: 'healthy',
            redis: 'healthy',
            queue: 'healthy',
            timestamp: new Date(),
        };

        // Check database
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch (error) {
            healthChecks.database = 'unhealthy';
        }

        // Check Redis
        if (!redisService.connected) {
            healthChecks.redis = 'unhealthy';
        }

        // Queue health can be checked via job counts if needed
        return healthChecks;
    }

    async getKYCAnalytics() {
        const [pending, approved, rejected] = await prisma.$transaction([
            prisma.user.count({ where: { kycStatus: 'PENDING' } }),
            prisma.user.count({ where: { kycStatus: 'APPROVED' } }),
            prisma.user.count({ where: { kycStatus: 'REJECTED' } }),
        ]);

        // Get average tier for approved users
        const tierStats = await prisma.user.groupBy({
            by: ['accountTier'],
            where: { kycStatus: 'APPROVED' },
            _count: true,
        });

        return {
            summary: { pending, approved, rejected },
            byTier: tierStats,
        };
    }

    async setUserStatus(userId: string, status: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) throw new NotFoundError('User not found');

        const inactiveStatuses = ['INACTIVE', 'SUSPENDED'];

        return prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: userId },
                data: { status },
            });

            if (inactiveStatuses.includes(status)) {
                await accountRepository.updateAllByUserId(userId, status, tx);
            }

            return updated;
        });
    }
}

export const adminService = new AdminService();
