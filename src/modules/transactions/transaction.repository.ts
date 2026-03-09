import prisma from '../../lib/prisma';
import type { PrismaTx } from '../../lib/prisma';

class TransactionRepository {
    private client(tx?: PrismaTx) {
        return tx ?? prisma;
    }

    create(
        data: {
            reference: string;
            type: string;
            amount: number;
            currency: string;
            status: string;
        },
        tx?: PrismaTx,
    ) {
        return this.client(tx).transaction.create({ data });
    }

    findById(id: string, tx?: PrismaTx) {
        return this.client(tx).transaction.findUnique({
            where: { id },
            include: { ledgerEntries: true },
        });
    }

    findByReference(reference: string) {
        return prisma.transaction.findUnique({ where: { reference } });
    }

    async findByAccountId(accountId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [transactions, total] = await prisma.$transaction([
            prisma.transaction.findMany({
                where: { ledgerEntries: { some: { accountId } } },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { ledgerEntries: { where: { accountId } } },
            }),
            prisma.transaction.count({
                where: { ledgerEntries: { some: { accountId } } },
            }),
        ]);

        return { transactions, total };
    }

    updateStatus(id: string, status: string, tx?: PrismaTx) {
        return this.client(tx).transaction.update({
            where: { id },
            data: { status },
        });
    }
}

export const transactionRepository = new TransactionRepository();
