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
};

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, description: true, amount: true, type: true, category: true, date: true },
  });
  const initialTransactions: DashboardTransaction[] = transactions.map((transaction): DashboardTransaction => {
    const type = transaction.type;
    if (type !== 'RECEITA' && type !== 'DESPESA') {
      throw new Error(`Tipo inválido no lançamento ${transaction.id}.`);
    }
    return {
      ...transaction,
      type,
      date: transaction.date.toISOString(),
    };
  });

  return (
    <DashboardClient
      initialUser={user}
      initialTransactions={initialTransactions}
    />
  );
}
