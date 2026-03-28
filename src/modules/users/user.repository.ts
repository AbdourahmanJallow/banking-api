import prisma from '../../lib/prisma';
import type { PrismaTx } from '../../lib/prisma';
import { UpdateUserInput, SubmitKYCInput } from './user.types';

class UserRepository {
    findById(id: string) {
        return prisma.user.findUnique({ where: { id } });
    }

    findByEmail(email: string) {
        return prisma.user.findUnique({ where: { email } });
    }

    findByEmailVerificationToken(token: string) {
        return prisma.user.findUnique({
            where: { emailVerificationToken: token },
        });
    }

    findByPasswordResetToken(token: string) {
        return prisma.user.findUnique({
            where: { passwordResetToken: token },
        });
    }

    async findAll(page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    phone: true,
                    status: true,
                    emailVerified: true,
                    totpEnabled: true,
                    createdAt: true,
                },
            }),
            prisma.user.count(),
        ]);

        return { users, total };
    }

    update(id: string, data: UpdateUserInput) {
        return prisma.user.update({ where: { id }, data });
    }

    updatePassword(id: string, passwordHash: string) {
        return prisma.user.update({
            where: { id },
            data: {
                passwordHash,
                passwordResetToken: null,
                passwordResetExpiry: null,
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });
    }

    setEmailVerificationToken(id: string, token: string, expiryHours = 24) {
        const expiry = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
        return prisma.user.update({
            where: { id },
            data: {
                emailVerificationToken: token,
                emailVerificationExpiry: expiry,
            },
        });
    }

    verifyEmail(id: string) {
        return prisma.user.update({
            where: { id },
            data: {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpiry: null,
            },
        });
    }

    setPasswordResetToken(id: string, token: string, expiryMinutes = 30) {
        const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
        return prisma.user.update({
            where: { id },
            data: {
                passwordResetToken: token,
                passwordResetExpiry: expiry,
            },
        });
    }

    setTOTPSecret(id: string, secret: string) {
        return prisma.user.update({
            where: { id },
            data: { totpSecret: secret, totpEnabled: false },
        });
    }

    enableTOTP(id: string) {
        return prisma.user.update({
            where: { id },
            data: { totpEnabled: true },
        });
    }

    disableTOTP(id: string) {
        return prisma.user.update({
            where: { id },
            data: { totpSecret: null, totpEnabled: false },
        });
    }

    incrementFailedAttempts(id: string) {
        return prisma.user.update({
            where: { id },
            data: { failedLoginAttempts: { increment: 1 } },
        });
    }

    lockAccount(id: string, lockDurationMinutes = 30) {
        const lockedUntil = new Date(
            Date.now() + lockDurationMinutes * 60 * 1000,
        );
        return prisma.user.update({
            where: { id },
            data: { lockedUntil },
        });
    }

    unlockAccount(id: string) {
        return prisma.user.update({
            where: { id },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });
    }

    submitKYC(id: string, data: SubmitKYCInput) {
        return prisma.user.update({
            where: { id },
            data: {
                ...data,
                kycStatus: 'PENDING',
            },
        });
    }

    approveKYC(id: string) {
        return prisma.user.update({
            where: { id },
            data: {
                kycStatus: 'APPROVED',
                kycVerifiedAt: new Date(),
                accountTier: 'STANDARD',
            },
        });
    }

    rejectKYC(id: string, reason: string) {
        return prisma.user.update({
            where: { id },
            data: {
                kycStatus: 'REJECTED',
                kycRejectionReason: reason,
                accountTier: 'BASIC',
            },
        });
    }

    deactivate(id: string, tx?: PrismaTx) {
        const client = tx ?? prisma;
        return client.user.update({
            where: { id },
            data: { status: 'INACTIVE' },
        });
    }
}

export const userRepository = new UserRepository();
