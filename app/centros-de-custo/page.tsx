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

type User = { fullName: string; email: string };
type Group = { name: string; amount: number; count: number; share: number };

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

function summarize(rows: Transaction[], key: 'category' | 'costCenter', total: number): Group[] {
  const groups = rows.reduce<Record<string, { amount: number; count: number }>>((result, row) => {
    const name = row[key].trim() || 'Sem classificação';
    result[name] ??= { amount: 0, count: 0 };
    result[name].amount += row.amount;
    result[name].count += 1;
    return result;
  }, {});
  return Object.entries(groups)
    .map(([name, group]) => ({ name, ...group, share: total ? group.amount / total * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export default function CostCentersPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async (): Promise<{ user: User; transactions: Transaction[] } | null> => {
    const [userResponse, transactionsResponse] = await Promise.all([
      fetch('/api/auth/me', { cache: 'no-store' }),
      fetch('/api/transactions', { cache: 'no-store' }),
    ]);
    if (userResponse.status === 401 || transactionsResponse.status === 401) {
      router.replace('/login');
      return null;
    }
    if (!userResponse.ok || !transactionsResponse.ok) throw new Error('Não foi possível carregar a análise de custos.');
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
        setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar os centros de custo.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadData]);

  const report = useMemo(() => {
    const rows = transactions.filter((transaction) => (
      transaction.status === 'PAGO' &&
      transaction.type === 'DESPESA' &&
      transaction.date.slice(0, 7) === month
    ));
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return {
      rows,
      total,
      costCenters: summarize(rows, 'costCenter', total),
      categories: summarize(rows, 'category', total),
    };
  }, [month, transactions]);

  const selectedRows = selectedCenter ? report.rows.filter((row) => row.costCenter === selectedCenter) : report.rows;
  const logout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      setError('Não foi possível encerrar a sessão.');
      return;
    }
    router.replace('/login');
  };

  if (loading) return <main className="loading-screen"><span className="spinner" />Preparando análise de custos...</main>;

  return (
    <div className="app-shell">
      <AppSidebar fullName={user?.fullName ?? ''} email={user?.email} onLogout={() => void logout()} />
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><Link href="/">Painel</Link><span>/</span>Centros de custo</div><div className="topbar-status"><span className="security-dot" />Análise de despesas pagas</div></header>
        <section className="page-heading"><div><p className="eyebrow">CUSTOS POR ÁREA, PROJETO OU FILIAL</p><h1>Centros de custo</h1><p className="muted">Entenda onde a empresa concentra suas despesas.</p></div><Link className="button button-secondary" href="/relatorios">Abrir relatórios completos <span>→</span></Link></section>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <section className="panel account-period-bar"><div><span className="period-calendar">▦</span><div><strong>Análise mensal</strong><small>Considera despesas pagas no mês selecionado</small></div></div><label className="field-label" htmlFor="cost-month">Mês<input className="input-control" id="cost-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></section>
        <section className="metrics-grid account-metrics cost-metrics">
          <article className="metric-card"><div className="metric-top"><span>Total de despesas pagas</span><span className="metric-icon red">↘</span></div><strong className="metric-value">{currency.format(report.total)}</strong><small>{report.rows.length} lançamento(s) classificados</small></article>
          <article className="metric-card"><div className="metric-top"><span>Centros ativos no período</span><span className="metric-icon blue">▦</span></div><strong className="metric-value">{report.costCenters.length}</strong><small>Áreas, projetos ou filiais com despesas</small></article>
          <article className="metric-card"><div className="metric-top"><span>Maior centro de custo</span><span className="metric-icon green">⌁</span></div><strong className="metric-value cost-leader">{report.costCenters[0]?.name ?? '—'}</strong><small>{report.costCenters[0] ? `${currency.format(report.costCenters[0].amount)} no período` : 'Sem despesas pagas no período'}</small></article>
          <article className="metric-card"><div className="metric-top"><span>Maior categoria</span><span className="metric-icon violet">◈</span></div><strong className="metric-value cost-leader">{report.categories[0]?.name ?? '—'}</strong><small>{report.categories[0] ? `${currency.format(report.categories[0].amount)} no período` : 'Sem despesas pagas no período'}</small></article>
        </section>
        <section className="cost-analysis-grid">
          <article className="panel cost-breakdown-panel">
            <div className="panel-heading"><div><h2>Gastos por centro</h2><p className="muted">Selecione uma área para detalhar seus lançamentos</p></div></div>
            {report.costCenters.length ? <div className="cost-center-list">{report.costCenters.map((center, index) => (
              <button type="button" className={`cost-center-item${selectedCenter === center.name ? ' selected' : ''}`} key={center.name} onClick={() => setSelectedCenter(selectedCenter === center.name ? '' : center.name)}>
                <span className={`cost-center-rank rank-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span>
                <span className="cost-center-main"><span className="cost-center-title"><strong>{center.name}</strong><small>{center.count} despesa(s)</small></span><span className="cost-center-track"><span style={{ width: `${center.share}%` }} /></span></span>
                <span className="cost-center-amount"><strong>{currency.format(center.amount)}</strong><small>{center.share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small></span>
              </button>
            ))}</div> : <div className="empty-state report-empty"><span className="empty-icon">▦</span><strong>Sem despesas pagas neste período</strong><p>Classifique as despesas por área, projeto ou filial ao registrar um lançamento.</p><Link className="button button-primary" href="/">Ir para visão geral</Link></div>}
          </article>
          <article className="panel cost-category-panel"><div className="panel-heading"><div><h2>Onde os custos se concentram</h2><p className="muted">Categorias de despesas do mês</p></div></div>
            {report.categories.length ? <div className="category-list">{report.categories.slice(0, 8).map((category) => <div className="category-report-row" key={category.name}><div className="category-row-heading"><strong>{category.name}</strong><span>{currency.format(category.amount)} <small>{category.share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small></span></div><div className="category-track"><span style={{ width: `${category.share}%` }} /></div></div>)}</div> : <div className="empty-state report-empty"><span className="empty-icon">▥</span><strong>Sem categorias para mostrar</strong><p>As despesas pagas serão agrupadas pelas categorias informadas.</p></div>}
          </article>
        </section>
        <section className="panel report-transactions cost-transactions"><div className="panel-heading"><div><h2>{selectedCenter ? `Lançamentos · ${selectedCenter}` : 'Despesas do período'}</h2><p className="muted">{selectedRows.length} lançamento(s) · {currency.format(selectedRows.reduce((sum, row) => sum + row.amount, 0))}</p></div>{selectedCenter && <button className="button button-secondary" onClick={() => setSelectedCenter('')}>Limpar seleção</button>}</div>
          <div className="table-wrap"><table className="transactions-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Centro de custo</th><th>Data</th><th className="align-right">Valor</th></tr></thead><tbody>{selectedRows.map((row) => <tr key={row.id}><td><strong className="transaction-description">{row.description}</strong></td><td><span className="category-pill">{row.category}</span></td><td>{row.costCenter}</td><td>{new Date(`${row.date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="align-right amount-cell negative-text">{currency.format(row.amount)}</td></tr>)}
            {!selectedRows.length && <tr><td colSpan={5}><div className="empty-state"><strong>Nenhum lançamento para esta seleção</strong><p>Escolha outro centro ou mês para consultar despesas.</p></div></td></tr>}
          </tbody></table></div>
        </section>
        <footer className="app-footer">Anhanguera Financia <span>•</span> Visão clara dos gastos da empresa.</footer>
      </main>
    </div>
  );
}
