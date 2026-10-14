import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getAuthenticatedUser, isCompanyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailLookupHash, normalizeEmail, readInvitationEmail, readUserProfile } from '@/lib/personal-data.mjs';

async function lockCompany(transaction: Prisma.TransactionClient, companyId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE`;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.workspaceType !== 'EMPRESA') return NextResponse.json({ error: 'A gestão de equipe está disponível apenas em espaços empresariais.' }, { status: 403 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem gerenciar a equipe.' }, { status: 403 });

    const memberships = await prisma.membership.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, fullNameEncrypted: true, email: true, emailEncrypted: true } },
      },
    });
    const invitations = await prisma.invitation.findMany({
      where: { companyId: user.companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        emailEncrypted: true,
        emailLookupHash: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      company: { id: user.companyId, name: user.companyName },
      memberships: memberships.map((membership) => ({
        ...membership,
        user: { id: membership.user.id, ...readUserProfile(membership.user) },
      })),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: readInvitationEmail(invitation),
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })),
    });
  } catch (error) {
    console.error('Erro ao carregar a equipe:', error);
    return NextResponse.json({ error: 'Não foi possível carregar a equipe da empresa.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.workspaceType !== 'EMPRESA') return NextResponse.json({ error: 'A gestão de equipe está disponível apenas em espaços empresariais.' }, { status: 403 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem adicionar membros.' }, { status: 403 });

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados do membro inválidos.' }, { status: 400 });
    }
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      !('email' in input) ||
      typeof input.email !== 'string' ||
      !('role' in input) ||
      !isCompanyRole(input.role)
    ) {
      return NextResponse.json({ error: 'Informe um e-mail e um perfil de acesso válidos.' }, { status: 400 });
    }

    const role = input.role;
    const email = normalizeEmail(input.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Informe um endereço de e-mail válido.' }, { status: 400 });
    }

    await prisma.$transaction(async (transaction) => {
      await lockCompany(transaction, user.companyId);
      const actor = await transaction.membership.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: user.companyId } },
        select: { role: true },
      });
      if (actor?.role !== 'ADMINISTRADOR') throw new Error('ACTOR_NOT_ADMIN');

      const member = await transaction.user.findUnique({
        where: { emailLookupHash: emailLookupHash(email) },
        select: { id: true },
      }) ?? await transaction.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!member) throw new Error('USER_NOT_FOUND');

      const existingMembership = await transaction.membership.findUnique({
        where: { userId_companyId: { userId: member.id, companyId: user.companyId } },
        select: { id: true },
      });
      if (existingMembership) throw new Error('ALREADY_MEMBER');

      await transaction.membership.create({
        data: { userId: member.id, companyId: user.companyId, role },
      });
    });

    return NextResponse.json({ message: 'Membro adicionado à empresa.' }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ACTOR_NOT_ADMIN') {
        return NextResponse.json({ error: 'Somente administradores podem adicionar membros.' }, { status: 403 });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return NextResponse.json({ error: 'Não encontramos uma conta cadastrada com esse e-mail.' }, { status: 404 });
      }
      if (error.message === 'ALREADY_MEMBER') {
        return NextResponse.json({ error: 'Essa pessoa já tem acesso à empresa.' }, { status: 409 });
      }
    }
    console.error('Erro ao adicionar membro à equipe:', error);
    return NextResponse.json({ error: 'Não foi possível adicionar o membro.' }, { status: 500 });
  }
}
