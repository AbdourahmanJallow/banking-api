import prisma from '../../lib/prisma';
import { AppError } from '../../utils/AppError';

export async function getDashboardStats() {
    const [totalUsers, activeUsers, totalAccounts, totalTransactions] =
        await prisma.$transaction([
            prisma.user.count(),
            prisma.user.count({ where: { status: 'ACTIVE' } }),
            prisma.account.count(),
            prisma.transaction.count(),
        ]);

    return { totalUsers, activeUsers, totalAccounts, totalTransactions };
}

export async function listAllUsers(page = 1, limit = 20) {
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
                createdAt: true,
                _count: { select: { accounts: true } },
            },
        }),
        prisma.user.count(),
    ]);
    return { users, total };
}

export async function setUserStatus(userId: string, status: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');
    return prisma.user.update({ where: { id: userId }, data: { status } });
}

export async function getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count(),
    ]);
    return { logs, total };
}

export async function createAuditLog(
    userId: string | null,
    action: string,
    ipAddress?: string,
) {
    return prisma.auditLog.create({
        data: { userId, action, ipAddress },
    });
}
