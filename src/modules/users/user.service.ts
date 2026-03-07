import bcrypt from 'bcrypt';
import * as UserRepository from './user.repository';
import { UpdateUserInput, ChangePasswordInput, UserPublic } from './user.types';
import { AppError } from '../../utils/AppError';

export async function getProfile(userId: string): Promise<UserPublic> {
    const user = await UserRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');
    const { passwordHash: _, ...profile } = user;
    return profile;
}

export async function updateProfile(
    userId: string,
    input: UpdateUserInput,
): Promise<UserPublic> {
    const user = await UserRepository.update(userId, input);
    const { passwordHash: _, ...profile } = user;
    return profile;
}

export async function changePassword(
    userId: string,
    input: ChangePasswordInput,
): Promise<void> {
    const user = await UserRepository.findById(userId);
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

    const hash = await bcrypt.hash(input.newPassword, 12);
    await UserRepository.updatePassword(userId, hash);
}

export async function listUsers(page: number, limit: number) {
    return UserRepository.findAll(page, limit);
}

export async function deactivateUser(userId: string): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');
    await UserRepository.deactivate(userId);
}
