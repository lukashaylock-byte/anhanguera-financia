import { NextResponse } from 'next/server';
import { getAuthenticatedUser, hashInvitationToken, isCompanyRole, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Entre na sua conta para aceitar o convite.' }, { status: 401 });
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Link do convite inválido.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input) || !('token' in input) || typeof input.token !== 'string') {
      return NextResponse.json({ error: 'Link do convite inválido.' }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(input.token) },
      select: { id: true, companyId: true, email: true, role: true, acceptedAt: true, expiresAt: true },
    });
    if (!invitation || invitation.acceptedAt) return NextResponse.json({ error: 'Este convite não está mais disponível.' }, { status: 404 });
    if (invitation.expiresAt <= new Date()) return NextResponse.json({ error: 'Este convite expirou. Peça ao administrador para enviar outro.' }, { status: 410 });
    if (!isCompanyRole(invitation.role)) return NextResponse.json({ error: 'O perfil deste convite não é válido.' }, { status: 409 });
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: `Entre com ${invitation.email} para aceitar este convite.` }, { status: 403 });
    }

    await prisma.$transaction(async (transaction) => {
      const accepted = await transaction.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (!accepted.count) throw new Error('INVITATION_NO_LONGER_AVAILABLE');
      await transaction.membership.upsert({
        where: { userId_companyId: { userId: user.id, companyId: invitation.companyId } },
        create: { userId: user.id, companyId: invitation.companyId, role: invitation.role },
        update: { role: invitation.role },
      });
    });

    const response = NextResponse.json({ message: 'Convite aceito. Empresa adicionada à sua conta.' });
    setSessionCookie(response, user.id, invitation.companyId);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITATION_NO_LONGER_AVAILABLE') {
      return NextResponse.json({ error: 'Este convite foi aceito ou expirou.' }, { status: 409 });
    }
    console.error('Erro ao aceitar convite:', error);
    return NextResponse.json({ error: 'Não foi possível aceitar o convite.' }, { status: 500 });
  }
}
