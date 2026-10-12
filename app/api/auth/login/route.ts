import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Informe os dados de acesso em um formato válido.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: 'Informe o e-mail e a senha.' }, { status: 400 });
    }
    const email = 'email' in input && typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = 'password' in input && typeof input.password === 'string' ? input.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Informe o e-mail e a senha.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { select: { companyId: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (!user) {
      return NextResponse.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 });
    }
    if (!user.memberships[0]) {
      console.error(`Conta ${user.id} não possui uma associação empresarial.`);
      return NextResponse.json({ error: 'A conta ainda não está associada a uma empresa.' }, { status: 403 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 });
    }

    const response = NextResponse.json({
      message: 'Login realizado com sucesso!',
      user: { id: user.id, fullName: user.fullName, email: user.email }
    });
    setSessionCookie(response, user.id, user.memberships[0].companyId);
    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}