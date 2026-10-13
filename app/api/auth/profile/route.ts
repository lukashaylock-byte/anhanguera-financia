import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthenticatedUser, isUniqueConstraintError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptUserPersonalData, normalizeEmail, readUserPersonalData } from '@/lib/personal-data.mjs';
import { clearRateLimit, maxLoginAttempts, recordRateLimitAttempt } from '@/lib/login-rate-limit';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        fullName: true,
        fullNameEncrypted: true,
        email: true,
        emailEncrypted: true,
        emailLookupHash: true,
        cpf: true,
        cpfEncrypted: true,
        cpfLookupHash: true,
        birthDate: true,
        birthDateEncrypted: true,
        createdAt: true,
      },
    });
    if (!record) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });

    const personalData = readUserPersonalData(record);
    return NextResponse.json({
      profile: {
        id: record.id,
        fullName: personalData.fullName,
        email: personalData.email,
        cpf: `•••.•••.${personalData.cpf.slice(6, 9)}-${personalData.cpf.slice(-2)}`,
        birthDate: personalData.birthDate.slice(0, 10),
        createdAt: record.createdAt.toISOString(),
        workspaces: user.workspaces,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao consultar o perfil:', error);
    return NextResponse.json({ error: 'Não foi possível carregar seu perfil.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados do perfil inválidos.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: 'Dados do perfil inválidos.' }, { status: 400 });
    }

    const currentPassword = 'currentPassword' in input && typeof input.currentPassword === 'string'
      ? input.currentPassword
      : '';
    const fullName = 'fullName' in input && typeof input.fullName === 'string'
      ? input.fullName.trim()
      : undefined;
    const email = 'email' in input && typeof input.email === 'string'
      ? normalizeEmail(input.email)
      : undefined;
    const newPassword = 'newPassword' in input && typeof input.newPassword === 'string'
      ? input.newPassword
      : '';
    const confirmNewPassword = 'confirmNewPassword' in input && typeof input.confirmNewPassword === 'string'
      ? input.confirmNewPassword
      : '';

    if (!currentPassword || currentPassword.length > 72) {
      return NextResponse.json({ error: 'Informe sua senha atual para confirmar as alterações.' }, { status: 400 });
    }
    if (fullName !== undefined && (!fullName || fullName.length > 120)) {
      return NextResponse.json({ error: 'O nome deve ter entre 1 e 120 caracteres.' }, { status: 400 });
    }
    if (email !== undefined && (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )) {
      return NextResponse.json({ error: 'Informe um endereço de e-mail válido.' }, { status: 400 });
    }
    if (newPassword && (newPassword.length < 8 || newPassword.length > 72)) {
      return NextResponse.json({ error: 'A nova senha deve ter entre 8 e 72 caracteres.' }, { status: 400 });
    }
    if (newPassword && newPassword !== confirmNewPassword) {
      return NextResponse.json({ error: 'A confirmação da nova senha não confere.' }, { status: 400 });
    }
    if (!newPassword && confirmNewPassword) {
      return NextResponse.json({ error: 'Informe uma nova senha para confirmar.' }, { status: 400 });
    }
    if (fullName === undefined && email === undefined && !newPassword) {
      return NextResponse.json({ error: 'Informe ao menos uma alteração para salvar.' }, { status: 400 });
    }

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        password: true,
        fullName: true,
        fullNameEncrypted: true,
        email: true,
        emailEncrypted: true,
        emailLookupHash: true,
        cpf: true,
        cpfEncrypted: true,
        cpfLookupHash: true,
        birthDate: true,
        birthDateEncrypted: true,
      },
    });
    if (!record) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
    let attempt: Awaited<ReturnType<typeof recordRateLimitAttempt>>;
    try {
      attempt = await recordRateLimitAttempt('profile-update', user.id, 15 * 60);
    } catch (error) {
      console.error('Não foi possível verificar as tentativas de alteração de perfil:', error);
      return NextResponse.json({ error: 'A atualização está temporariamente indisponível. Tente novamente.' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (attempt.attempts > maxLoginAttempts) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(attempt.retryAfterSeconds) },
      });
    }
    if (!await bcrypt.compare(currentPassword, record.password)) {
      return NextResponse.json({ error: 'A senha atual está incorreta.' }, { status: 401 });
    }

    const personalData = readUserPersonalData(record);
    const nextFullName = fullName ?? personalData.fullName;
    const nextEmail = email ?? personalData.email;
    const encryptedData = encryptUserPersonalData(record.id, {
      ...personalData,
      fullName: nextFullName,
      email: nextEmail,
    });

    await prisma.user.update({
      where: { id: record.id },
      data: {
        ...encryptedData,
        ...(newPassword ? { password: await bcrypt.hash(newPassword, 12) } : {}),
      },
    });
    await clearRateLimit(attempt.id);

    return NextResponse.json({
      message: newPassword ? 'Perfil e senha atualizados com sucesso.' : 'Perfil atualizado com sucesso.',
      profile: { fullName: nextFullName, email: nextEmail },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Este e-mail já está associado a outra conta.' }, { status: 409 });
    }
    console.error('Erro ao atualizar o perfil:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar seu perfil.' }, { status: 500 });
  }
}
