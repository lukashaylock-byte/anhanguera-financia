import { PrismaClient } from '@prisma/client';

export function backfillPersonalData(
  client: PrismaClient,
  options?: { clearPlaintext?: boolean },
): Promise<{ users: number; invitations: number }>;
