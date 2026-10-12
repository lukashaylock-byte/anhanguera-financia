import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser, hashInvitationToken, isCompanyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertResendConfigured, sendInvitationEmail } from '@/lib/resend';

const invitationLifetime = 7 * 24 * 60 * 60 * 1000;

function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return new URL(configured).origin;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}` : 'http://localhost:3000';
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem convidar pessoas.' }, { status: 403 });

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados do convite inválidos.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: 'Informe e-mail e perfil para o convite.' }, { status: 400 });
    }
    const email = 'email' in input && typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const role = 'role' in input ? input.role : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !isCompanyRole(role)) {
      return NextResponse.json({ error: 'Informe um e-mail válido e um perfil de acesso.' }, { status: 400 });
    }

    try {
      assertResendConfigured();
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'O serviço de e-mail não está configurado.' }, { status: 503 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, memberships: { where: { companyId: user.companyId }, select: { id: true } } },
    });
    if (existingUser?.memberships.length) return NextResponse.json({ error: 'Esta pessoa já faz parte da empresa.' }, { status: 409 });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + invitationLifetime);
    const invitation = await prisma.invitation.upsert({
      where: { companyId_email: { companyId: user.companyId, email } },
      create: { companyId: user.companyId, invitedById: user.id, email, role, tokenHash, expiresAt },
      update: { invitedById: user.id, role, tokenHash, expiresAt, acceptedAt: null },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    try {
      await sendInvitationEmail({
        recipient: email,
        companyName: user.companyName,
        inviterName: user.fullName,
        role,
        url: `${appOrigin()}/convite?token=${encodeURIComponent(token)}`,
      });
    } catch (error) {
      await prisma.invitation.deleteMany({ where: { id: invitation.id, tokenHash } });
      console.error('Falha ao enviar convite da empresa:', error);
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Não foi possível enviar o convite por e-mail.',
      }, { status: 502 });
    }

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar convite:', error);
    return NextResponse.json({ error: 'Não foi possível criar o convite.' }, { status: 500 });
  }
}
