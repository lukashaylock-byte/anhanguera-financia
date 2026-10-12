import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const transactionTypes = ['RECEITA', 'DESPESA'] as const;
const transactionStatuses = ['PENDENTE', 'PAGO'] as const;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isTransactionType(value: unknown): value is typeof transactionTypes[number] {
  return typeof value === 'string' && transactionTypes.includes(value as typeof transactionTypes[number]);
}

function isTransactionStatus(value: unknown): value is typeof transactionStatuses[number] {
  return typeof value === 'string' && transactionStatuses.includes(value as typeof transactionStatuses[number]);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function validTransaction(input: Record<string, unknown>) {
  const amount = Number(input.amount);
  const date = parseDate(input.date);
  const dueDate = parseDate(input.dueDate ?? input.date);
  return {
    description: typeof input.description === 'string' ? input.description.trim() : '',
    amount,
    type: input.type,
    category: typeof input.category === 'string' ? input.category.trim() : '',
    date,
    dueDate,
    status: input.status ?? 'PAGO',
    costCenter: typeof input.costCenter === 'string' ? input.costCenter.trim() : 'Geral',
  };
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

    const transactions = await prisma.transaction.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, description: true, amount: true, type: true, category: true, date: true, dueDate: true, status: true, costCenter: true },
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
    if (user.role === 'LEITURA') return NextResponse.json({ error: 'Seu perfil permite consultar, mas não alterar lançamentos.' }, { status: 403 });
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
      !values.category || values.category.length > 60 ||
      !values.date || !values.dueDate || !isTransactionStatus(values.status) ||
      !values.costCenter || values.costCenter.length > 80
    ) return NextResponse.json({ error: 'Confira a descrição, o valor, a categoria, o centro de custo e as datas.' }, { status: 400 });

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        description: values.description,
        amount: values.amount,
        type: values.type,
        category: values.category,
        date: values.date,
        dueDate: values.dueDate,
        status: values.status,
        costCenter: values.costCenter,
        companyId: user.companyId,
      },
      select: { id: true, description: true, amount: true, type: true, category: true, date: true, dueDate: true, status: true, costCenter: true },
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
    if (user.role === 'LEITURA') return NextResponse.json({ error: 'Seu perfil permite consultar, mas não alterar lançamentos.' }, { status: 403 });
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
      !values.category || values.category.length > 60 ||
      !values.date || !values.dueDate || !isTransactionStatus(values.status) ||
      !values.costCenter || values.costCenter.length > 80
    ) return NextResponse.json({ error: 'Confira a descrição, o valor, a categoria, o centro de custo e as datas.' }, { status: 400 });

    const result = await prisma.transaction.updateMany({
      where: { id: input.id, companyId: user.companyId },
      data: {
        description: values.description,
        amount: values.amount,
        type: values.type,
        category: values.category,
        date: values.date,
        dueDate: values.dueDate,
        status: values.status,
        costCenter: values.costCenter,
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
    if (user.role === 'LEITURA') return NextResponse.json({ error: 'Seu perfil permite consultar, mas não excluir lançamentos.' }, { status: 403 });
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Identificador do lançamento inválido.' }, { status: 400 });
    }
    if (!isRecord(input) || typeof input.id !== 'string') {
      return NextResponse.json({ error: 'Identificador do lançamento inválido.' }, { status: 400 });
    }
    const result = await prisma.transaction.deleteMany({ where: { id: input.id, companyId: user.companyId } });
    if (!result.count) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
    return NextResponse.json({ message: 'Lançamento excluído.' });
  } catch (error) {
    console.error('Erro ao excluir lançamento:', error);
    return NextResponse.json({ error: 'Não foi possível excluir o lançamento.' }, { status: 500 });
  }
}
