import prisma from '../../lib/prisma';
import type { PrismaTx } from '../../lib/prisma';

class AccountRepository {
    private client(tx?: PrismaTx) {
        return tx ?? prisma;
    }

    create(
        userId: string,
        currency: string,
        accountNumber: string,
        tx?: PrismaTx,
    ) {
        return this.client(tx).account.create({
            data: { userId, currency, accountNumber },
        });
    }

    findById(id: string, tx?: PrismaTx) {
        return this.client(tx).account.findUnique({ where: { id } });
    }

    findByUserId(userId: string, tx?: PrismaTx) {
        return this.client(tx).account.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    findByAccountNumber(accountNumber: string, tx?: PrismaTx) {
        return this.client(tx).account.findUnique({ where: { accountNumber } });
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

    updateAllByUserId(userId: string, status: string, tx?: PrismaTx) {
        return this.client(tx).account.updateMany({
            where: { userId },
            data: { status },
        });
    }

    deleteById(id: string, tx?: PrismaTx) {
        return this.client(tx).account.delete({ where: { id } });
    }

    deleteByUserId(userId: string, tx?: PrismaTx) {
        return this.client(tx).account.deleteMany({ where: { userId } });
    }
}

export const accountRepository = new AccountRepository();
