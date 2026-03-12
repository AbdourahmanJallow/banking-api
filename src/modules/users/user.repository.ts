import prisma from '../../lib/prisma';
import type { PrismaTx } from '../../lib/prisma';
import { UpdateUserInput } from './user.types';

class UserRepository {
    findById(id: string) {
        return prisma.user.findUnique({ where: { id } });
    }

    findByEmail(email: string) {
        return prisma.user.findUnique({ where: { email } });
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
        return prisma.user.update({ where: { id }, data: { passwordHash } });
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
