/**
 * Unit tests for account.service.ts
 * All external dependencies (AccountRepository, generateAccountNumber) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
    },
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
    auditService: { log: vi.fn() },
}));

vi.mock('../../src/utils/generateAccountNumber', () => ({
    generateAccountNumber: vi.fn().mockReturnValue('ACC1234567890'),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import prisma from '../../src/lib/prisma';
import { accountRepository } from '../../src/modules/accounts/account.repository';
import { generateAccountNumber } from '../../src/utils/generateAccountNumber';
import { accountService } from '../../src/modules/accounts/account.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── createAccount ─────────────────────────────────────────────────────────────

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

// ── getAccount ────────────────────────────────────────────────────────────────

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

// ── getUserAccounts ───────────────────────────────────────────────────────────

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

// ── updateAccountStatus ───────────────────────────────────────────────────────

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
