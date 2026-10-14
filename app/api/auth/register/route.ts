import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { hashInvitationToken, isCompanyRole, isUniqueConstraintError, setSessionCookie } from '@/lib/auth';
import { emailLookupHash, encryptUserPersonalData, normalizeEmail, readInvitationEmail } from '@/lib/personal-data.mjs';
import { maxSignupAttempts, recordRateLimitAttempt } from '@/lib/login-rate-limit';

function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
  const digit = (length: number) => {
    const sum = cpf.slice(0, length).split('').reduce((total, number, index) => total + Number(number) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export async function POST(request: Request) {
  try {
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Envie os dados de cadastro em um formato válido.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: 'Dados de cadastro inválidos.' }, { status: 400 });
    }
    const fullName = 'fullName' in input && typeof input.fullName === 'string' ? input.fullName.trim() : '';
    const email = 'email' in input && typeof input.email === 'string' ? normalizeEmail(input.email) : '';
    const password = 'password' in input && typeof input.password === 'string' ? input.password : '';
    const cpf = 'cpf' in input && typeof input.cpf === 'string' ? input.cpf.replace(/\D/g, '') : '';
    const birthDate = 'birthDate' in input && typeof input.birthDate === 'string' ? input.birthDate : '';
    const invitationToken = 'invitationToken' in input && typeof input.invitationToken === 'string' ? input.invitationToken : '';
    const requestedWorkspaceType = 'workspaceType' in input ? input.workspaceType : 'EMPRESA';
    if (requestedWorkspaceType !== 'EMPRESA' && requestedWorkspaceType !== 'PESSOAL') {
      return NextResponse.json({ error: 'Selecione um tipo de espaço válido.' }, { status: 400 });
    }
    const workspaceType = invitationToken ? 'EMPRESA' : requestedWorkspaceType;
    const companyName = 'companyName' in input && typeof input.companyName === 'string'
      ? input.companyName.trim()
      : '';
    const workspaceName = workspaceType === 'PESSOAL' ? fullName : companyName;

    if (!fullName || !email || !password || !cpf || !birthDate || (!invitationToken && !workspaceName)) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400 });
    }
    if (
      fullName.length > 120 ||
      (!invitationToken && workspaceName.length > 120) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return NextResponse.json({ error: 'Confira o nome, o nome do espaço e o endereço de e-mail.' }, { status: 400 });
    }
    if (invitationToken && !/^[A-Za-z0-9_-]{40,60}$/.test(invitationToken)) {
      return NextResponse.json({ error: 'Este convite é inválido ou expirou.' }, { status: 400 });
    }
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'A senha deve ter entre 8 e 72 caracteres.' }, { status: 400 });
    }
    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    }
    const parsedBirthDate = new Date(`${birthDate}T12:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      Number.isNaN(parsedBirthDate.getTime()) ||
      parsedBirthDate.toISOString().slice(0, 10) !== birthDate ||
      parsedBirthDate >= new Date()
    ) return NextResponse.json({ error: 'Informe uma data de nascimento válida.' }, { status: 400 });

    const signupLimit = await recordRateLimitAttempt('signup', email, 60 * 60);
    if (signupLimit.attempts > maxSignupAttempts) {
      return NextResponse.json({ error: 'Muitas tentativas de cadastro. Aguarde antes de tentar novamente.' }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(signupLimit.retryAfterSeconds) },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const account = await prisma.$transaction(async (transaction) => {
      let invitedCompanyId: string | null = null;
      let invitedRole: string | null = null;
      if (invitationToken) {
        const now = new Date();
        const invitation = await transaction.invitation.findUnique({
          where: { tokenHash: hashInvitationToken(invitationToken) },
          select: {
            id: true,
            companyId: true,
            email: true,
            emailEncrypted: true,
            emailLookupHash: true,
            role: true,
            expiresAt: true,
            acceptedAt: true,
          },
        });
        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.expiresAt <= now ||
          !isCompanyRole(invitation.role)
        ) throw new Error('INVITATION_INVALID');
        if (invitation.emailLookupHash !== emailLookupHash(email) || readInvitationEmail(invitation) !== email) {
          throw new Error('INVITATION_EMAIL_MISMATCH');
        }
        const claim = await transaction.invitation.updateMany({
          where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now },
        });
        if (!claim.count) throw new Error('INVITATION_INVALID');
        invitedCompanyId = invitation.companyId;
        invitedRole = invitation.role;
      }

      const id = randomUUID();
      const createdUser = await transaction.user.create({
        data: {
          id,
          password: hashedPassword,
          ...encryptUserPersonalData(id, { fullName, email, cpf, birthDate: parsedBirthDate }),
        },
      });
      if (invitedCompanyId && invitedRole) {
        await transaction.membership.create({
          data: { userId: createdUser.id, companyId: invitedCompanyId, role: invitedRole },
        });
        return { ...createdUser, companyId: invitedCompanyId };
      }
      const company = await transaction.company.create({ data: { name: workspaceName, workspaceType } });
      await transaction.membership.create({
        data: { userId: createdUser.id, companyId: company.id, role: 'ADMINISTRADOR' },
      });
      return { ...createdUser, companyId: company.id };
    });

    const response = NextResponse.json({ message: 'Conta criada com sucesso!', userId: account.id }, { status: 201 });
    setSessionCookie(response, account.id, account.companyId);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITATION_INVALID') {
      return NextResponse.json({ error: 'Este convite é inválido, já foi aceito ou expirou.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'INVITATION_EMAIL_MISMATCH') {
      return NextResponse.json({ error: 'Use o mesmo e-mail para o qual este convite foi enviado.' }, { status: 403 });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Este e-mail ou CPF já está cadastrado.' }, { status: 409 });
    }
    console.error('Erro ao registrar:', error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}