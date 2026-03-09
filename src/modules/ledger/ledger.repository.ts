import prisma from '../../lib/prisma';
import type { PrismaTx } from '../../lib/prisma';

class LedgerRepository {
    private client(tx?: PrismaTx) {
        return tx ?? prisma;
    }

    createEntry(
        data: {
            transactionId: string;
            accountId: string;
            entryType: string;
            amount: number;
        },
        tx?: PrismaTx,
    ) {
        return this.client(tx).ledgerEntry.create({ data });
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
