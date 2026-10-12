import { NextResponse } from 'next/server';
import { getAuthenticatedUser, isCompanyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ membershipId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
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
    const { membershipId } = await context.params;
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, companyId: user.companyId },
      select: { id: true, userId: true, role: true },
    });
    if (!membership) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    if (membership.userId === user.id) return NextResponse.json({ error: 'Para evitar perder o acesso, não é possível alterar seu próprio perfil.' }, { status: 400 });
    if (membership.role === 'ADMINISTRADOR' && input.role !== 'ADMINISTRADOR') {
      const adminCount = await prisma.membership.count({ where: { companyId: user.companyId, role: 'ADMINISTRADOR' } });
      if (adminCount <= 1) return NextResponse.json({ error: 'A empresa precisa manter pelo menos um administrador.' }, { status: 409 });
    }

    await prisma.membership.update({ where: { id: membership.id }, data: { role: input.role } });
    return NextResponse.json({ message: 'Perfil atualizado.' });
  } catch (error) {
    console.error('Erro ao atualizar perfil da equipe:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o perfil.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem remover membros.' }, { status: 403 });

    const { membershipId } = await context.params;
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, companyId: user.companyId },
      select: { id: true, userId: true, role: true },
    });
    if (!membership) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    if (membership.userId === user.id) return NextResponse.json({ error: 'Não é possível remover seu próprio acesso.' }, { status: 400 });
    if (membership.role === 'ADMINISTRADOR') {
      const adminCount = await prisma.membership.count({ where: { companyId: user.companyId, role: 'ADMINISTRADOR' } });
      if (adminCount <= 1) return NextResponse.json({ error: 'A empresa precisa manter pelo menos um administrador.' }, { status: 409 });
    }

    await prisma.membership.delete({ where: { id: membership.id } });
    return NextResponse.json({ message: 'Membro removido da empresa.' });
  } catch (error) {
    console.error('Erro ao remover membro da equipe:', error);
    return NextResponse.json({ error: 'Não foi possível remover o membro.' }, { status: 500 });
  }
}
