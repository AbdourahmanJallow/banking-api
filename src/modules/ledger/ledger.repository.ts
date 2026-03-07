import prisma from '../../lib/prisma';

export async function createEntry(data: {
    transactionId: string;
    accountId: string;
    entryType: string;
    amount: number;
}) {
    return prisma.ledgerEntry.create({ data });
}

export async function findByAccountId(accountId: string) {
    return prisma.ledgerEntry.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        include: { transaction: true },
    });
}

export async function findByTransactionId(transactionId: string) {
    return prisma.ledgerEntry.findMany({ where: { transactionId } });
}
