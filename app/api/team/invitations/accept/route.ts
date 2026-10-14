import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getAuthenticatedUser, hashInvitationToken, isCompanyRole, setSessionCookie } from '@/lib/auth';
import { emailLookupHash, readInvitationEmail } from '@/lib/personal-data.mjs';
import { prisma } from '@/lib/prisma';

async function lockCompany(transaction: Prisma.TransactionClient, companyId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE`;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Entre na sua conta para aceitar este convite.' }, { status: 401 });

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Este convite é inválido ou expirou.' }, { status: 400 });
    }
    const token = typeof input === 'object' && input !== null && !Array.isArray(input) && 'token' in input && typeof input.token === 'string'
      ? input.token
      : '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
      return NextResponse.json({ error: 'Este convite é inválido ou expirou.' }, { status: 400 });
    }

    const tokenHash = hashInvitationToken(token);
    const now = new Date();
    const acceptedCompanyId = await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findUnique({
        where: { tokenHash },
        select: { id: true, companyId: true, email: true, emailEncrypted: true, emailLookupHash: true, role: true, expiresAt: true, acceptedAt: true },
      });
      if (!invitation || invitation.acceptedAt || invitation.expiresAt <= now || !isCompanyRole(invitation.role)) {
        throw new Error('INVITATION_INVALID');
      }
      if (emailLookupHash(user.email) !== invitation.emailLookupHash || readInvitationEmail(invitation) !== user.email) {
        throw new Error('INVITATION_EMAIL_MISMATCH');
      }

      await lockCompany(transaction, invitation.companyId);
      const claimed = await transaction.invitation.updateMany({
        where: { id: invitation.id, tokenHash, acceptedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (!claimed.count) throw new Error('INVITATION_INVALID');
      await transaction.membership.create({
        data: { userId: user.id, companyId: invitation.companyId, role: invitation.role },
      });
      return invitation.companyId;
    });

    const response = NextResponse.json({ message: 'Convite aceito. Você já tem acesso à empresa.' });
    setSessionCookie(response, user.id, acceptedCompanyId);
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVITATION_INVALID') {
        return NextResponse.json({ error: 'Este convite é inválido, já foi aceito ou expirou.' }, { status: 400 });
      }
      if (error.message === 'INVITATION_EMAIL_MISMATCH') {
        return NextResponse.json({ error: 'Entre com a conta que usa o e-mail convidado para aceitar este convite.' }, { status: 403 });
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Esta conta já tem acesso à empresa.' }, { status: 409 });
    }
    console.error('Erro ao aceitar convite:', error);
    return NextResponse.json({ error: 'Não foi possível aceitar o convite.' }, { status: 500 });
  }
}
