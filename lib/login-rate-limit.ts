import { createHmac, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const maxLoginAttempts = 5;
export const maxSignupAttempts = 3;
export const maxPasswordResetAttempts = 3;

function getRateLimitId(scope: string, identifier: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
    }
    return createHmac('sha256', 'local-development-session-secret-do-not-use-in-production')
      .update(`${scope}:${identifier}`).digest('hex');
  }
  return createHmac('sha256', secret).update(`${scope}:${identifier}`).digest('hex');
}

export async function recordRateLimitAttempt(scope: string, identifier: string, windowSeconds: number) {
  const id = getRateLimitId(scope, identifier);
  const rows = await prisma.$queryRaw<Array<{ attempts: number; expiresAt: Date }>>`
    INSERT INTO "LoginRateLimit" ("id", "attempts", "windowStartedAt", "expiresAt")
    VALUES (${id}, 1, NOW(), NOW() + (${windowSeconds} * INTERVAL '1 second'))
    ON CONFLICT ("id") DO UPDATE
    SET
      "attempts" = CASE
        WHEN "LoginRateLimit"."expiresAt" <= NOW() THEN 1
        ELSE "LoginRateLimit"."attempts" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "LoginRateLimit"."expiresAt" <= NOW() THEN NOW()
        ELSE "LoginRateLimit"."windowStartedAt"
      END,
      "expiresAt" = CASE
        WHEN "LoginRateLimit"."expiresAt" <= NOW() THEN NOW() + (${windowSeconds} * INTERVAL '1 second')
        ELSE "LoginRateLimit"."expiresAt"
      END
    RETURNING "attempts", "expiresAt"
  `;

  if (randomBytes(1)[0] % 16 === 0) {
    await prisma.$executeRaw`
      DELETE FROM "LoginRateLimit"
      WHERE "id" IN (
        SELECT "id" FROM "LoginRateLimit"
        WHERE "expiresAt" <= NOW()
        ORDER BY "expiresAt"
        LIMIT 100
      )
    `;
  }

  return {
    id,
    attempts: rows[0].attempts,
    retryAfterSeconds: Math.max(1, Math.ceil((rows[0].expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export function recordLoginAttempt(email: string) {
  return recordRateLimitAttempt('login', email, 15 * 60);
}

export async function clearRateLimit(id: string) {
  await prisma.loginRateLimit.deleteMany({ where: { id } });
}
