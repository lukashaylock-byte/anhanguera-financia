import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { backfillPersonalData } from '../lib/personal-data-backfill.mjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be configured to encrypt stored personal data.');
if (!process.env.DATA_ENCRYPTION_KEY) throw new Error('DATA_ENCRYPTION_KEY must be configured before deployment.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const result = await backfillPersonalData(prisma);
  console.info(`Encrypted personal-data records: ${result.users} user(s), ${result.invitations} invitation(s).`);
} finally {
  await prisma.$disconnect();
}
