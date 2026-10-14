import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPasswordResetToken } from '@/lib/auth';
import { maxPasswordResetAttempts, recordRateLimitAttempt } from '@/lib/login-rate-limit';
import { emailLookupHash, normalizeEmail, readUserProfile } from '@/lib/personal-data.mjs';

const resetTokenLifetimeMs = 60 * 60 * 1000;

function getResetConfiguration() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.APP_URL;
  if (!apiKey || !from || !appUrl) {
    throw new Error('Configure RESEND_API_KEY, RESEND_FROM_EMAIL e APP_URL para habilitar a recuperação de senha.');
  }

  const url = new URL(appUrl);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) {
    throw new Error('APP_URL deve usar HTTPS em produção.');
  }
  return { apiKey, from, appUrl: url.origin };
}

async function sendResetEmail(to: string, resetUrl: string) {
  const { apiKey, from } = getResetConfiguration();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Redefina sua senha | Anhanguera Financia',
      html: `<p>Recebemos uma solicitação para redefinir a senha da sua conta no Anhanguera Financia.</p><p><a href="${resetUrl}">Criar uma nova senha</a></p><p>Este link expira em 1 hora e só pode ser usado uma vez. Se você não solicitou a redefinição, ignore este e-mail.</p>`,
      text: `Recebemos uma solicitação para redefinir a senha da sua conta no Anhanguera Financia.\n\nAcesse este link para criar uma nova senha: ${resetUrl}\n\nO link expira em 1 hora e só pode ser usado uma vez. Se você não solicitou a redefinição, ignore este e-mail.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`O Resend recusou o envio do e-mail (HTTP ${response.status}).`);
}

export async function POST(request: Request) {
  try {
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Informe um endereço de e-mail válido.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input) || !('email' in input) || typeof input.email !== 'string') {
      return NextResponse.json({ error: 'Informe um endereço de e-mail válido.' }, { status: 400 });
    }

    const email = normalizeEmail(input.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Informe um endereço de e-mail válido.' }, { status: 400 });
    }

    const { appUrl } = getResetConfiguration();
    const attempt = await recordRateLimitAttempt('password-reset', email, 60 * 60);
    if (attempt.attempts > maxPasswordResetAttempts) {
      return NextResponse.json({ error: 'Muitas solicitações. Aguarde antes de tentar novamente.' }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(attempt.retryAfterSeconds) },
      });
    }

    const user = await prisma.user.findUnique({
      where: { emailLookupHash: emailLookupHash(email) },
      select: { id: true, fullName: true, fullNameEncrypted: true, email: true, emailEncrypted: true },
    }) ?? await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, fullName: true, fullNameEncrypted: true, email: true, emailEncrypted: true },
    });

    if (user) {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashPasswordResetToken(rawToken);
      const expiresAt = new Date(Date.now() + resetTokenLifetimeMs);
      await prisma.$transaction(async (transaction) => {
        await transaction.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await transaction.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt },
        });
      });

      const resetUrl = new URL('/redefinir-senha', appUrl);
      resetUrl.searchParams.set('token', rawToken);
      try {
        await sendResetEmail(readUserProfile(user).email, resetUrl.toString());
      } catch (error) {
        await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
        console.error('Não foi possível enviar o e-mail de recuperação de senha:', error);
        return NextResponse.json({ error: 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.' }, {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    }

    return NextResponse.json({
      message: 'Se houver uma conta associada a esse e-mail, enviaremos um link para redefinir sua senha.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao solicitar redefinição de senha:', error);
    return NextResponse.json({ error: 'Não foi possível processar a solicitação. Tente novamente mais tarde.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
