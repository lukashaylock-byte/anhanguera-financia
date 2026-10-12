import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isUniqueConstraintError, setSessionCookie } from '@/lib/auth';

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
    const email = 'email' in input && typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = 'password' in input && typeof input.password === 'string' ? input.password : '';
    const cpf = 'cpf' in input && typeof input.cpf === 'string' ? input.cpf.replace(/\D/g, '') : '';
    const birthDate = 'birthDate' in input && typeof input.birthDate === 'string' ? input.birthDate : '';
    const companyName = 'companyName' in input && typeof input.companyName === 'string'
      ? input.companyName.trim()
      : `${fullName} - Empresa`;

    if (!fullName || !email || !password || !cpf || !birthDate || !companyName) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios, incluindo o nome da empresa.' }, { status: 400 });
    }
    if (fullName.length > 120 || companyName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Confira o nome, o nome da empresa e o endereço de e-mail.' }, { status: 400 });
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          fullName,
          email,
          password: hashedPassword,
          cpf,
          birthDate: parsedBirthDate,
        },
      });
      const company = await transaction.company.create({ data: { name: companyName } });
      await transaction.membership.create({
        data: { userId: createdUser.id, companyId: company.id, role: 'ADMINISTRADOR' },
      });
      return { ...createdUser, companyId: company.id };
    });

    const response = NextResponse.json({ message: 'Conta criada com sucesso!', userId: user.id }, { status: 201 });
    setSessionCookie(response, user.id, user.companyId);
    return response;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Este e-mail ou CPF já está cadastrado.' }, { status: 409 });
    }
    console.error('Erro ao registrar:', error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}