import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readUserPersonalData } from '@/lib/personal-data.mjs';

export const SESSION_COOKIE = 'meu-financeiro-session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const COMPANY_ROLES = ['ADMINISTRADOR', 'FINANCEIRO', 'OPERACIONAL', 'LEITURA'] as const;
export type CompanyRole = typeof COMPANY_ROLES[number];

export function isCompanyRole(value: unknown): value is CompanyRole {
  return typeof value === 'string' && COMPANY_ROLES.includes(value as CompanyRole);
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== 'production') {
    return 'local-development-session-secret-do-not-use-in-production';
  }
  throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
}

export function createSessionToken(userId: string, companyId: string) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    companyId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  })).toString('base64url');
  const signature = createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifySessionToken(token: string) {
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length) return null;
  const expected = createHmac('sha256', getSessionSecret()).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const session: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof session !== 'object' ||
      session === null ||
      !('userId' in session) ||
      !('expiresAt' in session) ||
      typeof session.userId !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;
    return {
      userId: session.userId,
      companyId: 'companyId' in session && typeof session.companyId === 'string' ? session.companyId : undefined,
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      fullName: true,
      fullNameEncrypted: true,
      email: true,
      emailEncrypted: true,
      emailLookupHash: true,
      cpf: true,
      cpfEncrypted: true,
      cpfLookupHash: true,
      birthDate: true,
      birthDateEncrypted: true,
      memberships: {
        select: {
          role: true,
          company: { select: { id: true, name: true, workspaceType: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!user || !user.memberships.length) return null;
  const personalData = readUserPersonalData(user);
  const membership = user.memberships.find((item) => item.company.id === session.companyId) ?? user.memberships[0];
  return {
    id: user.id,
    fullName: personalData.fullName,
    email: personalData.email,
    companyId: membership.company.id,
    companyName: membership.company.name,
    workspaceType: membership.company.workspaceType,
    role: membership.role,
    workspaces: user.memberships.map((item) => ({
      id: item.company.id,
      name: item.company.name,
      workspaceType: item.company.workspaceType,
      role: item.role,
    })),
  };
}

export function setSessionCookie(response: NextResponse, userId: string, companyId: string) {
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId, companyId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function hashInvitationToken(token: string) {
  return createHmac('sha256', getSessionSecret()).update(`invitation:${token}`).digest('hex');
}

export function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
