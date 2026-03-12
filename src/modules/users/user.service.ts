import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { userRepository } from './user.repository';
import { accountRepository } from '../accounts/account.repository';
import { UpdateUserInput, ChangePasswordInput, UserPublic } from './user.types';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

class UserService {
    private readonly SALT_ROUNDS = 12;

    async getProfile(userId: string): Promise<UserPublic> {
        const user = await userRepository.findById(userId);

        if (!user) throw AppError.notFound('User not found');

        const { passwordHash: _, ...profile } = user;

        return profile;
    }

    async updateProfile(
        userId: string,
        input: UpdateUserInput,
    ): Promise<UserPublic> {
        const user = await userRepository.update(userId, input);

        const { passwordHash: _, ...profile } = user;

        auditService.log({
            userId,
            action: 'USER.PROFILE_UPDATE',
            resource: 'USER',
            resourceId: userId,
            metadata: { updatedFields: Object.keys(input) },
        });

        return profile;
    }

    async changePassword(
        userId: string,
        input: ChangePasswordInput,
    ): Promise<void> {
        const user = await userRepository.findById(userId);

        if (!user) throw AppError.notFound('User not found');

        const valid = await bcrypt.compare(
            input.currentPassword,
            user.passwordHash,
        );

        if (!valid)
            throw AppError.badRequest(
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

        if (!user) throw AppError.notFound('User not found');

        // Atomically deactivate the user and freeze all their accounts so
        // no account remains ACTIVE while the owning user is INACTIVE.
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
}

export const userService = new UserService();
