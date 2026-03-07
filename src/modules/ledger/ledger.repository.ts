import prisma from '../../lib/prisma';

class LedgerRepository {
    createEntry(data: {
        transactionId: string;
        accountId: string;
        entryType: string;
        amount: number;
    }) {
        return prisma.ledgerEntry.create({ data });
    }

    findByAccountId(accountId: string) {
        return prisma.ledgerEntry.findMany({
            where: { accountId },
            orderBy: { createdAt: 'desc' },
            include: { transaction: true },
        });
    }

    findByTransactionId(transactionId: string) {
        return prisma.ledgerEntry.findMany({ where: { transactionId } });
    }
}

export const ledgerRepository = new LedgerRepository();
