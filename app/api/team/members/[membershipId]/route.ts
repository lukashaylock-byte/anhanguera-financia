import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getAuthenticatedUser, isCompanyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ membershipId: string }> };
type ManagementFailure = { error: string; status: number };

function managementFailure(error: unknown): ManagementFailure | null {
  if (!(error instanceof Error)) return null;
  const failures: Record<string, ManagementFailure> = {
    ACTOR_NOT_ADMIN: { error: 'Somente administradores podem gerenciar membros.', status: 403 },
    MEMBER_NOT_FOUND: { error: 'Membro não encontrado.', status: 404 },
    CANNOT_CHANGE_SELF: { error: 'Para evitar perder o acesso, não é possível alterar seu próprio perfil.', status: 400 },
    CANNOT_REMOVE_SELF: { error: 'Não é possível remover seu próprio acesso.', status: 400 },
    LAST_ADMIN: { error: 'A empresa precisa manter pelo menos um administrador.', status: 409 },
  };
  return failures[error.message] ?? null;
}

async function lockCompany(transaction: Prisma.TransactionClient, companyId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE`;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.workspaceType !== 'EMPRESA') return NextResponse.json({ error: 'A gestão de equipe está disponível apenas em espaços empresariais.' }, { status: 403 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem alterar perfis.' }, { status: 403 });

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados do perfil inválidos.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input) || !('role' in input) || !isCompanyRole(input.role)) {
      return NextResponse.json({ error: 'Selecione um perfil de acesso válido.' }, { status: 400 });
    }
    const nextRole = input.role;
    const { membershipId } = await context.params;
    await prisma.$transaction(async (transaction) => {
      await lockCompany(transaction, user.companyId);
      const actor = await transaction.membership.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: user.companyId } },
        select: { role: true },
      });
      if (actor?.role !== 'ADMINISTRADOR') throw new Error('ACTOR_NOT_ADMIN');
      const membership = await transaction.membership.findFirst({
        where: { id: membershipId, companyId: user.companyId },
        select: { id: true, userId: true, role: true },
      });
      if (!membership) throw new Error('MEMBER_NOT_FOUND');
      if (membership.userId === user.id) throw new Error('CANNOT_CHANGE_SELF');
      if (membership.role === 'ADMINISTRADOR' && nextRole !== 'ADMINISTRADOR') {
        const adminCount = await transaction.membership.count({ where: { companyId: user.companyId, role: 'ADMINISTRADOR' } });
        if (adminCount <= 1) throw new Error('LAST_ADMIN');
      }
      await transaction.membership.update({ where: { id: membership.id }, data: { role: nextRole } });
    });
    return NextResponse.json({ message: 'Perfil atualizado.' });
  } catch (error) {
    const failure = managementFailure(error);
    if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status });
    console.error('Erro ao atualizar perfil da equipe:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o perfil.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.workspaceType !== 'EMPRESA') return NextResponse.json({ error: 'A gestão de equipe está disponível apenas em espaços empresariais.' }, { status: 403 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem remover membros.' }, { status: 403 });

    const { membershipId } = await context.params;
    await prisma.$transaction(async (transaction) => {
      await lockCompany(transaction, user.companyId);
      const actor = await transaction.membership.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: user.companyId } },
        select: { role: true },
      });
      if (actor?.role !== 'ADMINISTRADOR') throw new Error('ACTOR_NOT_ADMIN');
      const membership = await transaction.membership.findFirst({
        where: { id: membershipId, companyId: user.companyId },
        select: { id: true, userId: true, role: true },
      });
      if (!membership) throw new Error('MEMBER_NOT_FOUND');
      if (membership.userId === user.id) throw new Error('CANNOT_REMOVE_SELF');
      if (membership.role === 'ADMINISTRADOR') {
        const adminCount = await transaction.membership.count({ where: { companyId: user.companyId, role: 'ADMINISTRADOR' } });
        if (adminCount <= 1) throw new Error('LAST_ADMIN');
      }
      await transaction.membership.delete({ where: { id: membership.id } });
    });
    return NextResponse.json({ message: 'Membro removido da empresa.' });
  } catch (error) {
    const failure = managementFailure(error);
    if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status });
    console.error('Erro ao remover membro da equipe:', error);
    return NextResponse.json({ error: 'Não foi possível remover o membro.' }, { status: 500 });
  }
}
