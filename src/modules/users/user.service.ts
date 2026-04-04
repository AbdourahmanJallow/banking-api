import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../../lib/prisma';
import { userRepository } from './user.repository';
import { accountRepository } from '../accounts/account.repository';
import {
    UpdateUserInput,
    ChangePasswordInput,
    UserPublic,
    VerifyEmailInput,
    InitiatePasswordResetInput,
    ResetPasswordInput,
    EnableTOTPInput,
    ConfirmTOTPInput,
    ValidateTOTPInput,
    DisableTOTPInput,
    TOTPSetupResponse,
    SubmitKYCInput,
} from './user.types';
import {
    AppError,
    NotFoundError,
    BadRequestError,
    ForbiddenError,
    ConflictError,
} from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import {
    queueVerificationEmail,
    queuePasswordResetEmail,
    queue2FAEnabledEmail,
    queue2FABackupCodesEmail,
    queueAccountLockedEmail,
    queueKYCSubmittedEmail,
    queueKYCApprovedEmail,
    queueKYCRejectedEmail,
    queueWelcomeEmail,
} from '../notifications/notification.queue';

class UserService {
    private readonly SALT_ROUNDS = 12;
    private readonly TOKEN_LENGTH = 32; // bytes for random tokens

    private generateToken(): string {
        return randomBytes(this.TOKEN_LENGTH).toString('hex');
    }

    private generateBackupCodes(count = 10): string[] {
        return Array.from({ length: count }, () =>
            randomBytes(4).toString('hex').toUpperCase(),
        );
    }

    private sanitizeUser(user: any): UserPublic {
        const { passwordHash: _, ...profile } = user;
        return profile;
    }

    async getProfile(userId: string): Promise<UserPublic> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        return this.sanitizeUser(user);
    }

    async updateProfile(
        userId: string,
        input: UpdateUserInput,
    ): Promise<UserPublic> {
        const user = await userRepository.update(userId, input);

        auditService.log({
            userId,
            action: 'USER.PROFILE_UPDATE',
            resource: 'USER',
            resourceId: userId,
            metadata: { updatedFields: Object.keys(input) },
        });

        return this.sanitizeUser(user);
    }

    async changePassword(
        userId: string,
        input: ChangePasswordInput,
    ): Promise<void> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        const valid = await bcrypt.compare(
            input.currentPassword,
            user.passwordHash,
        );

        if (!valid)
            throw new BadRequestError(
                'Current password is incorrect',
                'WRONG_PASSWORD',
            );

        const hash = await bcrypt.hash(input.newPassword, this.SALT_ROUNDS);

        await userRepository.updatePassword(userId, hash);

        auditService.log({
            userId,
            action: 'USER.PASSWORD_CHANGE',
            resource: 'USER',
            resourceId: userId,
        });
    }

    async listUsers(page: number, limit: number) {
        return userRepository.findAll(page, limit);
    }

    async deactivateUser(userId: string): Promise<void> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        await prisma.$transaction(async (tx) => {
            await userRepository.deactivate(userId, tx);
            await accountRepository.updateAllByUserId(userId, 'INACTIVE', tx);
        });

        auditService.log({
            action: 'USER.DEACTIVATE',
            resource: 'USER',
            resourceId: userId,
        });
    }

    async sendVerificationEmail(userId: string): Promise<void> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        if (user.emailVerified) {
            throw new BadRequestError('Email already verified');
        }

        const token = this.generateToken();

        await userRepository.setEmailVerificationToken(userId, token);

        // Queue verification email
        const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
        await queueVerificationEmail(
            user.email,
            user.fullName || 'User',
            verificationUrl,
            '24 hours',
        );

        auditService.log({
            userId,
            action: 'USER.VERIFY_EMAIL_SENT',
            resource: 'USER',
            resourceId: userId,
        });
    }

    async verifyEmail(input: VerifyEmailInput): Promise<UserPublic> {
        const user = await userRepository.findByEmailVerificationToken(
            input.token,
        );

        if (!user) throw new BadRequestError('Invalid or expired token');

        if (
            user.emailVerificationExpiry &&
            user.emailVerificationExpiry < new Date()
        ) {
            throw new BadRequestError('Token has expired');
        }

        const verified = await userRepository.verifyEmail(user.id);

        auditService.log({
            userId: user.id,
            action: 'USER.EMAIL_VERIFIED',
            resource: 'USER',
            resourceId: user.id,
        });

        return this.sanitizeUser(verified);
    }

    async initiatePasswordReset(
        input: InitiatePasswordResetInput,
    ): Promise<void> {
        const user = await userRepository.findByEmail(input.email);

        if (!user) {
            // Don't reveal if email exists
            auditService.log({
                action: 'USER.PASSWORD_RESET_ATTEMPTED',
                resource: 'USER',
                metadata: { email: input.email, reason: 'USER_NOT_FOUND' },
            });
            return;
        }

        const token = this.generateToken();

        await userRepository.setPasswordResetToken(user.id, token);

        // Queue password reset email
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
        await queuePasswordResetEmail(user.email, resetUrl, '1 hour');

        auditService.log({
            userId: user.id,
            action: 'USER.PASSWORD_RESET_INITIATED',
            resource: 'USER',
            resourceId: user.id,
        });
    }

    async resetPassword(input: ResetPasswordInput): Promise<void> {
        const user = await userRepository.findByPasswordResetToken(input.token);

        if (!user) throw new BadRequestError('Invalid or expired token');

        if (user.passwordResetExpiry && user.passwordResetExpiry < new Date()) {
            throw new BadRequestError('Reset token has expired');
        }

        const hash = await bcrypt.hash(input.newPassword, this.SALT_ROUNDS);

        await userRepository.updatePassword(user.id, hash);

        auditService.log({
            userId: user.id,
            action: 'USER.PASSWORD_RESET',
            resource: 'USER',
            resourceId: user.id,
        });
    }

    async enableTOTP(
        userId: string,
        input: EnableTOTPInput,
    ): Promise<TOTPSetupResponse> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        const valid = await bcrypt.compare(input.password, user.passwordHash);

        if (!valid) {
            throw new BadRequestError('Password is incorrect');
        }

        if (user.totpEnabled) {
            throw new BadRequestError('2FA is already enabled');
        }

        // Generate TOTP secret
        const secret = speakeasy.generateSecret({
            name: `Banking API (${user.email})`,
            issuer: 'Banking API',
            length: 32,
        });

        // Generate QR code for authenticator app
        const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

        // Generate backup codes for account recovery
        const backupCodes = this.generateBackupCodes();

        // Store the TOTP secret (not enabled yet, needs confirmation)
        await userRepository.setTOTPSecret(userId, secret.base32);

        auditService.log({
            userId,
            action: 'USER.2FA_SETUP_INITIATED',
            resource: 'USER',
            resourceId: userId,
        });

        // Return setup data for frontend to display
        return {
            secret: secret.base32,
            qrCode,
            backupCodes,
        };
    }

    async confirmTOTP(userId: string, input: ConfirmTOTPInput): Promise<void> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        if (!user.totpSecret) {
            throw new BadRequestError('TOTP setup not initiated');
        }

        if (user.totpEnabled) {
            throw new BadRequestError('2FA is already enabled');
        }

        // Verify the token against the stored secret
        const verified = speakeasy.totp.verify({
            secret: input.secret,
            encoding: 'base32',
            token: input.token,
            window: 2,
        });

        if (!verified) {
            throw new BadRequestError('Invalid token. Please try again.');
        }

        // Confirmed, enable 2FA
        await userRepository.enableTOTP(userId);

        // Queue 2FA enabled email
        await queue2FAEnabledEmail(user.email);

        // Generate and queue backup codes email
        const backupCodes = this.generateBackupCodes();
        await queue2FABackupCodesEmail(user.email, backupCodes);

        auditService.log({
            userId,
            action: 'USER.2FA_ENABLED',
            resource: 'USER',
            resourceId: userId,
        });
    }

    async validateTOTP(
        userId: string,
        input: ValidateTOTPInput,
    ): Promise<boolean> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        if (!user.totpEnabled || !user.totpSecret) {
            throw new BadRequestError('2FA is not enabled');
        }

        // Verify the TOTP token
        const verified = speakeasy.totp.verify({
            secret: user.totpSecret,
            encoding: 'base32',
            token: input.token,
            window: 2,
        });

        return verified;
    }

    async disableTOTP(userId: string, input: DisableTOTPInput): Promise<void> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        const valid = await bcrypt.compare(input.password, user.passwordHash);

        if (!valid) {
            throw new BadRequestError('Password is incorrect');
        }

        if (!user.totpEnabled) {
            throw new BadRequestError('2FA is not enabled');
        }

        await userRepository.disableTOTP(userId);

        auditService.log({
            userId,
            action: 'USER.2FA_DISABLED',
            resource: 'USER',
            resourceId: userId,
        });
    }

    async checkAccountLock(userId: string): Promise<void> {
        const user = await userRepository.findById(userId);

        if (!user) return;

        if (!user.lockedUntil) return;

        if (user.lockedUntil > new Date()) {
            throw new ForbiddenError(
                'Account is locked. Please try again later.',
                'ACCOUNT_LOCKED',
            );
        }

        // Unlock if lock duration has passed
        await userRepository.unlockAccount(userId);
    }

    async recordFailedLogin(userId: string): Promise<void> {
        let user = await userRepository.findById(userId);

        if (!user) return;

        user = await userRepository.incrementFailedAttempts(userId);

        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts >= 5) {
            await userRepository.lockAccount(userId, 30);

            auditService.log({
                userId,
                action: 'USER.ACCOUNT_LOCKED',
                resource: 'USER',
                resourceId: userId,
                metadata: { reason: 'FAILED_LOGIN_ATTEMPTS' },
            });

            // Queue account locked notification email
            await queueAccountLockedEmail(user.email);
        }
    }

    async recordSuccessfulLogin(userId: string): Promise<void> {
        await userRepository.unlockAccount(userId);
    }

    async submitKYC(
        userId: string,
        input: SubmitKYCInput,
    ): Promise<UserPublic> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        // Check for duplicate national ID
        const existing = await prisma.user.findUnique({
            where: { nationalId: input.nationalId },
        });

        if (existing && existing.id !== userId) {
            throw new ConflictError('National ID already registered');
        }

        const updated = await userRepository.submitKYC(userId, input);

        // Queue KYC submitted email
        await queueKYCSubmittedEmail(user.email, 'PENDING');

        auditService.log({
            userId,
            action: 'USER.KYC_SUBMITTED',
            resource: 'USER',
            resourceId: userId,
        });

        return this.sanitizeUser(updated);
    }

    async getKYCStatus(userId: string) {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        return {
            status: user.kycStatus,
            tier: user.accountTier,
            verifiedAt: user.kycVerifiedAt,
            rejectionReason: user.kycRejectionReason,
        };
    }

    async approveKYC(userId: string): Promise<UserPublic> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        const updated = await userRepository.approveKYC(userId);

        // Queue KYC approved email
        await queueKYCApprovedEmail(
            user.email,
            updated.accountTier || 'STANDARD',
        );

        auditService.log({
            userId,
            action: 'ADMIN.KYC_APPROVED',
            resource: 'USER',
            resourceId: userId,
        });

        return this.sanitizeUser(updated);
    }

    async rejectKYC(userId: string, reason: string): Promise<UserPublic> {
        const user = await userRepository.findById(userId);

        if (!user) throw new NotFoundError('User not found');

        const updated = await userRepository.rejectKYC(userId, reason);

        // Queue KYC rejected email
        await queueKYCRejectedEmail(user.email, reason);

        auditService.log({
            userId,
            action: 'ADMIN.KYC_REJECTED',
            resource: 'USER',
            resourceId: userId,
            metadata: { reason },
        });

        return this.sanitizeUser(updated);
    }
}

export const userService = new UserService();
