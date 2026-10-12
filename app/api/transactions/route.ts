import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const transactionTypes = ['RECEITA', 'DESPESA'] as const;
const allowedCategories = ['Salário', 'Vendas', 'Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Serviços', 'Outros'];

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isTransactionType(value: unknown): value is typeof transactionTypes[number] {
  return typeof value === 'string' && transactionTypes.includes(value as typeof transactionTypes[number]);
}

function isAllowedCategory(value: unknown): value is string {
  return typeof value === 'string' && allowedCategories.includes(value);
}

function validTransaction(input: Record<string, unknown>) {
  const amount = Number(input.amount);
  const date = typeof input.date === 'string' ? new Date(`${input.date}T12:00:00.000Z`) : new Date(Number.NaN);
  const validDate = typeof input.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.date) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === input.date;

  return {
    description: typeof input.description === 'string' ? input.description.trim() : '',
    amount,
    type: input.type,
    category: input.category,
    date,
    validDate,
  };
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, description: true, amount: true, type: true, category: true, date: true },
    });
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Erro ao listar lançamentos:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os lançamentos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados do lançamento inválidos.' }, { status: 400 });
    }
    if (!isRecord(input)) {
      return NextResponse.json({ error: 'Dados do lançamento inválidos.' }, { status: 400 });
    }
    const values = validTransaction(input);
    if (
      !values.description || values.description.length > 120 ||
      !Number.isFinite(values.amount) || values.amount <= 0 || values.amount > 999999999 ||
      !isTransactionType(values.type) ||
      !isAllowedCategory(values.category) || !values.validDate
    ) return NextResponse.json({ error: 'Confira a descrição, o valor, a categoria e a data.' }, { status: 400 });

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        description: values.description,
        amount: values.amount,
        type: values.type,
        category: values.category,
        date: values.date,
      },
      select: { id: true, description: true, amount: true, type: true, category: true, date: true },
    });
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar lançamento:', error);
    return NextResponse.json({ error: 'Não foi possível salvar o lançamento.' }, { status: 500 });
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
      return NextResponse.json({ error: 'Dados do lançamento inválidos.' }, { status: 400 });
    }
    if (!isRecord(input) || typeof input.id !== 'string') {
      return NextResponse.json({ error: 'Identificador do lançamento inválido.' }, { status: 400 });
    }
    const values = validTransaction(input);
    if (
      !values.description || values.description.length > 120 ||
      !Number.isFinite(values.amount) || values.amount <= 0 || values.amount > 999999999 ||
      !isTransactionType(values.type) ||
      !isAllowedCategory(values.category) || !values.validDate
    ) return NextResponse.json({ error: 'Confira a descrição, o valor, a categoria e a data.' }, { status: 400 });

    const result = await prisma.transaction.updateMany({
      where: { id: input.id, userId: user.id },
      data: {
        description: values.description,
        amount: values.amount,
        type: values.type,
        category: values.category,
        date: values.date,
      },
    });
    if (!result.count) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
    return NextResponse.json({ message: 'Lançamento atualizado.' });
  } catch (error) {
    console.error('Erro ao atualizar lançamento:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o lançamento.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Identificador do lançamento inválido.' }, { status: 400 });
    }
    if (!isRecord(input) || typeof input.id !== 'string') {
      return NextResponse.json({ error: 'Identificador do lançamento inválido.' }, { status: 400 });
    }
    const result = await prisma.transaction.deleteMany({ where: { id: input.id, userId: user.id } });
    if (!result.count) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
    return NextResponse.json({ message: 'Lançamento excluído.' });
  } catch (error) {
    console.error('Erro ao excluir lançamento:', error);
    return NextResponse.json({ error: 'Não foi possível excluir o lançamento.' }, { status: 500 });
  }
}
