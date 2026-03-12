import { auditRepository } from './audit.repository';
import { AuditEntry, AuditLogQuery } from './audit.types';

class AuditService {
    /**
     * Fire-and-forget write. Errors are swallowed so a failed audit write
     * never disrupts the actual API response.
     */
    log(entry: AuditEntry): void {
        try {
            auditRepository
                .create(entry)
                .catch((err) =>
                    console.error(
                        '[AuditService] Failed to write audit log:',
                        err,
                    ),
                );
        } catch (err) {
            console.error(
                '[AuditService] Failed to write audit log (sync):',
                err,
            );
        }
    }

    async getLogs(query: AuditLogQuery) {
        const { page, limit, ...filters } = query;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            auditRepository.findMany(filters, skip, limit),
            auditRepository.count(filters),
        ]);

        return { logs, total, page, limit };
    }

    async getLog(id: string) {
        return auditRepository.findById(id);
    }

    async getUserLogs(userId: string, page = 1, limit = 50) {
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            auditRepository.findMany({ userId }, skip, limit),
            auditRepository.count({ userId }),
        ]);

        return { logs, total, page, limit };
    }
}

export const auditService = new AuditService();
