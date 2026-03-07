import prisma from '../../lib/prisma';

class TransactionRepository {
    create(data: {
        reference: string;
        type: string;
        amount: number;
        currency: string;
        status: string;
    }) {
        return prisma.transaction.create({ data });
    }

    findById(id: string) {
        return prisma.transaction.findUnique({
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

    updateStatus(id: string, status: string) {
        return prisma.transaction.update({ where: { id }, data: { status } });
    }
}

export const transactionRepository = new TransactionRepository();
