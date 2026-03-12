import prisma from '../../lib/prisma';
import { AuditEntry, AuditLogQuery } from './audit.types';

class AuditRepository {
    create(data: AuditEntry) {
        return prisma.auditLog.create({ data });
    }

    findById(id: string) {
        return prisma.auditLog.findUnique({ where: { id } });
    }

    findMany(
        filters: Omit<AuditLogQuery, 'page' | 'limit'>,
        skip: number,
        take: number,
    ) {
        const where = this.buildWhere(filters);

        return prisma.auditLog.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
        });
    }

    count(filters: Omit<AuditLogQuery, 'page' | 'limit'>) {
        return prisma.auditLog.count({ where: this.buildWhere(filters) });
    }

    private buildWhere(filters: Omit<AuditLogQuery, 'page' | 'limit'>) {
        return {
            ...(filters.userId && { userId: filters.userId }),
            ...(filters.action && {
                action: {
                    contains: filters.action,
                    mode: 'insensitive' as const,
                },
            }),
            ...(filters.resource && { resource: filters.resource }),
            ...(filters.statusCode && { statusCode: filters.statusCode }),
            ...((filters.from || filters.to) && {
                createdAt: {
                    ...(filters.from && { gte: filters.from }),
                    ...(filters.to && { lte: filters.to }),
                },
            }),
        };
    }
}

export const auditRepository = new AuditRepository();
