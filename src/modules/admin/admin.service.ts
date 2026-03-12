import prisma from '../../lib/prisma';
import { accountRepository } from '../accounts/account.repository';
import { AppError } from '../../utils/AppError';

class AdminService {
    async getDashboardStats() {
        const [totalUsers, activeUsers, totalAccounts, totalTransactions] =
            await prisma.$transaction([
                prisma.user.count(),
                prisma.user.count({ where: { status: 'ACTIVE' } }),
                prisma.account.count(),
                prisma.transaction.count(),
            ]);

        return { totalUsers, activeUsers, totalAccounts, totalTransactions };
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
                    createdAt: true,
                    _count: { select: { accounts: true } },
                },
            }),
            prisma.user.count(),
        ]);

        return { users, total };
    }

    async setUserStatus(userId: string, status: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) throw AppError.notFound('User not found');

        // If the user is being suspended or deactivated, atomically apply the
        // same status to all their accounts so no account stays ACTIVE while
        // the owning user is restricted.
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
