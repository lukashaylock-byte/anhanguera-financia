import { NextResponse } from 'next/server';
import { getAuthenticatedUser, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados da empresa inválidos.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input) || !('companyId' in input) || typeof input.companyId !== 'string') {
      return NextResponse.json({ error: 'Selecione uma empresa válida.' }, { status: 400 });
    }
    const membership = await prisma.membership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: input.companyId } },
      select: { companyId: true },
    });
    if (!membership) return NextResponse.json({ error: 'Você não tem acesso a esta empresa.' }, { status: 403 });

    const response = NextResponse.json({ message: 'Empresa alterada.' });
    setSessionCookie(response, user.id, membership.companyId);
    return response;
  } catch (error) {
    console.error('Erro ao trocar empresa ativa:', error);
    return NextResponse.json({ error: 'Não foi possível trocar de empresa.' }, { status: 500 });
  }
}
