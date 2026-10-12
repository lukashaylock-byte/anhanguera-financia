import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { clearRateLimit, maxLoginAttempts, recordLoginAttempt } from '@/lib/login-rate-limit';
import { emailLookupHash, encryptUserPersonalData, normalizeEmail, readUserPersonalData } from '@/lib/personal-data.mjs';

const dummyPasswordHash = '$2b$12$QmzSUHFkYYqr7YLGuSzUI.BKqOvrfi.EUua6oo2fwWaZsNSYu/Nay';

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
    const email = 'email' in input && typeof input.email === 'string' ? normalizeEmail(input.email) : '';
    const password = 'password' in input && typeof input.password === 'string' ? input.password : '';

    if (!email || email.length > 254 || !password || password.length > 72) {
      return NextResponse.json({ error: 'Confira o e-mail e a senha.' }, { status: 400 });
    }

    let attempt: Awaited<ReturnType<typeof recordLoginAttempt>>;
    try {
      attempt = await recordLoginAttempt(email);
    } catch (error) {
      console.error('Não foi possível verificar o limite de tentativas de login:', error);
      return NextResponse.json({ error: 'O login está temporariamente indisponível. Tente novamente.' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (attempt.attempts > maxLoginAttempts) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' }, {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(attempt.retryAfterSeconds),
        },
      });
    }

    const emailHash = emailLookupHash(email);
    const user = await prisma.user.findUnique({
      where: { emailLookupHash: emailHash },
      include: { memberships: { select: { companyId: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
    }) ?? await prisma.user.findUnique({
      where: { email },
      include: { memberships: { select: { companyId: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (!user) {
      await bcrypt.compare(password, dummyPasswordHash);
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

    const personalData = readUserPersonalData(user);
    if (!user.emailEncrypted || !user.emailLookupHash || !user.fullNameEncrypted || !user.cpfEncrypted || !user.cpfLookupHash || !user.birthDateEncrypted) {
      await prisma.user.update({
        where: { id: user.id },
        data: encryptUserPersonalData(user.id, {
          fullName: personalData.fullName,
          email: personalData.email,
          cpf: personalData.cpf,
          birthDate: personalData.birthDate,
        }),
      });
    }
    if (bcrypt.getRounds(user.password) < 12) {
      await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 12) } });
    }
    await clearRateLimit(attempt.id);
    const response = NextResponse.json({
      message: 'Login realizado com sucesso!',
      user: { id: user.id, fullName: personalData.fullName, email: personalData.email }
    });
    response.headers.set('Cache-Control', 'no-store');
    setSessionCookie(response, user.id, user.memberships[0].companyId);
    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}