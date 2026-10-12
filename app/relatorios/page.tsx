'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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
type User = { fullName: string; email: string; companyId: string; companyName: string; workspaces: Workspace[] };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function RelatoriosPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [sessionResponse, transactionsResponse] = await Promise.all([
          fetch('/api/auth/me', { cache: 'no-store' }),
          fetch('/api/transactions', { cache: 'no-store' }),
        ]);
        if (sessionResponse.status === 401 || transactionsResponse.status === 401) {
          router.replace('/login');
          return;
        }
        if (!sessionResponse.ok || !transactionsResponse.ok) throw new Error('Não foi possível carregar o relatório.');
        const sessionData = await sessionResponse.json();
        const transactionData = await transactionsResponse.json();
        setUser(sessionData.user);
        setTransactions(transactionData.transactions);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar o relatório.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router]);

  const report = useMemo(() => {
    const rows = transactions.filter((transaction) => (
      (transaction.status === 'PENDENTE' ? transaction.dueDate : transaction.date).slice(0, 7) === month
    ));
    const paidRows = rows.filter((row) => row.status === 'PAGO');
    const pendingRows = rows.filter((row) => row.status === 'PENDENTE');
    const income = paidRows.filter((row) => row.type === 'RECEITA').reduce((total, row) => total + row.amount, 0);
    const expenses = paidRows.filter((row) => row.type === 'DESPESA').reduce((total, row) => total + row.amount, 0);
    const pendingIncome = pendingRows.filter((row) => row.type === 'RECEITA').reduce((total, row) => total + row.amount, 0);
    const pendingExpenses = pendingRows.filter((row) => row.type === 'DESPESA').reduce((total, row) => total + row.amount, 0);
    const categories = paidRows.filter((row) => row.type === 'DESPESA').reduce<Record<string, number>>((result, row) => {
      result[row.category] = (result[row.category] || 0) + row.amount;
      return result;
    }, {});
    const costCenters = paidRows.filter((row) => row.type === 'DESPESA').reduce<Record<string, number>>((result, row) => {
      result[row.costCenter] = (result[row.costCenter] || 0) + row.amount;
      return result;
    }, {});
    const balance = income - expenses;
    return {
      rows,
      income,
      expenses,
      balance,
      projectedBalance: balance + pendingIncome - pendingExpenses,
      pendingTotal: pendingIncome + pendingExpenses,
      categories: Object.entries(categories).sort((a, b) => b[1] - a[1]),
      costCenters: Object.entries(costCenters).sort((a, b) => b[1] - a[1]),
    };
  }, [month, transactions]);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  if (loading) return <main className="loading-screen"><span className="spinner" />Preparando seu relatório...</main>;

  return (
    <div className="app-shell">
      <AppSidebar fullName={user?.fullName ?? ''} email={user?.email} companyId={user?.companyId ?? ''} companyName={user?.companyName ?? ''} workspaces={user?.workspaces ?? []} onLogout={() => { void (async () => { const response = await fetch('/api/auth/logout', { method: 'POST' }); if (response.ok) router.replace('/login'); else setError('Não foi possível encerrar a sessão.'); })(); }} />
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><Link href="/">Painel</Link><span>/</span>Relatórios</div><div className="account-chip"><span className="avatar">{user?.fullName.slice(0, 1).toUpperCase() || 'U'}</span><div><strong>{user?.fullName}</strong><small>Relatório financeiro</small></div></div></header>
        <section className="page-heading"><div><p className="eyebrow">ANÁLISE DAS SUAS FINANÇAS</p><h1>Relatórios</h1><p className="muted">Entenda para onde seu dinheiro está indo.</p></div><button className="button button-secondary" onClick={() => window.print()}>⌑ Imprimir relatório</button></section>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <section className="panel report-filter"><div><h2>Resumo mensal</h2><p className="muted">Os dados consideram os lançamentos registrados.</p></div><label className="field-label" htmlFor="report-month">Mês de referência<input className="input-control" id="report-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></section>
        <section className="report-banner"><div><span className="report-banner-label">SALDO PROJETADO DE {monthLabel.toUpperCase()}</span><strong>{currency.format(report.projectedBalance)}</strong><p>{report.rows.length} movimentação(ões) lançadas no período, incluindo pendências futuras</p></div><div className="report-banner-icon">▥</div></section>
        <section className="metrics-grid report-metrics"><article className="metric-card"><div className="metric-top"><span>Entradas recebidas</span><span className="metric-icon green">↗</span></div><strong className="metric-value">{currency.format(report.income)}</strong><small>Total já recebido no período</small></article><article className="metric-card"><div className="metric-top"><span>Despesas pagas</span><span className="metric-icon red">↘</span></div><strong className="metric-value">{currency.format(report.expenses)}</strong><small>Total já pago no período</small></article><article className="metric-card"><div className="metric-top"><span>Saldo realizado</span><span className="metric-icon violet">◈</span></div><strong className={`metric-value ${report.balance >= 0 ? 'positive-text' : 'negative-text'}`}>{currency.format(report.balance)}</strong><small>Entradas menos despesas pagas</small></article><article className="metric-card"><div className="metric-top"><span>Valores pendentes</span><span className="metric-icon blue">％</span></div><strong className="metric-value">{currency.format(report.pendingTotal)}</strong><small>A pagar e a receber no mês</small></article></section>
        <section className="panel category-report"><div className="panel-heading"><div><h2>Despesas por categoria</h2><p className="muted">Distribuição das saídas de {monthLabel}</p></div></div>
          {report.categories.length ? <div className="category-list">{report.categories.map(([name, total]) => <div className="category-report-row" key={name}><div className="category-row-heading"><strong>{name}</strong><span>{currency.format(total)} <small>{report.expenses ? `${((total / report.expenses) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''}</small></span></div><div className="category-track"><span style={{ width: `${report.expenses ? total / report.expenses * 100 : 0}%` }} /></div></div>)}</div> : <div className="empty-state report-empty"><span className="empty-icon">▥</span><strong>Sem despesas neste período</strong><p>Quando você adicionar saídas, o detalhamento por categoria aparecerá aqui.</p></div>}
        </section>
        <section className="panel category-report"><div className="panel-heading"><div><h2>Despesas por centro de custo</h2><p className="muted">Valores pagos em cada área, projeto ou filial</p></div><Link className="text-link" href="/centros-de-custo">Abrir análise detalhada →</Link></div>
          {report.costCenters.length ? <div className="category-list">{report.costCenters.map(([name, total]) => <div className="category-report-row" key={name}><div className="category-row-heading"><strong>{name}</strong><span>{currency.format(total)} <small>{report.expenses ? `${((total / report.expenses) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''}</small></span></div><div className="category-track"><span style={{ width: `${report.expenses ? total / report.expenses * 100 : 0}%` }} /></div></div>)}</div> : <div className="empty-state report-empty"><span className="empty-icon">▥</span><strong>Sem despesas neste período</strong><p>Cadastre despesas para visualizar os custos por área, projeto ou filial.</p></div>}
        </section>
        <section className="panel report-transactions"><div className="panel-heading"><div><h2>Movimentações do período</h2><p className="muted">{report.rows.length} lançamento(s) em {monthLabel}</p></div><Link className="text-link" href="/">Ir para lançamentos →</Link></div>
          <div className="table-wrap"><table className="transactions-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Centro de custo</th><th>Vencimento</th><th>Situação</th><th>Tipo</th><th className="align-right">Valor</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.id}><td><strong className="transaction-description">{row.description}</strong></td><td><span className="category-pill">{row.category}</span></td><td>{row.costCenter}</td><td>{new Date(`${row.dueDate.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}</td><td><span className={`type-pill ${row.status === 'PAGO' ? 'type-income' : 'status-pending'}`}>{row.status === 'PAGO' ? (row.type === 'RECEITA' ? 'Recebido' : 'Pago') : 'Pendente'}</span></td><td><span className={`type-pill ${row.type === 'RECEITA' ? 'type-income' : 'type-expense'}`}>{row.type === 'RECEITA' ? 'Entrada' : 'Saída'}</span></td><td className={`align-right amount-cell ${row.type === 'RECEITA' ? 'positive-text' : 'negative-text'}`}>{row.type === 'DESPESA' ? '− ' : '+ '}{currency.format(row.amount)}</td></tr>)}
            {!report.rows.length && <tr><td colSpan={7}><div className="empty-state"><span className="empty-icon">▤</span><strong>Nenhuma movimentação neste mês</strong><p>Os lançamentos cadastrados aparecerão neste relatório.</p></div></td></tr>}</tbody></table></div>
        </section>
        <footer className="app-footer">Anhanguera Financia <span>•</span> Relatório baseado nos lançamentos registrados.</footer>
      </main>
    </div>
  );
}
