import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { hashInvitationToken, isCompanyRole, isUniqueConstraintError, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json({ error: 'Envie os dados em um formato válido.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return NextResponse.json({ error: 'Dados de cadastro inválidos.' }, { status: 400 });
    const token = 'token' in input && typeof input.token === 'string' ? input.token : '';
    const fullName = 'fullName' in input && typeof input.fullName === 'string' ? input.fullName.trim() : '';
    const email = 'email' in input && typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = 'password' in input && typeof input.password === 'string' ? input.password : '';
    const cpf = 'cpf' in input && typeof input.cpf === 'string' ? input.cpf.replace(/\D/g, '') : '';
    const birthDate = 'birthDate' in input && typeof input.birthDate === 'string' ? input.birthDate : '';
    if (!token || !fullName || !email || !password || !cpf || !birthDate) return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
    if (fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: 'Confira seu nome e e-mail.' }, { status: 400 });
    if (password.length < 8 || password.length > 72) return NextResponse.json({ error: 'A senha deve ter entre 8 e 72 caracteres.' }, { status: 400 });
    if (!isValidCpf(cpf)) return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    const parsedBirthDate = new Date(`${birthDate}T12:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(parsedBirthDate.getTime()) ||
      parsedBirthDate.toISOString().slice(0, 10) !== birthDate || parsedBirthDate >= new Date()) {
      return NextResponse.json({ error: 'Informe uma data de nascimento válida.' }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: { id: true, email: true, companyId: true, role: true, acceptedAt: true, expiresAt: true },
    });
    if (!invitation || invitation.acceptedAt) return NextResponse.json({ error: 'Este convite não está mais disponível.' }, { status: 404 });
    if (invitation.expiresAt <= new Date()) return NextResponse.json({ error: 'Este convite expirou. Peça ao administrador para enviar outro.' }, { status: 410 });
    if (invitation.email.toLowerCase() !== email) return NextResponse.json({ error: `Este convite foi enviado para ${invitation.email}.` }, { status: 403 });
    if (!isCompanyRole(invitation.role)) return NextResponse.json({ error: 'O perfil deste convite não é válido.' }, { status: 409 });

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const createdUser = await prisma.$transaction(async (transaction) => {
      const accepted = await transaction.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (!accepted.count) throw new Error('INVITATION_NO_LONGER_AVAILABLE');
      const newUser = await transaction.user.create({
        data: { fullName, email, password: hashedPassword, cpf, birthDate: parsedBirthDate },
        select: { id: true, fullName: true, email: true },
      });
      await transaction.membership.create({
        data: { userId: newUser.id, companyId: invitation.companyId, role: invitation.role },
      });
      return newUser;
    });

    const response = NextResponse.json({ message: 'Conta criada e convite aceito.' }, { status: 201 });
    setSessionCookie(response, createdUser.id, invitation.companyId);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITATION_NO_LONGER_AVAILABLE') {
      return NextResponse.json({ error: 'Este convite foi aceito ou expirou.' }, { status: 409 });
    }
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: 'Este e-mail ou CPF já está cadastrado. Entre na sua conta para aceitar o convite.' }, { status: 409 });
    console.error('Erro ao criar conta pelo convite:', error);
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro pelo convite.' }, { status: 500 });
  }
}
