import prisma from '../../config/connection';
import { UpdateUserInput } from './user.types';

export async function findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
}

export async function findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
}

export async function findAll(page = 1, limit = 20) {
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
                createdAt: true,
            },
        }),
        prisma.user.count(),
    ]);
    return { users, total };
}

export async function update(id: string, data: UpdateUserInput) {
    return prisma.user.update({ where: { id }, data });
}

export async function updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({ where: { id }, data: { passwordHash } });
}

export async function deactivate(id: string) {
    return prisma.user.update({ where: { id }, data: { status: 'INACTIVE' } });
}
