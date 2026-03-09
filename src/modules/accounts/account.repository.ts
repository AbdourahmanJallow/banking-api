import prisma from '../../lib/prisma';
import type { PrismaTx } from '../../lib/prisma';

class AccountRepository {
    private client(tx?: PrismaTx) {
        return tx ?? prisma;
    }

    create(userId: string, currency: string, accountNumber: string) {
        return prisma.account.create({
            data: { userId, currency, accountNumber },
        });
    }

    findById(id: string, tx?: PrismaTx) {
        return this.client(tx).account.findUnique({ where: { id } });
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

    updateStatus(id: string, status: string, tx?: PrismaTx) {
        return this.client(tx).account.update({
            where: { id },
            data: { status },
        });
    }

    updateBalance(id: string, balance: number, tx?: PrismaTx) {
        return this.client(tx).account.update({
            where: { id },
            data: { balance },
        });
    }
}

export const accountRepository = new AccountRepository();
