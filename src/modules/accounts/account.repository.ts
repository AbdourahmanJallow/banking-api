import prisma from '../../lib/prisma';
import type { PrismaTx } from '../../lib/prisma';
import type {
    CreateBeneficiaryInput,
    CreateStandingOrderInput,
    AccountPreferences,
    TransactionLimits,
    CreateAlertInput,
    AccountStatement,
} from './account.types';

// ACCOUNT CORE REPOSITORY
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

class BeneficiaryRepository {
    create(accountId: string, data: CreateBeneficiaryInput, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).beneficiary.create({
            data: { accountId, ...data },
        });
    }

    findById(id: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).beneficiary.findUnique({ where: { id } });
    }

    findByAccountId(accountId: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).beneficiary.findMany({
            where: { accountId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
        });
    }

    update(id: string, data: Partial<CreateBeneficiaryInput>, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).beneficiary.update({ where: { id }, data });
    }

    softDelete(id: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).beneficiary.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}

class StandingOrderRepository {
    create(accountId: string, data: CreateStandingOrderInput, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).standingOrder.create({
            data: { fromAccountId: accountId, ...data },
        });
    }

    findById(id: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).standingOrder.findUnique({ where: { id } });
    }

    findByAccountId(accountId: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).standingOrder.findMany({
            where: { fromAccountId: accountId },
            orderBy: { createdAt: 'desc' },
        });
    }

    findActive(tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).standingOrder.findMany({
            where: { status: 'ACTIVE', nextExecutionDate: { lte: new Date() } },
        });
    }

    updateStatus(id: string, status: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).standingOrder.update({
            where: { id },
            data: { status },
        });
    }

    updateNextExecution(id: string, nextDate: Date, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).standingOrder.update({
            where: { id },
            data: { nextExecutionDate: nextDate },
        });
    }
}

class AccountPreferencesRepository {
    upsert(accountId: string, data: AccountPreferences, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountPreference.upsert({
            where: { accountId },
            update: data,
            create: { accountId, ...data },
        });
    }

    findByAccountId(accountId: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountPreference.findUnique({
            where: { accountId },
        });
    }
}

class TransactionLimitsRepository {
    upsert(accountId: string, data: TransactionLimits, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).transactionLimit.upsert({
            where: { accountId },
            update: data,
            create: { accountId, ...data },
        });
    }

    findByAccountId(accountId: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).transactionLimit.findUnique({
            where: { accountId },
        });
    }
}

class AlertRepository {
    create(accountId: string, data: CreateAlertInput, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountAlert.create({
            data: { accountId, ...data },
        });
    }

    findById(id: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountAlert.findUnique({ where: { id } });
    }

    findByAccountId(accountId: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountAlert.findMany({
            where: { accountId, enabled: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    update(id: string, data: Partial<CreateAlertInput>, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountAlert.update({ where: { id }, data });
    }

    delete(id: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountAlert.delete({ where: { id } });
    }
}

class StatementRepository {
    create(data: Omit<AccountStatement, 'id' | 'createdAt'>, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountStatement.create({
            data: data as any,
        });
    }

    findById(id: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountStatement.findUnique({ where: { id } });
    }

    findByAccountId(accountId: string, skip = 0, take = 20, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountStatement.findMany({
            where: { accountId },
            skip,
            take,
            orderBy: { periodStart: 'desc' },
        });
    }

    countByAccountId(accountId: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return (client as any).accountStatement.count({ where: { accountId } });
    }
}

export const accountRepository = new AccountRepository();
export const beneficiaryRepository = new BeneficiaryRepository();
export const standingOrderRepository = new StandingOrderRepository();
export const accountPreferencesRepository = new AccountPreferencesRepository();
export const transactionLimitsRepository = new TransactionLimitsRepository();
export const alertRepository = new AlertRepository();
export const statementRepository = new StatementRepository();
