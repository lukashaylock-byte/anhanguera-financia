import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.workspaceType !== 'EMPRESA') return NextResponse.json({ error: 'Esta configuração está disponível apenas em espaços empresariais.' }, { status: 403 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem alterar os dados da empresa.' }, { status: 403 });

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados da empresa inválidos.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input) || !('name' in input) || typeof input.name !== 'string') {
      return NextResponse.json({ error: 'Informe o nome da empresa.' }, { status: 400 });
    }
    const name = input.name.trim();
    if (!name || name.length > 120) return NextResponse.json({ error: 'O nome deve ter entre 1 e 120 caracteres.' }, { status: 400 });

    const company = await prisma.company.update({
      where: { id: user.companyId },
      data: { name },
      select: { id: true, name: true },
    });
    return NextResponse.json({ company });
  } catch (error) {
    console.error('Erro ao atualizar dados da empresa:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar a empresa.' }, { status: 500 });
  }
}
