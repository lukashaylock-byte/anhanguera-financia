import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { hashPasswordResetToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Os dados enviados são inválidos.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: 'Os dados enviados são inválidos.' }, { status: 400 });
    }

    const token = 'token' in input && typeof input.token === 'string' ? input.token : '';
    const password = 'password' in input && typeof input.password === 'string' ? input.password : '';
    const confirmPassword = 'confirmPassword' in input && typeof input.confirmPassword === 'string' ? input.confirmPassword : '';
    if (!token || token.length > 100) {
      return NextResponse.json({ error: 'O link de redefinição é inválido ou expirou.' }, { status: 400 });
    }
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'A nova senha deve ter entre 8 e 72 caracteres.' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'A confirmação da nova senha não confere.' }, { status: 400 });
    }

    const tokenHash = hashPasswordResetToken(token);
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const used = await prisma.$transaction(async (transaction) => {
      const resetToken = await transaction.passwordResetToken.findFirst({
        where: { tokenHash, expiresAt: { gt: now } },
        select: { id: true, userId: true },
      });
      if (!resetToken) return false;

      const claim = await transaction.passwordResetToken.deleteMany({
        where: { id: resetToken.id, tokenHash, expiresAt: { gt: now } },
      });
      if (!claim.count) return false;

      await transaction.user.update({
        where: { id: resetToken.userId },
        data: { password: passwordHash },
      });
      await transaction.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } });
      return true;
    });

    if (!used) {
      return NextResponse.json({ error: 'O link de redefinição é inválido ou expirou.' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Senha redefinida. Você já pode entrar com sua nova senha.' }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return NextResponse.json({ error: 'Não foi possível redefinir a senha agora. Tente novamente mais tarde.' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
