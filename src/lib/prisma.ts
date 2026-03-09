import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Represents the transactional client passed inside a prisma.$transaction()
 * callback. It mirrors the full PrismaClient API minus the connection/
 * transaction-management methods — use this type when accepting a `tx`
 * parameter in repositories and services.
 */
export type PrismaTx = Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

declare global {
    var __prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });

// Create single instance with adapter
const prisma =
    global.__prisma ||
    new PrismaClient({
        adapter,
        log:
            process.env.NODE_ENV === 'development'
                ? ['query', 'info', 'warn', 'error']
                : ['error'],
        errorFormat: 'pretty',
    });

if (process.env.NODE_ENV === 'development') {
    global.__prisma = prisma;
}

export const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log('🗄️  Database connected successfully');

        await prisma.$queryRaw`SELECT 1`;
        console.log('🔍 Database query test successful');
    } catch (error) {
        console.error('❌ Database connection error:', error);
        process.exit(1);
    }
};

export const gracefulShutdown = async () => {
    try {
        await prisma.$disconnect();
        console.log('🔌 Database disconnected gracefully');
    } catch (error) {
        console.error('❌ Error during database disconnect:', error);
    }
};

export default prisma;
