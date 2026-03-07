import prisma from '../../lib/prisma';

class AccountRepository {
    create(userId: string, currency: string, accountNumber: string) {
        return prisma.account.create({
            data: { userId, currency, accountNumber },
        });
    }

    findById(id: string) {
        return prisma.account.findUnique({ where: { id } });
    }

    findByUserId(userId: string) {
        return prisma.account.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    findByAccountNumber(accountNumber: string) {
        return prisma.account.findUnique({ where: { accountNumber } });
    }

    updateStatus(id: string, status: string) {
        return prisma.account.update({ where: { id }, data: { status } });
    }

    updateBalance(id: string, balance: number) {
        return prisma.account.update({ where: { id }, data: { balance } });
    }
}

export const accountRepository = new AccountRepository();
