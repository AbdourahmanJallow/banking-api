import { z } from 'zod';

export const RegisterSchema = z.object({
    email: z.email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    fullName: z.string().min(2),
    phone: z.string().optional(),
});

export const LoginSchema = z.object({
    email: z.email(),
    password: z.string().min(1, 'Password is required'),
    totpToken: z.string().optional(), // 2FA token
});

export const RefreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        fullName: string;
    };
    tokens: TokenPair;
}
