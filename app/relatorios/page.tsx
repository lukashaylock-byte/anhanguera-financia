'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Transaction = { id: string; description: string; amount: number; type: 'RECEITA' | 'DESPESA'; category: string; date: string };
type User = { fullName: string };
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
    const rows = transactions.filter((transaction) => transaction.date.slice(0, 7) === month);
    const income = rows.filter((row) => row.type === 'RECEITA').reduce((total, row) => total + row.amount, 0);
    const expenses = rows.filter((row) => row.type === 'DESPESA').reduce((total, row) => total + row.amount, 0);
    const categories = rows.filter((row) => row.type === 'DESPESA').reduce<Record<string, number>>((result, row) => {
      result[row.category] = (result[row.category] || 0) + row.amount;
      return result;
    }, {});
    return { rows, income, expenses, balance: income - expenses, categories: Object.entries(categories).sort((a, b) => b[1] - a[1]) };
  }, [month, transactions]);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  if (loading) return <main className="loading-screen"><span className="spinner" />Preparando seu relatório...</main>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark">A</span><span><span className="brand-name">Anhanguera</span><span className="brand-light">Financia</span></span></Link>
        <p className="nav-caption">MENU PRINCIPAL</p>
        <nav className="side-nav" aria-label="Navegação principal"><Link href="/" className="nav-link"><span className="nav-icon">◫</span>Visão geral</Link><Link href="/relatorios" className="nav-link active"><span className="nav-icon">▥</span>Relatórios</Link></nav>
        <div className="sidebar-bottom"><div className="security-note"><span className="security-dot" /><div><strong>Seus dados protegidos</strong><small>Privacidade em primeiro lugar</small></div></div><button className="nav-link logout-button" type="button" onClick={async () => { const response = await fetch('/api/auth/logout', { method: 'POST' }); if (response.ok) router.replace('/login'); else setError('Não foi possível encerrar a sessão.'); }}><span className="nav-icon">↪</span>Sair da conta</button></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><Link href="/">Painel</Link><span>/</span>Relatórios</div><div className="account-chip"><span className="avatar">{user?.fullName.slice(0, 1).toUpperCase() || 'U'}</span><div><strong>{user?.fullName}</strong><small>Relatório financeiro</small></div></div></header>
        <section className="page-heading"><div><p className="eyebrow">ANÁLISE DAS SUAS FINANÇAS</p><h1>Relatórios</h1><p className="muted">Entenda para onde seu dinheiro está indo.</p></div><button className="button button-secondary" onClick={() => window.print()}>⌑ Imprimir relatório</button></section>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <section className="panel report-filter"><div><h2>Resumo mensal</h2><p className="muted">Os dados consideram os lançamentos registrados.</p></div><label className="field-label" htmlFor="report-month">Mês de referência<input className="input-control" id="report-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></section>
        <section className="report-banner"><div><span className="report-banner-label">RESULTADO DE {monthLabel.toUpperCase()}</span><strong>{currency.format(report.balance)}</strong><p>{report.rows.length} movimentação(ões) no período</p></div><div className="report-banner-icon">▥</div></section>
        <section className="metrics-grid report-metrics"><article className="metric-card"><div className="metric-top"><span>Entradas</span><span className="metric-icon green">↗</span></div><strong className="metric-value">{currency.format(report.income)}</strong><small>Total recebido no período</small></article><article className="metric-card"><div className="metric-top"><span>Saídas</span><span className="metric-icon red">↘</span></div><strong className="metric-value">{currency.format(report.expenses)}</strong><small>Total gasto no período</small></article><article className="metric-card"><div className="metric-top"><span>Saldo do período</span><span className="metric-icon violet">◈</span></div><strong className={`metric-value ${report.balance >= 0 ? 'positive-text' : 'negative-text'}`}>{currency.format(report.balance)}</strong><small>Entradas menos saídas</small></article><article className="metric-card"><div className="metric-top"><span>Margem do período</span><span className="metric-icon blue">％</span></div><strong className="metric-value">{report.income ? `${((report.balance / report.income) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</strong><small>Saldo em relação às entradas</small></article></section>
        <section className="panel category-report"><div className="panel-heading"><div><h2>Despesas por categoria</h2><p className="muted">Distribuição das saídas de {monthLabel}</p></div></div>
          {report.categories.length ? <div className="category-list">{report.categories.map(([name, total]) => <div className="category-report-row" key={name}><div className="category-row-heading"><strong>{name}</strong><span>{currency.format(total)} <small>{report.expenses ? `${((total / report.expenses) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''}</small></span></div><div className="category-track"><span style={{ width: `${report.expenses ? total / report.expenses * 100 : 0}%` }} /></div></div>)}</div> : <div className="empty-state report-empty"><span className="empty-icon">▥</span><strong>Sem despesas neste período</strong><p>Quando você adicionar saídas, o detalhamento por categoria aparecerá aqui.</p></div>}
        </section>
        <section className="panel report-transactions"><div className="panel-heading"><div><h2>Movimentações do período</h2><p className="muted">{report.rows.length} lançamento(s) em {monthLabel}</p></div><Link className="text-link" href="/">Ir para lançamentos →</Link></div>
          <div className="table-wrap"><table className="transactions-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Tipo</th><th className="align-right">Valor</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.id}><td><strong className="transaction-description">{row.description}</strong></td><td><span className="category-pill">{row.category}</span></td><td>{new Date(`${row.date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}</td><td><span className={`type-pill ${row.type === 'RECEITA' ? 'type-income' : 'type-expense'}`}>{row.type === 'RECEITA' ? 'Entrada' : 'Saída'}</span></td><td className={`align-right amount-cell ${row.type === 'RECEITA' ? 'positive-text' : 'negative-text'}`}>{row.type === 'DESPESA' ? '− ' : '+ '}{currency.format(row.amount)}</td></tr>)}
            {!report.rows.length && <tr><td colSpan={5}><div className="empty-state"><span className="empty-icon">▤</span><strong>Nenhuma movimentação neste mês</strong><p>Os lançamentos cadastrados aparecerão neste relatório.</p></div></td></tr>}</tbody></table></div>
        </section>
        <footer className="app-footer">Anhanguera Financia <span>•</span> Relatório baseado nos lançamentos registrados.</footer>
      </main>
    </div>
  );
}
