import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getAuthenticatedUser, hashInvitationToken, isCompanyRole } from '@/lib/auth';
import { isEmailDeliveryConfigured, getPublicAppUrl, sendAppEmail, escapeHtml } from '@/lib/email';
import { maxInvitationAttempts, maxInvitationEmailsPerAdmin, recordRateLimitAttempt } from '@/lib/login-rate-limit';
import { encryptInvitationEmail, emailLookupHash, normalizeEmail } from '@/lib/personal-data.mjs';
import { prisma } from '@/lib/prisma';

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

async function lockCompany(transaction: Prisma.TransactionClient, companyId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE`;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.workspaceType !== 'EMPRESA' || user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'Somente administradores podem convidar pessoas para a empresa.' }, { status: 403 });
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados do convite inválidos.' }, { status: 400 });
    }
    const role = typeof input === 'object' && input !== null && !Array.isArray(input) && 'role' in input && isCompanyRole(input.role)
      ? input.role
      : null;
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      !('email' in input) ||
      typeof input.email !== 'string' ||
      !role
    ) {
      return NextResponse.json({ error: 'Informe um e-mail e um perfil de acesso válidos.' }, { status: 400 });
    }

    const email = normalizeEmail(input.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Informe um endereço de e-mail válido.' }, { status: 400 });
    }
    if (email === user.email) {
      return NextResponse.json({ error: 'Você já tem acesso a esta empresa.' }, { status: 409 });
    }
    const publicAppUrl = getPublicAppUrl(request.url);

    const emailHash = emailLookupHash(email);
    const [adminLimit, emailLimit] = await Promise.all([
      recordRateLimitAttempt('team-invite-admin', user.id, 24 * 60 * 60),
      recordRateLimitAttempt('team-invite-email', `${user.companyId}:${emailHash}`, 24 * 60 * 60),
    ]);
    if (adminLimit.attempts > maxInvitationEmailsPerAdmin || emailLimit.attempts > maxInvitationAttempts) {
      const retryAfter = Math.max(adminLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
      return NextResponse.json({ error: 'Limite de convites atingido. Aguarde antes de tentar novamente.' }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) },
      });
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + invitationLifetimeMs);
    const invitation = await prisma.$transaction(async (transaction) => {
      await lockCompany(transaction, user.companyId);
      const actor = await transaction.membership.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: user.companyId } },
        select: { role: true },
      });
      if (actor?.role !== 'ADMINISTRADOR') throw new Error('ACTOR_NOT_ADMIN');

      const existingMember = await transaction.user.findUnique({
        where: { emailLookupHash: emailHash },
        select: { id: true },
      }) ?? await transaction.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existingMember && await transaction.membership.findUnique({
        where: { userId_companyId: { userId: existingMember.id, companyId: user.companyId } },
        select: { id: true },
      })) throw new Error('ALREADY_MEMBER');

      return transaction.invitation.upsert({
        where: { companyId_emailLookupHash: { companyId: user.companyId, emailLookupHash: emailHash } },
        create: {
          companyId: user.companyId,
          invitedById: user.id,
          ...encryptInvitationEmail(emailHash, email),
          role,
          tokenHash,
          expiresAt,
        },
        update: {
          invitedById: user.id,
          ...encryptInvitationEmail(emailHash, email),
          role,
          tokenHash,
          expiresAt,
          acceptedAt: null,
          createdAt: new Date(),
        },
        select: { id: true },
      });
    });

    const inviteUrl = new URL('/convite', publicAppUrl);
    inviteUrl.searchParams.set('token', rawToken);
    let emailSent = false;
    if (isEmailDeliveryConfigured()) {
      try {
        const safeCompanyName = escapeHtml(user.companyName);
        const safeRole = escapeHtml(role);
        await sendAppEmail({
          to: email,
          subject: `Convite para ${user.companyName} | Anhanguera Financia`,
          html: `<p>Você foi convidado(a) para acessar as finanças de <strong>${safeCompanyName}</strong> como <strong>${safeRole}</strong>.</p><p><a href="${inviteUrl}">Criar sua conta e aceitar o convite</a></p><p>Este convite expira em 7 dias e só pode ser aceito pelo e-mail convidado.</p>`,
          text: `Você foi convidado(a) para acessar as finanças de ${user.companyName} como ${role}.\n\nAcesse ${inviteUrl} para criar sua conta e aceitar o convite. O convite expira em 7 dias e só pode ser aceito pelo e-mail convidado.`,
        });
        emailSent = true;
      } catch (error) {
        console.error('Não foi possível enviar o convite por e-mail:', error);
      }
    }

    return NextResponse.json({
      message: emailSent
        ? 'Convite enviado por e-mail.'
        : 'Convite criado. O envio de e-mail não está disponível; compartilhe o link seguro abaixo.',
      invitationId: invitation.id,
      invitationUrl: inviteUrl.toString(),
      emailSent,
      expiresAt,
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTOR_NOT_ADMIN') {
      return NextResponse.json({ error: 'Somente administradores podem convidar pessoas para a empresa.' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'ALREADY_MEMBER') {
      return NextResponse.json({ error: 'Essa pessoa já tem acesso à empresa.' }, { status: 409 });
    }
    console.error('Erro ao criar convite da equipe:', error);
    return NextResponse.json({ error: 'Não foi possível criar o convite. Verifique a configuração e tente novamente.' }, { status: 500 });
  }
}
