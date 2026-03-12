import prisma from '../src/lib/prisma';
import { seed } from '../src/database/seed';

seed()
    .catch((err) => {
        console.error('❌  Seed failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
