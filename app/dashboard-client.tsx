'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useMemo, useState } from 'react';
import AppSidebar from './components/app-sidebar';

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

type User = { id: string; fullName: string; email: string };

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const currentMonth = () => today().slice(0, 7);

export default function DashboardClient({
  initialUser,
  initialTransactions,
  initialShowForm,
}: {
  initialUser: User;
  initialTransactions: Transaction[];
  initialShowForm: boolean;
}) {
  const router = useRouter();
  const [user] = useState<User>(initialUser);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [showForm, setShowForm] = useState(initialShowForm);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
  const [category, setCategory] = useState('Outros');
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [status, setStatus] = useState<'PENDENTE' | 'PAGO'>('PENDENTE');
  const [costCenter, setCostCenter] = useState('Geral');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const response = await fetch('/api/transactions', { cache: 'no-store' });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok) {
        throw new Error('Não foi possível carregar seus dados. Tente novamente.');
      }
      const transactionData = await response.json();
      setError('');
      setTransactions(transactionData.transactions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar seus dados.');
    }
  }, [router]);

  const monthTransactions = useMemo(
    () => transactions.filter((transaction) => (
      (transaction.status === 'PENDENTE' ? transaction.dueDate : transaction.date).slice(0, 7) === month
    )),
    [transactions, month],
  );
  const income = monthTransactions
    .filter((transaction) => transaction.type === 'RECEITA' && transaction.status === 'PAGO')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expenses = monthTransactions
    .filter((transaction) => transaction.type === 'DESPESA' && transaction.status === 'PAGO')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const balance = income - expenses;
  const pendingTransactions = transactions.filter(
    (transaction) => transaction.status === 'PENDENTE' && transaction.dueDate.slice(0, 7) === month,
  );
  const pendingIncome = pendingTransactions
    .filter((transaction) => transaction.type === 'RECEITA')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const pendingExpenses = pendingTransactions
    .filter((transaction) => transaction.type === 'DESPESA')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const projectedBalance = balance + pendingIncome - pendingExpenses;
  const visibleTransactions = monthTransactions.filter((transaction) => {
    const matchesType = filter === 'TODOS' || transaction.type === filter;
    const matchesStatus = statusFilter === 'TODOS' || transaction.status === statusFilter;
    const matchesSearch = `${transaction.description} ${transaction.category} ${transaction.costCenter}`.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const openNewTransaction = () => {
    setEditing(null);
    setDescription('');
    setAmount('');
    setType('DESPESA');
    setCategory('Outros');
    setDate(today());
    setDueDate(today());
    setStatus('PENDENTE');
    setCostCenter('Geral');
    setShowForm(true);
  };

  const openEditTransaction = (transaction: Transaction) => {
    setEditing(transaction);
    setDescription(transaction.description);
    setAmount(String(transaction.amount));
    setType(transaction.type);
    setCategory(transaction.category);
    setDate(transaction.date.slice(0, 10));
    setDueDate(transaction.dueDate.slice(0, 10));
    setStatus(transaction.status);
    setCostCenter(transaction.costCenter);
    setShowForm(true);
  };

  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/transactions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          description,
          amount: Number(amount),
          type,
          category,
          date,
          dueDate,
          status,
          costCenter,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o lançamento.');
      setShowForm(false);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar o lançamento.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`Excluir o lançamento "${transaction.description}"?`)) return;
    setError('');
    try {
      const response = await fetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transaction.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível excluir o lançamento.');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir o lançamento.');
    }
  };

  const markAsPaid = async (transaction: Transaction) => {
    setUpdatingId(transaction.id);
    setError('');
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transaction.id,
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          date: transaction.date.slice(0, 10),
          dueDate: transaction.dueDate.slice(0, 10),
          status: 'PAGO',
          costCenter: transaction.costCenter,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a situação.');
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Erro ao atualizar a situação.');
    } finally {
      setUpdatingId('');
    }
  };

  const exportCsv = () => {
    const rows = [['Data', 'Vencimento', 'Descrição', 'Categoria', 'Centro de custo', 'Situação', 'Tipo', 'Valor'], ...visibleTransactions.map((transaction) => [
      transaction.date.slice(0, 10),
      transaction.dueDate.slice(0, 10),
      transaction.description,
      transaction.category,
      transaction.costCenter,
      transaction.status === 'PAGO' ? 'Pago/recebido' : 'Pendente',
      transaction.type === 'RECEITA' ? 'Receita' : 'Despesa',
      transaction.amount.toFixed(2).replace('.', ','),
    ])];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => {
      const safeCell = /^[=+\-@\t\r]/.test(cell) ? `\t${cell}` : cell;
      return `"${safeCell.replaceAll('"', '""')}"`;
    }).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lancamentos-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const logout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      setError('Não foi possível encerrar a sessão.');
      return;
    }
    router.replace('/login');
  };

  const monthlyBars = useMemo(() => {
    const currentDate = new Date(`${month}-01T12:00:00`);
    return Array.from({ length: 6 }, (_, index) => {
      const dateValue = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5 + index, 1);
      const key = `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}`;
      const monthRows = transactions.filter((transaction) => transaction.date.slice(0, 7) === key);
      return {
        label: dateValue.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        income: monthRows.filter((item) => item.type === 'RECEITA' && item.status === 'PAGO').reduce((total, item) => total + item.amount, 0),
        expenses: monthRows.filter((item) => item.type === 'DESPESA' && item.status === 'PAGO').reduce((total, item) => total + item.amount, 0),
      };
    });
  }, [month, transactions]);
  const maxChartValue = Math.max(...monthlyBars.flatMap((item) => [item.income, item.expenses]), 1);

  return (
    <div className="app-shell">
      <AppSidebar fullName={user.fullName} email={user.email} onLogout={() => void logout()} />

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Painel <span>/</span> Visão geral</div>
          <div className="account-chip"><span className="avatar">{user?.fullName?.slice(0, 1).toUpperCase() || 'U'}</span><div><strong>{user?.fullName}</strong><small>{user?.email}</small></div></div>
        </header>

        <section className="page-heading">
          <div><p className="eyebrow">SEU RESUMO FINANCEIRO</p><h1>Visão geral</h1><p className="muted">Acompanhe sua vida financeira em um só lugar.</p></div>
          <button className="button button-primary" id="novo-lancamento" onClick={openNewTransaction}><span>＋</span> Novo lançamento</button>
        </section>

        {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}

        <section className="metrics-grid" aria-label="Resumo financeiro do mês">
          <article className="metric-card balance-card"><div className="metric-top"><span>Saldo realizado</span><span className="metric-icon violet">◈</span></div><strong className={`metric-value ${balance >= 0 ? 'positive-text' : 'negative-text'}`}>{currency.format(balance)}</strong><small>Entradas recebidas menos despesas pagas</small></article>
          <article className="metric-card"><div className="metric-top"><span>Entradas recebidas</span><span className="metric-icon green">↗</span></div><strong className="metric-value">{currency.format(income)}</strong><small className="positive-text">Valores já recebidos</small></article>
          <article className="metric-card"><div className="metric-top"><span>Despesas pagas</span><span className="metric-icon red">↘</span></div><strong className="metric-value">{currency.format(expenses)}</strong><small className="negative-text">Valores já pagos</small></article>
          <article className="metric-card"><div className="metric-top"><span>Saldo projetado</span><span className="metric-icon blue">▤</span></div><strong className={`metric-value ${projectedBalance >= 0 ? 'positive-text' : 'negative-text'}`}>{currency.format(projectedBalance)}</strong><small>Considera contas pendentes no mês</small></article>
        </section>

        <section className="content-grid">
          <article className="panel chart-panel">
            <div className="panel-heading"><div><h2>Fluxo financeiro</h2><p className="muted">Entradas e saídas nos últimos 6 meses</p></div><span className="chart-period">{month}</span></div>
            <div className="chart-legend"><span><i className="legend-income" />Entradas</span><span><i className="legend-expenses" />Saídas</span></div>
            <div className="bar-chart" role="img" aria-label="Gráfico comparativo de entradas e saídas mensais">
              {monthlyBars.map((bar) => <div className="bar-group" key={bar.label}>
                <div className="bars"><span className="bar income-bar" title={`Entradas: ${currency.format(bar.income)}`} style={{ height: `${Math.max(bar.income / maxChartValue * 100, bar.income ? 4 : 1)}%` }} /><span className="bar expense-bar" title={`Saídas: ${currency.format(bar.expenses)}`} style={{ height: `${Math.max(bar.expenses / maxChartValue * 100, bar.expenses ? 4 : 1)}%` }} /></div>
                <small>{bar.label}</small>
              </div>)}
            </div>
          </article>
          <article className="panel period-panel">
            <div className="panel-heading"><div><h2>Período</h2><p className="muted">Selecione o mês do resumo</p></div></div>
            <label className="field-label" htmlFor="month-filter">Mês de referência</label>
            <input className="input-control" id="month-filter" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            <div className="period-summary"><span>Contas a receber</span><strong className="positive-text">{currency.format(pendingIncome)}</strong><span>Contas a pagar</span><strong className="negative-text">{currency.format(pendingExpenses)}</strong><span>Saldo projetado</span><strong className={projectedBalance >= 0 ? 'positive-text' : 'negative-text'}>{currency.format(projectedBalance)}</strong></div>
            <div className="quick-links"><Link className="text-link" href="/contas">Gerenciar contas <span>→</span></Link><Link className="text-link" href="/centros-de-custo">Ver custos por área <span>→</span></Link><Link className="text-link" href="/relatorios">Ver relatório completo <span>→</span></Link></div>
          </article>
        </section>

        <section className="panel transactions-panel">
          <div className="panel-heading transactions-heading"><div><h2>Últimos lançamentos</h2><p className="muted">{visibleTransactions.length} registro(s) em {month}</p></div>
            <div className="table-actions"><button className="button button-secondary" onClick={exportCsv} disabled={!visibleTransactions.length}>↓ Exportar CSV</button></div>
          </div>
          <div className="filters-row">
            <label className="search-field"><span>⌕</span><input aria-label="Buscar lançamento" placeholder="Buscar descrição, categoria ou centro de custo" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <select className="select-control" aria-label="Filtrar por tipo" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="TODOS">Todos os tipos</option><option value="RECEITA">Entradas</option><option value="DESPESA">Saídas</option></select>
            <select className="select-control" aria-label="Filtrar por situação" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="TODOS">Todas as situações</option><option value="PENDENTE">Pendentes</option><option value="PAGO">Pagos / recebidos</option></select>
          </div>
          <div className="table-wrap"><table className="transactions-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Centro de custo</th><th>Vencimento</th><th>Situação</th><th>Tipo</th><th className="align-right">Valor</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{visibleTransactions.map((transaction) => <tr key={transaction.id}>
              <td><strong className="transaction-description">{transaction.description}</strong></td><td><span className="category-pill">{transaction.category}</span></td><td>{transaction.costCenter}</td><td>{new Date(`${transaction.dueDate.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}</td>
              <td><span className={`type-pill ${transaction.status === 'PAGO' ? 'type-income' : transaction.dueDate.slice(0, 10) < today() ? 'type-expense' : 'status-pending'}`}>{transaction.status === 'PAGO' ? (transaction.type === 'RECEITA' ? 'Recebido' : 'Pago') : transaction.dueDate.slice(0, 10) < today() ? 'Atrasado' : 'Pendente'}</span></td>
              <td><span className={`type-pill ${transaction.type === 'RECEITA' ? 'type-income' : 'type-expense'}`}>{transaction.type === 'RECEITA' ? 'Entrada' : 'Saída'}</span></td>
              <td className={`align-right amount-cell ${transaction.type === 'RECEITA' ? 'positive-text' : 'negative-text'}`}>{transaction.type === 'DESPESA' ? '− ' : '+ '}{currency.format(transaction.amount)}</td>
              <td><div className="row-actions">{transaction.status === 'PENDENTE' && <button className="mark-paid-button" aria-label={transaction.type === 'RECEITA' ? `Marcar ${transaction.description} como recebido` : `Marcar ${transaction.description} como pago`} title={transaction.type === 'RECEITA' ? 'Marcar como recebido' : 'Marcar como pago'} disabled={updatingId === transaction.id} onClick={() => void markAsPaid(transaction)}>✓</button>}<button aria-label={`Editar ${transaction.description}`} title="Editar" onClick={() => openEditTransaction(transaction)}>✎</button><button aria-label={`Excluir ${transaction.description}`} title="Excluir" onClick={() => void deleteTransaction(transaction)}>×</button></div></td>
            </tr>)}
            {!visibleTransactions.length && <tr><td colSpan={8}><div className="empty-state"><span className="empty-icon">▤</span><strong>Nenhum lançamento encontrado</strong><p>{monthTransactions.length ? 'Experimente mudar os filtros.' : 'Adicione seu primeiro lançamento para começar a acompanhar suas finanças.'}</p>{!monthTransactions.length && <button className="button button-primary" onClick={openNewTransaction}>Adicionar lançamento</button>}</div></td></tr>}
            </tbody></table></div>
        </section>
        <footer className="app-footer">Anhanguera Financia <span>•</span> Seus dados financeiros, organizados com clareza.</footer>
      </main>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
          <div className="modal-heading"><div><p className="eyebrow">{editing ? 'ATUALIZE OS DADOS' : 'REGISTRE UMA MOVIMENTAÇÃO'}</p><h2 id="transaction-modal-title">{editing ? 'Editar lançamento' : 'Novo lançamento'}</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Fechar">×</button></div>
          <form className="transaction-form" onSubmit={saveTransaction}>
            <label className="field-label">Tipo de lançamento<select className="input-control" value={type} onChange={(event) => setType(event.target.value as 'RECEITA' | 'DESPESA')}><option value="DESPESA">Saída / Despesa</option><option value="RECEITA">Entrada / Receita</option></select></label>
            <label className="field-label">Descrição<input className="input-control" maxLength={120} required placeholder="Ex.: Conta de energia" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <div className="form-row"><label className="field-label">Valor (R$)<input className="input-control" type="number" min="0.01" step="0.01" required placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
              <label className="field-label">Data do lançamento<input className="input-control" type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
            <div className="form-row"><label className="field-label">Vencimento<input className="input-control" type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
              <label className="field-label">Situação<select className="input-control" value={status} onChange={(event) => setStatus(event.target.value as 'PENDENTE' | 'PAGO')}><option value="PENDENTE">Pendente</option><option value="PAGO">Pago / recebido</option></select></label></div>
            <div className="form-row"><label className="field-label">Categoria<input className="input-control" maxLength={60} required placeholder="Ex.: Fornecedores, marketing" value={category} onChange={(event) => setCategory(event.target.value)} /></label>
              <label className="field-label">Centro de custo<input className="input-control" maxLength={80} required placeholder="Ex.: Operações, filial Centro" value={costCenter} onChange={(event) => setCostCenter(event.target.value)} /></label></div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Adicionar lançamento'}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}
