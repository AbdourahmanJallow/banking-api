import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { generateAccountNumber } from '../utils/generateAccountNumber';

const SALT_ROUNDS = 10;

// Seed data

const users = [
    {
        email: 'admin@bankingapi.gm',
        password: 'Admin@1234',
        fullName: 'System Admin',
        phone: '+2201000001',
        status: 'ACTIVE',
    },
    {
        email: 'abdou.jallow@bankingapi.gm',
        password: 'Abdou@1234',
        fullName: 'Abdou Jallow',
        phone: '+2207000001',
        status: 'ACTIVE',
    },
    {
        email: 'bob.ceesay@bankingapi.gm',
        password: 'Bob@12345',
        fullName: 'Bob Ceesay',
        phone: '+2207000002',
        status: 'ACTIVE',
    },
    {
        email: 'fatou.sowe@bankingapi.gm',
        password: 'Fatou@1234',
        fullName: 'Fatou Sowe',
        phone: '+2207000003',
        status: 'ACTIVE',
    },
    {
        email: 'alieu.jallow@bankingapi.gm',
        password: 'Alieu@1234',
        fullName: 'Alieu Jallow',
        phone: '+2207000004',
        status: 'ACTIVE',
    },
    {
        email: 'musa.bah@bankingapi.gm',
        password: 'Musa@1234',
        fullName: 'Musa Bah',
        phone: '+2207000005',
        status: 'ACTIVE',
    },
    {
        email: 'mariama.njie@bankingapi.gm',
        password: 'Mariama@1234',
        fullName: 'Mariama Njie',
        phone: '+2207000006',
        status: 'ACTIVE',
    },
];

// Helpers

async function uniqueAccountNumber(): Promise<string> {
    let number: string;
    do {
        number = generateAccountNumber();

        const existing = await prisma.account.findUnique({
            where: { accountNumber: number },
        });

        if (!existing) break;
    } while (true);
    return number!;
}

// Main

export async function seed() {
    console.log('🌱  Seeding database...');

    // Users
    const createdUsers: { id: string; email: string }[] = [];

    for (const userData of users) {
        const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);

        const user = await prisma.user.upsert({
            where: { email: userData.email },
            update: {},
            create: {
                email: userData.email,
                passwordHash,
                fullName: userData.fullName,
                phone: userData.phone,
                status: userData.status,
            },
        });

        createdUsers.push({ id: user.id, email: user.email });
        console.log(`  ✔ User: ${user.email}`);
    }

    // Accounts

    // Admin gets one operational account
    const adminUser = createdUsers[0];
    await prisma.account.upsert({
        where: { accountNumber: 'ADM-0000000001' },
        update: {},
        create: {
            userId: adminUser.id,
            accountNumber: 'ADM-0000000001',
            currency: 'GMD',
            balance: 1_000_000,
            status: 'ACTIVE',
        },
    });

    console.log(`  ✔ Account: ADM-0000000001 (admin)`);

    // Regular users each get a primary savings and a secondary current account
    for (const { id, email } of createdUsers.slice(1)) {
        const [primaryNumber, secondaryNumber] = await Promise.all([
            uniqueAccountNumber(),
            uniqueAccountNumber(),
        ]);

        await Promise.all([
            prisma.account.create({
                data: {
                    userId: id,
                    accountNumber: primaryNumber,
                    currency: 'GMD',
                    balance: 5_000,
                    status: 'ACTIVE',
                },
            }),
            prisma.account.create({
                data: {
                    userId: id,
                    accountNumber: secondaryNumber,
                    currency: 'GMD',
                    balance: 1_500,
                    status: 'ACTIVE',
                },
            }),
        ]);

        console.log(
            `  ✔ Accounts: ${primaryNumber}, ${secondaryNumber} (${email})`,
        );
    }

    console.log('\n✅  Seeding complete.');
}
