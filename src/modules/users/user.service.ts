import bcrypt from 'bcrypt';
import { userRepository } from './user.repository';
import { UpdateUserInput, ChangePasswordInput, UserPublic } from './user.types';
import { AppError } from '../../utils/AppError';

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
    }

    async listUsers(page: number, limit: number) {
        return userRepository.findAll(page, limit);
    }

    async deactivateUser(userId: string): Promise<void> {
        const user = await userRepository.findById(userId);

        if (!user) throw AppError.notFound('User not found');

        await userRepository.deactivate(userId);
    }
}

export const userService = new UserService();
