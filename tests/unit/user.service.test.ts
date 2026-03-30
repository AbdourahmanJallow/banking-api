/**
 * Unit tests for user.service.ts
 * Tests email verification, password reset, 2FA/TOTP, account lockout, and KYC features
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/lib/prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
        },
        $transaction: vi
            .fn()
            .mockImplementation((callback: (tx: any) => Promise<any>) =>
                Promise.resolve(
                    callback({
                        account: {
                            updateMany: vi.fn().mockResolvedValue({}),
                        },
                    }),
                ),
            ),
    },
}));

vi.mock('../../src/modules/users/user.repository', () => ({
    userRepository: {
        findById: vi.fn(),
        findByEmail: vi.fn(),
        findByEmailVerificationToken: vi.fn(),
        findByPasswordResetToken: vi.fn(),
        update: vi.fn(),
        updatePassword: vi.fn(),
        setEmailVerificationToken: vi.fn(),
        verifyEmail: vi.fn(),
        setPasswordResetToken: vi.fn(),
        setTOTPSecret: vi.fn(),
        enableTOTP: vi.fn(),
        disableTOTP: vi.fn(),
        incrementFailedAttempts: vi.fn(),
        lockAccount: vi.fn(),
        unlockAccount: vi.fn(),
        submitKYC: vi.fn(),
        approveKYC: vi.fn(),
        rejectKYC: vi.fn(),
        deactivate: vi.fn(),
        findAll: vi.fn(),
    },
}));

vi.mock('../../src/modules/accounts/account.repository', () => ({
    accountRepository: {
        updateAllByUserId: vi.fn(),
    },
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
    auditService: { log: vi.fn() },
}));

vi.mock('speakeasy', () => ({
    default: {
        generateSecret: vi.fn().mockReturnValue({
            base32: 'JBSWY3DPEBLW64TMMQ======',
            otpauth_url: 'otpauth://totp/test',
        }),
        totp: {
            verify: vi.fn(),
        },
    },
}));

vi.mock('qrcode', () => ({
    default: {
        toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,...'),
    },
}));

vi.mock('bcrypt', () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn(),
    },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import prisma from '../../src/lib/prisma';
import { userRepository } from '../../src/modules/users/user.repository';
import { accountRepository } from '../../src/modules/accounts/account.repository';
import { auditService } from '../../src/modules/audit/audit.service';
import { userService } from '../../src/modules/users/user.service';
import { AppError } from '../../src/utils/AppError';

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    phone: '1234567890',
    status: 'ACTIVE',
    passwordHash: 'hashed_password_123',
    emailVerified: false,
    emailVerificationToken: null,
    emailVerificationExpiry: null,
    passwordResetToken: null,
    passwordResetExpiry: null,
    totpSecret: null,
    totpEnabled: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    dateOfBirth: new Date('1990-01-01'),
    nationalId: 'NAT123456',
    idType: 'NATIONAL_ID',
    address: '123 Main St',
    city: 'New York',
    country: 'USA',
    postalCode: '10001',
    accountTier: 'BASIC',
    kycStatus: 'PENDING',
    kycVerifiedAt: null,
    kycRejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

// ── Email Verification ───────────────────────────────────────────────────────

describe('userService - Email Verification', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sendVerificationEmail generates token and saves it', async () => {
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(userRepository.setEmailVerificationToken).mockResolvedValue(
            undefined,
        );

        await userService.sendVerificationEmail('user-123');

        expect(userRepository.findById).toHaveBeenCalledWith('user-123');
        expect(userRepository.setEmailVerificationToken).toHaveBeenCalledWith(
            'user-123',
            expect.any(String),
        );
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER.VERIFY_EMAIL_SENT',
            }),
        );
    });

    it('sendVerificationEmail throws if email already verified', async () => {
        const verifiedUser = { ...mockUser, emailVerified: true };
        vi.mocked(userRepository.findById).mockResolvedValue(
            verifiedUser as any,
        );

        await expect(
            userService.sendVerificationEmail('user-123'),
        ).rejects.toThrow('Email already verified');
    });

    it('verifyEmail validates token and marks email as verified', async () => {
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const userWithToken = {
            ...mockUser,
            emailVerificationToken: 'valid-token',
            emailVerificationExpiry: futureDate,
        };
        const verifiedUser = { ...mockUser, emailVerified: true };

        vi.mocked(
            userRepository.findByEmailVerificationToken,
        ).mockResolvedValue(userWithToken as any);
        vi.mocked(userRepository.verifyEmail).mockResolvedValue(
            verifiedUser as any,
        );

        const result = await userService.verifyEmail({
            token: 'valid-token',
        });

        expect(result.emailVerified).toBe(true);
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER.EMAIL_VERIFIED',
            }),
        );
    });

    it('verifyEmail throws if token expired', async () => {
        const expiredDate = new Date(Date.now() - 1000);
        const userWithToken = {
            ...mockUser,
            emailVerificationToken: 'expired-token',
            emailVerificationExpiry: expiredDate,
        };

        vi.mocked(
            userRepository.findByEmailVerificationToken,
        ).mockResolvedValue(userWithToken as any);

        await expect(
            userService.verifyEmail({ token: 'expired-token' }),
        ).rejects.toThrow('Token has expired');
    });
});

// ── Password Reset ───────────────────────────────────────────────────────────

describe('userService - Password Reset', () => {
    beforeEach(() => vi.clearAllMocks());

    it('initiatePasswordReset generates token for existing email', async () => {
        vi.mocked(userRepository.findByEmail).mockResolvedValue(
            mockUser as any,
        );
        vi.mocked(userRepository.setPasswordResetToken).mockResolvedValue(
            undefined,
        );

        await userService.initiatePasswordReset({
            email: 'test@example.com',
        });

        expect(userRepository.findByEmail).toHaveBeenCalledWith(
            'test@example.com',
        );
        expect(userRepository.setPasswordResetToken).toHaveBeenCalledWith(
            'user-123',
            expect.any(String),
        );
    });

    it('initiatePasswordReset does not reveal if email exists', async () => {
        vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

        await userService.initiatePasswordReset({
            email: 'nonexistent@example.com',
        });

        // Should not throw, audit log should show USER_NOT_FOUND
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER.PASSWORD_RESET_ATTEMPTED',
                metadata: expect.objectContaining({
                    reason: 'USER_NOT_FOUND',
                }),
            }),
        );
    });

    it('resetPassword validates token and updates password', async () => {
        const futureDate = new Date(Date.now() + 30 * 60 * 1000);
        const userWithToken = {
            ...mockUser,
            passwordResetToken: 'reset-token',
            passwordResetExpiry: futureDate,
        };

        vi.mocked(userRepository.findByPasswordResetToken).mockResolvedValue(
            userWithToken as any,
        );
        vi.mocked(bcrypt.hash).mockResolvedValue('new_hashed_password');
        vi.mocked(userRepository.updatePassword).mockResolvedValue(undefined);

        await userService.resetPassword({
            token: 'reset-token',
            newPassword: 'NewPassword123!',
        });

        expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
        expect(userRepository.updatePassword).toHaveBeenCalledWith(
            'user-123',
            'new_hashed_password',
        );
    });

    it('resetPassword throws if token expired', async () => {
        const expiredDate = new Date(Date.now() - 1000);
        const userWithToken = {
            ...mockUser,
            passwordResetToken: 'expired-token',
            passwordResetExpiry: expiredDate,
        };

        vi.mocked(userRepository.findByPasswordResetToken).mockResolvedValue(
            userWithToken as any,
        );

        await expect(
            userService.resetPassword({
                token: 'expired-token',
                newPassword: 'NewPassword123!',
            }),
        ).rejects.toThrow('Reset token has expired');
    });
});

// ── 2FA / TOTP ───────────────────────────────────────────────────────────────

describe('userService - 2FA / TOTP', () => {
    beforeEach(() => vi.clearAllMocks());

    it('enableTOTP generates secret and returns QR code with backup codes', async () => {
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true);
        vi.mocked(userRepository.setTOTPSecret).mockResolvedValue(undefined);

        const result = await userService.enableTOTP('user-123', {
            password: 'correct-password',
        });

        expect(result).toEqual({
            secret: 'JBSWY3DPEBLW64TMMQ======',
            qrCode: 'data:image/png;base64,...',
            backupCodes: expect.arrayContaining([
                expect.stringMatching(/^[A-F0-9]{8}$/),
            ]),
        });
        expect(result.backupCodes.length).toBe(10);
        expect(userRepository.setTOTPSecret).toHaveBeenCalledWith(
            'user-123',
            'JBSWY3DPEBLW64TMMQ======',
        );
    });

    it('enableTOTP throws if password incorrect', async () => {
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(false);

        await expect(
            userService.enableTOTP('user-123', {
                password: 'wrong-password',
            }),
        ).rejects.toThrow('Password is incorrect');
    });

    it('enableTOTP throws if 2FA already enabled', async () => {
        const userWith2FA = { ...mockUser, totpEnabled: true };
        vi.mocked(userRepository.findById).mockResolvedValue(
            userWith2FA as any,
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true);

        await expect(
            userService.enableTOTP('user-123', {
                password: 'correct-password',
            }),
        ).rejects.toThrow('2FA is already enabled');
    });

    it('confirmTOTP verifies token and enables 2FA', async () => {
        const userWithSecret = {
            ...mockUser,
            totpSecret: 'JBSWY3DPEBLW64TMMQ======',
        };
        vi.mocked(userRepository.findById).mockResolvedValue(
            userWithSecret as any,
        );
        vi.mocked(speakeasy.totp.verify).mockReturnValue(true);
        vi.mocked(userRepository.enableTOTP).mockResolvedValue(undefined);

        await userService.confirmTOTP('user-123', {
            secret: 'JBSWY3DPEBLW64TMMQ======',
            token: '123456',
        });

        expect(speakeasy.totp.verify).toHaveBeenCalledWith({
            secret: 'JBSWY3DPEBLW64TMMQ======',
            encoding: 'base32',
            token: '123456',
            window: 2,
        });
        expect(userRepository.enableTOTP).toHaveBeenCalledWith('user-123');
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER.2FA_ENABLED',
            }),
        );
    });

    it('confirmTOTP throws if token invalid', async () => {
        const userWithSecret = {
            ...mockUser,
            totpSecret: 'JBSWY3DPEBLW64TMMQ======',
        };
        vi.mocked(userRepository.findById).mockResolvedValue(
            userWithSecret as any,
        );
        vi.mocked(speakeasy.totp.verify).mockReturnValue(false);

        await expect(
            userService.confirmTOTP('user-123', {
                secret: 'JBSWY3DPEBLW64TMMQ======',
                token: '000000',
            }),
        ).rejects.toThrow('Invalid token. Please try again.');
    });

    it('validateTOTP verifies and returns boolean', async () => {
        const userWith2FA = {
            ...mockUser,
            totpEnabled: true,
            totpSecret: 'JBSWY3DPEBLW64TMMQ======',
        };
        vi.mocked(userRepository.findById).mockResolvedValue(
            userWith2FA as any,
        );
        vi.mocked(speakeasy.totp.verify).mockReturnValue(true);

        const result = await userService.validateTOTP('user-123', {
            token: '123456',
        });

        expect(result).toBe(true);
    });

    it('disableTOTP requires password and disables 2FA', async () => {
        const userWith2FA = {
            ...mockUser,
            totpEnabled: true,
            totpSecret: 'JBSWY3DPEBLW64TMMQ======',
        };
        vi.mocked(userRepository.findById).mockResolvedValue(
            userWith2FA as any,
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true);
        vi.mocked(userRepository.disableTOTP).mockResolvedValue(undefined);

        await userService.disableTOTP('user-123', {
            password: 'correct-password',
        });

        expect(userRepository.disableTOTP).toHaveBeenCalledWith('user-123');
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER.2FA_DISABLED',
            }),
        );
    });
});

// ── Account Lockout ──────────────────────────────────────────────────────────

describe('userService - Account Lockout', () => {
    beforeEach(() => vi.clearAllMocks());

    it('checkAccountLock throws if account is locked', async () => {
        const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
        const lockedUser = { ...mockUser, lockedUntil };

        vi.mocked(userRepository.findById).mockResolvedValue(lockedUser as any);

        await expect(userService.checkAccountLock('user-123')).rejects.toThrow(
            'Account is locked',
        );
    });

    it('checkAccountLock unlocks if lock duration passed', async () => {
        const lockedUntil = new Date(Date.now() - 1000); // Expired
        const lockedUser = { ...mockUser, lockedUntil };

        vi.mocked(userRepository.findById).mockResolvedValue(lockedUser as any);
        vi.mocked(userRepository.unlockAccount).mockResolvedValue(undefined);

        await userService.checkAccountLock('user-123');

        expect(userRepository.unlockAccount).toHaveBeenCalledWith('user-123');
    });

    it('recordFailedLogin increments attempts', async () => {
        const userWithAttempts = {
            ...mockUser,
            failedLoginAttempts: 1,
        };
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(userRepository.incrementFailedAttempts).mockResolvedValue(
            userWithAttempts as any,
        );

        await userService.recordFailedLogin('user-123');

        expect(userRepository.incrementFailedAttempts).toHaveBeenCalledWith(
            'user-123',
        );
    });

    it('recordFailedLogin locks account after 5 attempts', async () => {
        const userWith5Attempts = {
            ...mockUser,
            failedLoginAttempts: 5,
        };
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(userRepository.incrementFailedAttempts).mockResolvedValue(
            userWith5Attempts as any,
        );
        vi.mocked(userRepository.lockAccount).mockResolvedValue(undefined);

        await userService.recordFailedLogin('user-123');

        expect(userRepository.lockAccount).toHaveBeenCalledWith('user-123', 30);
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER.ACCOUNT_LOCKED',
            }),
        );
    });

    it('recordSuccessfulLogin unlocks account', async () => {
        vi.mocked(userRepository.unlockAccount).mockResolvedValue(undefined);

        await userService.recordSuccessfulLogin('user-123');

        expect(userRepository.unlockAccount).toHaveBeenCalledWith('user-123');
    });
});

// ── KYC (Know Your Customer) ─────────────────────────────────────────────────

describe('userService - KYC', () => {
    beforeEach(() => vi.clearAllMocks());

    it('submitKYC creates KYC submission', async () => {
        const updatedUser = {
            ...mockUser,
            kycStatus: 'PENDING',
            dateOfBirth: new Date('1990-01-01'),
            nationalId: 'NAT123456',
        };
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(userRepository.submitKYC).mockResolvedValue(
            updatedUser as any,
        );

        const result = await userService.submitKYC('user-123', {
            dateOfBirth: new Date('1990-01-01'),
            nationalId: 'NAT123456',
            idType: 'NATIONAL_ID',
            address: '123 Main St',
            city: 'New York',
            country: 'USA',
            postalCode: '10001',
        });

        expect(result.kycStatus).toBe('PENDING');
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER.KYC_SUBMITTED',
            }),
        );
    });

    it('submitKYC prevents duplicate national IDs', async () => {
        const existingUser = { ...mockUser, id: 'other-user' };
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
            existingUser as any,
        );

        await expect(
            userService.submitKYC('user-123', {
                dateOfBirth: new Date('1990-01-01'),
                nationalId: 'NAT123456',
                idType: 'NATIONAL_ID',
                address: '123 Main St',
                city: 'New York',
                country: 'USA',
                postalCode: '10001',
            }),
        ).rejects.toThrow('National ID already registered');
    });

    it('getKYCStatus returns KYC information', async () => {
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);

        const status = await userService.getKYCStatus('user-123');

        expect(status).toEqual({
            status: mockUser.kycStatus,
            tier: mockUser.accountTier,
            verifiedAt: mockUser.kycVerifiedAt,
            rejectionReason: mockUser.kycRejectionReason,
        });
    });

    it('approveKYC upgrades user tier and updates status', async () => {
        const approvedUser = {
            ...mockUser,
            kycStatus: 'APPROVED',
            accountTier: 'STANDARD',
            kycVerifiedAt: new Date(),
        };
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(userRepository.approveKYC).mockResolvedValue(
            approvedUser as any,
        );

        const result = await userService.approveKYC('user-123');

        expect(result.kycStatus).toBe('APPROVED');
        expect(result.accountTier).toBe('STANDARD');
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'ADMIN.KYC_APPROVED',
            }),
        );
    });

    it('rejectKYC marks KYC as rejected with reason', async () => {
        const rejectedUser = {
            ...mockUser,
            kycStatus: 'REJECTED',
            kycRejectionReason: 'Invalid document',
        };
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(userRepository.rejectKYC).mockResolvedValue(
            rejectedUser as any,
        );

        const result = await userService.rejectKYC(
            'user-123',
            'Invalid document',
        );

        expect(result.kycStatus).toBe('REJECTED');
        expect(result.kycRejectionReason).toBe('Invalid document');
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'ADMIN.KYC_REJECTED',
                metadata: expect.objectContaining({
                    reason: 'Invalid document',
                }),
            }),
        );
    });
});

// ── Profile Management ───────────────────────────────────────────────────────

describe('userService - Profile', () => {
    beforeEach(() => vi.clearAllMocks());

    it('getProfile returns user without password hash', async () => {
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);

        const result = await userService.getProfile('user-123');

        expect(result).not.toHaveProperty('passwordHash');
        expect(result.id).toBe('user-123');
        expect(result.email).toBe('test@example.com');
    });

    it('changePassword validates current password before updating', async () => {
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true);
        vi.mocked(bcrypt.hash).mockResolvedValue('new_hashed_password');
        vi.mocked(userRepository.updatePassword).mockResolvedValue(undefined);

        await userService.changePassword('user-123', {
            currentPassword: 'current-password',
            newPassword: 'NewPassword123!',
        });

        expect(bcrypt.compare).toHaveBeenCalledWith(
            'current-password',
            mockUser.passwordHash,
        );
        expect(userRepository.updatePassword).toHaveBeenCalledWith(
            'user-123',
            'new_hashed_password',
        );
    });
});

// ── Deactivation ─────────────────────────────────────────────────────────────

describe('userService - Deactivation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('deactivateUser deactivates user and all accounts atomically', async () => {
        vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.$transaction).mockImplementation(
            async (callback: (tx: any) => Promise<any>) => {
                const mockTx = {
                    // transaction mocks
                };
                return callback(mockTx);
            },
        );
        vi.mocked(userRepository.deactivate).mockResolvedValue(undefined);
        vi.mocked(accountRepository.updateAllByUserId).mockResolvedValue(
            undefined,
        );

        await userService.deactivateUser('user-123');

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER.DEACTIVATE',
            }),
        );
    });
});
