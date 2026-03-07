import prisma from '../../lib/prisma';

export async function create(
    userId: string,
    currency: string,
    accountNumber: string,
) {
    return prisma.account.create({
        data: { userId, currency, accountNumber },
    });
}

export async function findById(id: string) {
    return prisma.account.findUnique({ where: { id } });
}

export async function findByUserId(userId: string) {
    return prisma.account.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
}

export async function findByAccountNumber(accountNumber: string) {
    return prisma.account.findUnique({ where: { accountNumber } });
}

export async function updateStatus(id: string, status: string) {
    return prisma.account.update({ where: { id }, data: { status } });
}

export async function updateBalance(id: string, balance: number) {
    return prisma.account.update({ where: { id }, data: { balance } });
}
