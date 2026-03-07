import { z } from 'zod';

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
    createdAt: Date;
}
