/**
 * Unit tests for account.service.ts
 * All external dependencies (AccountRepository, generateAccountNumber) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertType, Frequency } from '../../src/modules/accounts/account.types';

// Mocks

vi.mock('../../src/lib/prisma', () => ({
    default: {
        $transaction: vi
            .fn()
            .mockImplementation((callback: (tx: any) => Promise<any>) =>
                Promise.resolve(
                    callback({
                        user: {
                            findUnique: vi.fn().mockResolvedValue(null),
                        },
                        account: {
                            findUnique: vi.fn().mockResolvedValue(null),
                            update: vi.fn().mockResolvedValue(null),
                            deleteMany: vi.fn().mockResolvedValue(null),
                        },
                        ledgerEntry: {
                            deleteMany: vi.fn().mockResolvedValue(null),
                        },
                    }),
                ).then((p) => p),
            ),
        beneficiary: {
            count: vi.fn().mockResolvedValue(5),
        },
        standingOrder: {
            count: vi.fn().mockResolvedValue(3),
        },
    },
}));

vi.mock('../../src/modules/accounts/account.repository', () => ({
    accountRepository: {
        create: vi.fn(),
        findById: vi.fn(),
        findByUserId: vi.fn(),
        findByAccountNumber: vi.fn(),
        updateStatus: vi.fn(),
        updateBalance: vi.fn(),
        deleteById: vi.fn(),
        deleteByUserId: vi.fn(),
        updateAllByUserId: vi.fn(),
    },
    beneficiaryRepository: {
        create: vi.fn(),
        findById: vi.fn(),
        findByAccountId: vi.fn(),
        deleteById: vi.fn(),
        softDelete: vi.fn(),
    },
    standingOrderRepository: {
        create: vi.fn(),
        findById: vi.fn(),
        findByAccountId: vi.fn(),
        updateStatus: vi.fn(),
    },
    accountPreferencesRepository: {
        upsert: vi.fn(),
        findByAccountId: vi.fn(),
    },
    transactionLimitsRepository: {
        upsert: vi.fn(),
        findByAccountId: vi.fn(),
    },
    alertRepository: {
        create: vi.fn(),
        findById: vi.fn(),
        findByAccountId: vi.fn(),
        update: vi.fn(),
    },
    statementRepository: {
        create: vi.fn(),
        findByAccountId: vi.fn(),
    },
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
    auditService: { log: vi.fn() },
}));

vi.mock('../../src/utils/generateAccountNumber', () => ({
    generateAccountNumber: vi.fn().mockReturnValue('ACC1234567890'),
}));

// Imports (after mocks)

import prisma from '../../src/lib/prisma';
import {
    accountRepository,
    beneficiaryRepository,
    standingOrderRepository,
    accountPreferencesRepository,
    transactionLimitsRepository,
    alertRepository,
    statementRepository,
} from '../../src/modules/accounts/account.repository';
import { generateAccountNumber } from '../../src/utils/generateAccountNumber';
import { accountService } from '../../src/modules/accounts/account.service';

// Helpers

const mockAccount = {
    id: 'account-id-123',
    userId: 'user-id-123',
    accountNumber: 'ACC1234567890',
    currency: 'GMD',
    balance: 0,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
};

// createAccount

describe('accountService.createAccount', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates an account with a generated account number', async () => {
        const mockUser = { id: 'user-id-123', status: 'ACTIVE' };
        vi.mocked(prisma.$transaction).mockImplementation(
            async (callback: (tx: any) => Promise<any>) => {
                const mockTx = {
                    user: {
                        findUnique: vi.fn().mockResolvedValue(mockUser),
                    },
                    account: {
                        create: vi.fn().mockResolvedValue(mockAccount),
                    },
                };
                return callback(mockTx);
            },
        );
        vi.mocked(accountRepository.findByAccountNumber).mockResolvedValue(
            null,
        );
        vi.mocked(accountRepository.create).mockResolvedValue(
            mockAccount as any,
        );

        const result = await accountService.createAccount('user-id-123', {
            currency: 'GMD',
        });

        expect(generateAccountNumber).toHaveBeenCalledOnce();
        expect(accountRepository.create).toHaveBeenCalledWith(
            'user-id-123',
            'GMD',
            'ACC1234567890',
            expect.anything(), // tx parameter
        );
        expect(result.currency).toBe('GMD');
    });

    it('retries when generated account number already exists', async () => {
        const mockUser = { id: 'user-id-123', status: 'ACTIVE' };
        vi.mocked(prisma.$transaction).mockImplementation(
            async (callback: (tx: any) => Promise<any>) => {
                const mockTx = {
                    user: {
                        findUnique: vi.fn().mockResolvedValue(mockUser),
                    },
                    account: {
                        create: vi.fn().mockResolvedValue(mockAccount),
                    },
                };
                return callback(mockTx);
            },
        );
        vi.mocked(accountRepository.findByAccountNumber)
            .mockResolvedValueOnce(mockAccount as any) // first number taken
            .mockResolvedValueOnce(null); // second is free
        vi.mocked(accountRepository.create).mockResolvedValue(
            mockAccount as any,
        );

        await accountService.createAccount('user-id-123', { currency: 'GMD' });

        expect(accountRepository.findByAccountNumber).toHaveBeenCalledTimes(2);
        expect(accountRepository.create).toHaveBeenCalledOnce();
    });
});

// getAccount

describe('accountService.getAccount', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns the account for the owning user', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );

        const result = await accountService.getAccount(
            'account-id-123',
            'user-id-123',
        );

        expect(result.id).toBe('account-id-123');
    });

    it('throws 404 when account does not exist', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(null);

        await expect(
            accountService.getAccount('missing-id', 'user-id-123'),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when requesting user does not own the account', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );

        await expect(
            accountService.getAccount('account-id-123', 'other-user'),
        ).rejects.toMatchObject({ statusCode: 403 });
    });
});

// getUserAccounts

describe('accountService.getUserAccounts', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns all accounts for the user', async () => {
        vi.mocked(accountRepository.findByUserId).mockResolvedValue([
            mockAccount,
        ] as any);

        const result = await accountService.getUserAccounts('user-id-123');

        expect(accountRepository.findByUserId).toHaveBeenCalledWith(
            'user-id-123',
        );
        expect(result).toHaveLength(1);
    });

    it('returns empty array when user has no accounts', async () => {
        vi.mocked(accountRepository.findByUserId).mockResolvedValue([]);

        const result = await accountService.getUserAccounts('user-id-123');

        expect(result).toHaveLength(0);
    });
});

// updateAccountStatus

describe('accountService.updateAccountStatus', () => {
    beforeEach(() => vi.clearAllMocks());

    it('updates the status for the owning user', async () => {
        const updated = { ...mockAccount, status: 'FROZEN' };
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(accountRepository.updateStatus).mockResolvedValue(
            updated as any,
        );
        vi.mocked(prisma.$transaction).mockImplementation(
            async (callback: (tx: any) => Promise<any>) => {
                const mockTx = {
                    account: {
                        update: vi.fn().mockResolvedValue(updated),
                    },
                };
                return callback(mockTx);
            },
        );

        const result = await accountService.updateAccountStatus(
            'account-id-123',
            { status: 'FROZEN' },
            'user-id-123',
        );

        expect(accountRepository.updateStatus).toHaveBeenCalledWith(
            'account-id-123',
            'FROZEN',
            expect.anything(), // tx parameter
        );
        expect(result.status).toBe('FROZEN');
    });

    it('throws 404 when account does not exist', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(null);

        await expect(
            accountService.updateAccountStatus(
                'missing-id',
                { status: 'ACTIVE' },
                'user-id-123',
            ),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when requesting user does not own the account', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );

        await expect(
            accountService.updateAccountStatus(
                'account-id-123',
                { status: 'ACTIVE' },
                'other-user',
            ),
        ).rejects.toMatchObject({ statusCode: 403 });
    });
});

// Beneficiaries

describe('accountService - Beneficiaries', () => {
    beforeEach(() => vi.clearAllMocks());

    const mockBeneficiary = {
        id: 'beneficiary-123',
        accountId: 'account-123',
        bankName: 'Bank ABC',
        accountNumber: 'ACCT001',
        accountHolderName: 'John Doe',
        relationship: 'Friend',
        createdAt: new Date(),
    };

    it('addBeneficiary creates a new beneficiary for account', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(beneficiaryRepository.create).mockResolvedValue(
            mockBeneficiary as any,
        );

        const result = await accountService.addBeneficiary(
            'account-id-123',
            {
                name: 'John Doe',
                accountNumber: 'ACCT001',
                bankCode: 'BANK_ABC',
            },
            'user-id-123',
        );

        expect(beneficiaryRepository.create).toHaveBeenCalled();
        expect(result.accountHolderName).toBe('John Doe');
    });

    it('removeBeneficiary deletes beneficiary if user owns account', async () => {
        vi.mocked(beneficiaryRepository.findById).mockResolvedValue(
            mockBeneficiary as any,
        );
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(beneficiaryRepository.softDelete).mockResolvedValue(
            undefined,
        );

        await accountService.removeBeneficiary(
            'beneficiary-123',
            'user-id-123',
        );

        expect(beneficiaryRepository.softDelete).toHaveBeenCalled();
    });

    it('listBeneficiaries returns all beneficiaries for account', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(beneficiaryRepository.findByAccountId).mockResolvedValue([
            mockBeneficiary,
        ] as any);

        const result = await accountService.listBeneficiaries(
            'account-id-123',
            'user-id-123',
        );

        expect(result).toHaveLength(1);
        expect(result[0].accountHolderName).toBe('John Doe');
    });
});

// Standing Orders

describe('accountService - Standing Orders', () => {
    beforeEach(() => vi.clearAllMocks());

    const mockStandingOrder = {
        id: 'order-123',
        fromAccountId: 'account-123',
        toAccountId: 'account-456',
        amount: 1000,
        frequency: Frequency.MONTHLY,
        startDate: new Date(),
        endDate: null,
        status: 'ACTIVE',
        createdAt: new Date(),
    };

    it('createStandingOrder schedules recurring transfer', async () => {
        const destinationAccount = { ...mockAccount, id: 'account-456' };
        vi.mocked(accountRepository.findById)
            .mockResolvedValueOnce(mockAccount as any)
            .mockResolvedValueOnce(destinationAccount as any);
        vi.mocked(standingOrderRepository.create).mockResolvedValue(
            mockStandingOrder as any,
        );

        const result = await accountService.createStandingOrder(
            'account-id-123',
            {
                toAccountId: 'account-456',
                amount: 1000,
                frequency: Frequency.MONTHLY,
                startDate: new Date(),
            },
            'user-id-123',
        );

        expect(standingOrderRepository.create).toHaveBeenCalled();
        expect(result.status).toBe('ACTIVE');
    });

    it('pauseStandingOrder pauses active order', async () => {
        vi.mocked(standingOrderRepository.findById).mockResolvedValue(
            mockStandingOrder as any,
        );
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );

        await accountService.pauseStandingOrder('order-123', 'user-id-123');

        expect(standingOrderRepository.updateStatus).toHaveBeenCalledWith(
            'order-123',
            'PAUSED',
            expect.any(Object),
        );
    });

    it('resumeStandingOrder resumes paused order', async () => {
        const pausedOrder = { ...mockStandingOrder, status: 'PAUSED' };
        vi.mocked(standingOrderRepository.findById).mockResolvedValue(
            pausedOrder as any,
        );
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );

        await accountService.resumeStandingOrder('order-123', 'user-id-123');

        expect(standingOrderRepository.updateStatus).toHaveBeenCalledWith(
            'order-123',
            'ACTIVE',
            expect.any(Object),
        );
    });

    it('listStandingOrders returns all orders for account', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(standingOrderRepository.findByAccountId).mockResolvedValue([
            mockStandingOrder,
        ] as any);

        const result = await accountService.listStandingOrders(
            'account-id-123',
            'user-id-123',
        );

        expect(result).toHaveLength(1);
        expect(result[0].frequency).toBe('MONTHLY');
    });
});

// Account Preferences

describe('accountService - Preferences', () => {
    beforeEach(() => vi.clearAllMocks());

    const mockPreferences = {
        id: 'pref-123',
        accountId: 'account-123',
        displayName: 'My Main Account',
        notificationsEnabled: true,
        statementDelivery: 'EMAIL',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    it('updatePreferences saves account preferences', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(accountPreferencesRepository.upsert).mockResolvedValue(
            mockPreferences as any,
        );

        const result = await accountService.updatePreferences(
            'account-id-123',
            {
                notificationsEnabled: true,
                statementFrequency: 'MONTHLY',
                cardlessWithdrawalAllowed: true,
            },
            'user-id-123',
        );

        expect(accountPreferencesRepository.upsert).toHaveBeenCalled();
        expect(result.displayName).toBe('My Main Account');
    });

    it('getPreferences retrieves preferences for account', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(
            accountPreferencesRepository.findByAccountId,
        ).mockResolvedValue(mockPreferences as any);

        const result = await accountService.getPreferences(
            'account-id-123',
            'user-id-123',
        );

        expect(result.notificationsEnabled).toBe(true);
        expect(result.statementDelivery).toBe('EMAIL');
    });
});

// Transaction Limits

describe('accountService - Transaction Limits', () => {
    beforeEach(() => vi.clearAllMocks());

    const mockLimits = {
        id: 'limits-123',
        accountId: 'account-123',
        dailyLimit: 10000,
        singleTransactionMaximum: 5000,
        monthlyLimit: 100000,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    it('setTransactionLimits updates limits for account', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(transactionLimitsRepository.upsert).mockResolvedValue(
            mockLimits as any,
        );

        const result = await accountService.setTransactionLimits(
            'account-id-123',
            {
                dailyTransactionLimit: 10000,
                singleTransactionMaximum: 5000,
            },
            'user-id-123',
        );

        expect(transactionLimitsRepository.upsert).toHaveBeenCalled();
        expect(result.dailyLimit).toBe(10000);
    });

    it('getTransactionLimits retrieves limits for account', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(
            transactionLimitsRepository.findByAccountId,
        ).mockResolvedValue(mockLimits as any);

        const result = await accountService.getTransactionLimits(
            'account-id-123',
            'user-id-123',
        );

        expect(result.singleTransactionMaximum).toBe(5000);
    });

    it('validateTransactionAgainstLimits throws if exceeds limits', async () => {
        vi.mocked(
            transactionLimitsRepository.findByAccountId,
        ).mockResolvedValue(mockLimits as any);

        const result = await accountService.validateTransactionAgainstLimits(
            'account-id-123',
            6000, // exceeds transaction limit
        );

        expect(result.valid).toBe(false);
    });

    it('validateTransactionAgainstLimits passes if within limits', async () => {
        vi.mocked(
            transactionLimitsRepository.findByAccountId,
        ).mockResolvedValue(mockLimits as any);

        const result = await accountService.validateTransactionAgainstLimits(
            'account-id-123',
            4500, // within transaction limit
        );

        expect(result.valid).toBe(true);
    });
});

// Alerts

describe('accountService - Alerts', () => {
    beforeEach(() => vi.clearAllMocks());

    const mockAlert = {
        id: 'alert-123',
        accountId: 'account-123',
        alertType: AlertType.LARGE_DEBIT,
        threshold: 50000,
        isActive: true,
        createdAt: new Date(),
    };

    it('createAlert creates transaction alert', async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(alertRepository.create).mockResolvedValue(mockAlert as any);

        const result = await accountService.createAlert(
            'account-id-123',
            {
                type: AlertType.LARGE_DEBIT,
                threshold: 50000,
                enabled: true,
            },
            'user-id-123',
        );

        expect(alertRepository.create).toHaveBeenCalled();
        expect(result.isActive).toBe(true);
    });

    it('disableAlert disables alert for account', async () => {
        vi.mocked(alertRepository.findById).mockResolvedValue(mockAlert as any);
        vi.mocked(accountRepository.findById).mockResolvedValue(
            mockAccount as any,
        );
        vi.mocked(alertRepository.update).mockResolvedValue(undefined);

        await accountService.disableAlert('alert-123', 'user-id-123');

        expect(alertRepository.update).toHaveBeenCalled();
    });
});
