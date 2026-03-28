import { z } from 'zod';

// CORE TYPES
export const UpdateUserSchema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional(),
});

export const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export interface UserPublic {
    id: string;
    email: string;
    fullName: string;
    phone?: string | null;
    status: string;
    emailVerified: boolean;
    totpEnabled: boolean;
    createdAt: Date;
}

// EMAIL VERIFICATION
export const VerifyEmailSchema = z.object({
    token: z.string().min(20, 'Invalid verification token'),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════════════

export const InitiatePasswordResetSchema = z.object({
    email: z.string().email('Invalid email address'),
});

export const ResetPasswordSchema = z
    .object({
        token: z.string().min(20, 'Invalid reset token'),
        newPassword: z
            .string()
            .min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

export type InitiatePasswordResetInput = z.infer<
    typeof InitiatePasswordResetSchema
>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// 2FA / TOTP
export const EnableTOTPSchema = z.object({
    password: z.string().min(1, 'Password required'),
});

export const ConfirmTOTPSchema = z.object({
    secret: z.string(),
    token: z
        .string()
        .length(6, 'Token must be 6 digits')
        .regex(/^\d{6}$/),
});

export const ValidateTOTPSchema = z.object({
    token: z
        .string()
        .length(6, 'Token must be 6 digits')
        .regex(/^\d{6}$/),
});

export const DisableTOTPSchema = z.object({
    password: z.string().min(1, 'Password required'),
});

export type EnableTOTPInput = z.infer<typeof EnableTOTPSchema>;
export type ConfirmTOTPInput = z.infer<typeof ConfirmTOTPSchema>;
export type ValidateTOTPInput = z.infer<typeof ValidateTOTPSchema>;
export type DisableTOTPInput = z.infer<typeof DisableTOTPSchema>;

export interface TOTPSetupResponse {
    secret: string;
    qrCode: string; // Base64 encoded QR code
    backupCodes: string[];
}

export enum AccountTier {
    BASIC = 'BASIC',
    STANDARD = 'STANDARD',
    GOLD = 'GOLD',
}

export enum KYCStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export enum IdentificationType {
    PASSPORT = 'PASSPORT',
    NATIONAL_ID = 'NATIONAL_ID',
    DRIVER_LICENSE = 'DRIVER_LICENSE',
}

export const SubmitKYCSchema = z.object({
    dateOfBirth: z.coerce.date(),
    nationalId: z.string().min(5),
    idType: z.nativeEnum(IdentificationType),
    address: z.string().min(5),
    city: z.string().min(2),
    country: z.string().min(2),
    postalCode: z.string().min(3),
});

export type SubmitKYCInput = z.infer<typeof SubmitKYCSchema>;
