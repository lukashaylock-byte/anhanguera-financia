import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readUserProfile } from '@/lib/personal-data.mjs';

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
    return NextResponse.json({
      company: { id: user.companyId, name: user.companyName },
      memberships: memberships.map((membership) => ({
        ...membership,
        user: { id: membership.user.id, ...readUserProfile(membership.user) },
      })),
    });
  } catch (error) {
    console.error('Erro ao carregar a equipe:', error);
    return NextResponse.json({ error: 'Não foi possível carregar a equipe da empresa.' }, { status: 500 });
  }
}
