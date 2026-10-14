import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ invitationId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.workspaceType !== 'EMPRESA' || user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'Somente administradores podem cancelar convites.' }, { status: 403 });
    }
    const { invitationId } = await context.params;
    const result = await prisma.invitation.deleteMany({
      where: { id: invitationId, companyId: user.companyId, acceptedAt: null },
    });
    if (!result.count) return NextResponse.json({ error: 'Convite não encontrado ou já utilizado.' }, { status: 404 });
    return NextResponse.json({ message: 'Convite cancelado.' });
  } catch (error) {
    console.error('Erro ao cancelar convite:', error);
    return NextResponse.json({ error: 'Não foi possível cancelar o convite.' }, { status: 500 });
  }
}
