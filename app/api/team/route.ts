import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem gerenciar a equipe.' }, { status: 403 });

    const [memberships, invitations] = await Promise.all([
      prisma.membership.findMany({
        where: { companyId: user.companyId },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.invitation.findMany({
        where: { companyId: user.companyId, acceptedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ company: { id: user.companyId, name: user.companyName }, memberships, invitations });
  } catch (error) {
    console.error('Erro ao carregar a equipe:', error);
    return NextResponse.json({ error: 'Não foi possível carregar a equipe da empresa.' }, { status: 500 });
  }
}
