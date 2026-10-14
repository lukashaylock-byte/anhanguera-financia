'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppSidebar from '../components/app-sidebar';

type Transaction = {
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

type Workspace = { id: string; name: string; role: string; workspaceType: string };
type User = { fullName: string; email: string; companyId: string; companyName: string; role: string; workspaces: Workspace[] };

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const currentMonth = () => today().slice(0, 7);
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');

export default function ContasPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [kind, setKind] = useState<'TODOS' | 'DESPESA' | 'RECEITA'>('TODOS');
  const [status, setStatus] = useState<'TODOS' | 'PENDENTE' | 'PAGO'>('PENDENTE');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState('');
  const [error, setError] = useState('');
  const canManageTransactions = user?.role === 'ADMINISTRADOR' || user?.role === 'FINANCEIRO';

  const loadData = useCallback(async (): Promise<{ user: User; transactions: Transaction[] } | null> => {
    const [userResponse, transactionsResponse] = await Promise.all([
      fetch('/api/auth/me', { cache: 'no-store' }),
      fetch('/api/transactions', { cache: 'no-store' }),
    ]);
    if (userResponse.status === 401 || transactionsResponse.status === 401) {
      router.replace('/login');
      return null;
    }
    if (!userResponse.ok || !transactionsResponse.ok) throw new Error('Não foi possível carregar as contas.');
    const [userData, transactionData] = await Promise.all([userResponse.json(), transactionsResponse.json()]);
    return { user: userData.user, transactions: transactionData.transactions };
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadData();
        if (data) {
          setUser(data.user);
          setTransactions(data.transactions);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar as contas.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadData]);

  const monthRows = useMemo(() => transactions.filter((transaction) => (
    (transaction.status === 'PENDENTE' ? transaction.dueDate : transaction.date).slice(0, 7) === month
  )), [month, transactions]);
  const overdue = monthRows.filter((transaction) => transaction.status === 'PENDENTE' && transaction.dueDate.slice(0, 10) < today());
  const pendingPayables = monthRows.filter((transaction) => transaction.status === 'PENDENTE' && transaction.type === 'DESPESA');
  const pendingReceivables = monthRows.filter((transaction) => transaction.status === 'PENDENTE' && transaction.type === 'RECEITA');
  const visibleRows = monthRows.filter((transaction) => {
    const matchesKind = kind === 'TODOS' || transaction.type === kind;
    const matchesStatus = status === 'TODOS' || transaction.status === status;
    const matchesSearch = `${transaction.description} ${transaction.category} ${transaction.costCenter}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
    return matchesKind && matchesStatus && matchesSearch;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const markAsSettled = async (transaction: Transaction) => {
    setUpdating(transaction.id);
    setError('');
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, date: transaction.date.slice(0, 10), dueDate: transaction.dueDate.slice(0, 10), status: 'PAGO' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a conta.');
      const refreshedData = await loadData();
      if (refreshedData) setTransactions(refreshedData.transactions);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Erro ao atualizar a conta.');
    } finally {
      setUpdating('');
    }
  };

  const logout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      setError('Não foi possível encerrar a sessão.');
      return;
    }
    router.replace('/login');
  };

  if (loading) return <main className="loading-screen"><span className="spinner" />Carregando suas contas...</main>;

  return (
    <div className="app-shell">
      <AppSidebar fullName={user?.fullName ?? ''} email={user?.email} companyId={user?.companyId ?? ''} companyName={user?.companyName ?? ''} workspaces={user?.workspaces ?? []} onLogout={() => void logout()} />
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><Link href="/">Painel</Link><span>/</span>Contas</div><div className="topbar-status"><span className="security-dot" />Visão financeira atualizada</div></header>
        <section className="page-heading"><div><p className="eyebrow">CONTROLE DE PAGAMENTOS E RECEBIMENTOS</p><h1>Contas</h1><p className="muted">Acompanhe vencimentos e mantenha suas finanças em dia.</p></div>{canManageTransactions && <Link className="button button-primary" href="/?novo=1"><span>＋</span>Novo lançamento</Link>}</section>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <section className="panel account-period-bar"><div><span className="period-calendar">▦</span><div><strong>Período de acompanhamento</strong><small>Filtre contas pelo mês de vencimento</small></div></div><label className="field-label" htmlFor="accounts-month">Mês<input className="input-control" id="accounts-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></section>
        <section className="metrics-grid account-metrics" aria-label="Resumo das contas">
          <article className="metric-card"><div className="metric-top"><span>A pagar</span><span className="metric-icon red">↘</span></div><strong className="metric-value">{currency.format(pendingPayables.reduce((total, row) => total + row.amount, 0))}</strong><small>{pendingPayables.length} conta(s) aguardando pagamento</small></article>
          <article className="metric-card"><div className="metric-top"><span>A receber</span><span className="metric-icon green">↗</span></div><strong className="metric-value">{currency.format(pendingReceivables.reduce((total, row) => total + row.amount, 0))}</strong><small>{pendingReceivables.length} recebimento(s) aguardando baixa</small></article>
          <article className="metric-card"><div className="metric-top"><span>Em atraso</span><span className="metric-icon red">!</span></div><strong className="metric-value">{overdue.length}</strong><small>Conta(s) pendente(s) com vencimento passado</small></article>
          <article className="metric-card"><div className="metric-top"><span>Em aberto</span><span className="metric-icon blue">◷</span></div><strong className="metric-value">{monthRows.filter((row) => row.status === 'PENDENTE').length}</strong><small>Contas previstas para este período</small></article>
        </section>
        <section className="panel accounts-panel">
          <div className="panel-heading"><div><h2>Agenda financeira</h2><p className="muted">Contas organizadas por data de vencimento</p></div><Link className="text-link" href="/relatorios">Ver relatórios <span>→</span></Link></div>
          <div className="filters-row account-filters">
            <label className="search-field"><span>⌕</span><input aria-label="Buscar conta" placeholder="Buscar descrição, categoria ou centro de custo" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <select className="select-control" aria-label="Filtrar por tipo" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="TODOS">Todos os tipos</option><option value="DESPESA">A pagar</option><option value="RECEITA">A receber</option></select>
            <select className="select-control" aria-label="Filtrar por situação" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="PENDENTE">Pendentes</option><option value="PAGO">Pagas / recebidas</option><option value="TODOS">Todas as situações</option></select>
          </div>
          <div className="table-wrap"><table className="transactions-table accounts-table"><thead><tr><th>Vencimento</th><th>Conta</th><th>Centro de custo</th><th>Situação</th><th>Tipo</th><th className="align-right">Valor</th>{canManageTransactions && <th><span className="sr-only">Ações</span></th>}</tr></thead>
            <tbody>{visibleRows.map((transaction) => {
              const isOverdue = transaction.status === 'PENDENTE' && transaction.dueDate.slice(0, 10) < today();
              return <tr key={transaction.id} className={isOverdue ? 'account-overdue-row' : undefined}>
                <td><strong className={isOverdue ? 'negative-text' : ''}>{dateLabel(transaction.dueDate)}</strong>{isOverdue && <small className="overdue-caption">Vencida</small>}</td>
                <td><strong className="transaction-description">{transaction.description}</strong><small className="account-secondary">{transaction.category}</small></td>
                <td>{transaction.costCenter}</td>
                <td><span className={`type-pill ${transaction.status === 'PAGO' ? 'type-income' : isOverdue ? 'type-expense' : 'status-pending'}`}>{transaction.status === 'PAGO' ? (transaction.type === 'RECEITA' ? 'Recebido' : 'Pago') : isOverdue ? 'Em atraso' : 'Pendente'}</span></td>
                <td>{transaction.type === 'RECEITA' ? 'A receber' : 'A pagar'}</td>
                <td className={`align-right amount-cell ${transaction.type === 'RECEITA' ? 'positive-text' : 'negative-text'}`}>{currency.format(transaction.amount)}</td>
                {canManageTransactions && <td>{transaction.status === 'PENDENTE' && <button className="button button-secondary settle-button" disabled={updating === transaction.id} onClick={() => void markAsSettled(transaction)}>{updating === transaction.id ? 'Salvando...' : transaction.type === 'RECEITA' ? '✓ Recebido' : '✓ Pago'}</button>}</td>}
              </tr>;
            })}
            {!visibleRows.length && <tr><td colSpan={canManageTransactions ? 7 : 6}><div className="empty-state"><span className="empty-icon">▣</span><strong>Nenhuma conta encontrada</strong><p>{monthRows.length ? 'Ajuste os filtros para encontrar outras contas.' : 'Crie um lançamento com situação pendente para organizar os vencimentos.'}</p>{canManageTransactions && <Link className="button button-primary" href="/?novo=1">Adicionar lançamento</Link>}</div></td></tr>}
            </tbody>
          </table></div>
        </section>
        <footer className="app-footer">Anhanguera Financia <span>•</span> Contas e vencimentos em um só lugar.</footer>
      </main>
    </div>
  );
}
