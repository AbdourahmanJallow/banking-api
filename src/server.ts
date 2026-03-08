import 'colors';
import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { connectDB, gracefulShutdown } from './lib/prisma';
import { connectRedis, disconnectRedis } from './config/redis';

async function main() {
    await connectDB();
    await connectRedis();

    const app = createApp();
    const server = app.listen(config.server.port, config.server.host, () => {
        console.log(
            `🚀 Banking API running on http://${config.server.host}:${config.server.port}`
                .green,
        );
        // console.log(`Environment: ${config.env}`);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
        console.log(`\n${signal} received, shutting down gracefully...`);
        server.close(async () => {
            await gracefulShutdown();
            await disconnectRedis();
            process.exit(0);
        });

        // Force exit if shutdown hangs
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 30_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (err) => {
        console.error('Unhandled rejection:', err);
        shutdown('unhandledRejection');
    });
}

main().catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
