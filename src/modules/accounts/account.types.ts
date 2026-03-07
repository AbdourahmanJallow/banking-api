import { z } from 'zod';

export const CreateAccountSchema = z.object({
    currency: z
        .string()
        .length(3, 'Currency must be a 3-letter ISO code')
        .toUpperCase(),
});

export const UpdateAccountStatusSchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'FROZEN']),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountStatusInput = z.infer<
    typeof UpdateAccountStatusSchema
>;
