import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardClient from './dashboard-client';

type DashboardTransaction = {
  id: string;
  description: string;
  amount: number;
  type: 'RECEITA' | 'DESPESA';
  category: string;
  date: string;
  dueDate: string;
  status: 'PENDENTE' | 'PAGO';
  costCenter: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string | string[] }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');
  const params = await searchParams;

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, description: true, amount: true, type: true, category: true, date: true, dueDate: true, status: true, costCenter: true },
  });
  const initialTransactions: DashboardTransaction[] = transactions.map((transaction): DashboardTransaction => {
    const type = transaction.type;
    if (type !== 'RECEITA' && type !== 'DESPESA') {
      throw new Error(`Tipo inválido no lançamento ${transaction.id}.`);
    }
    if (transaction.status !== 'PENDENTE' && transaction.status !== 'PAGO') {
      throw new Error(`Situação inválida no lançamento ${transaction.id}.`);
    }
    return {
      ...transaction,
      type,
      date: transaction.date.toISOString(),
      dueDate: (transaction.dueDate ?? transaction.date).toISOString(),
      status: transaction.status,
    };
  });

  return (
    <DashboardClient
      initialUser={user}
      initialTransactions={initialTransactions}
      initialShowForm={params.novo === '1'}
    />
  );
}
