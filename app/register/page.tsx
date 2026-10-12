'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: '', fullName: '', email: '', password: '', cpf: '', birthDate: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar sua conta.');
      router.replace('/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ocorreu um erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/" className="brand auth-brand"><span className="brand-mark">A</span><span><span className="brand-name">Anhanguera</span><span className="brand-light">Financia</span></span></Link>
        <div className="story-content">
          <div className="story-orbit"><span>+</span><i /><i /><i /></div>
          <p className="eyebrow">COMECE COM O PÉ DIREITO</p>
          <h1>Uma gestão melhor<br />começa com clareza.</h1>
          <p>Crie seu acesso e reúna contas, categorias e custos da empresa em um só lugar.</p>
          <div className="auth-feature-list">
            <div><span>↗</span><p><strong>Veja o caixa com clareza</strong><small>Separe valores realizados e contas previstas.</small></p></div>
            <div><span>▣</span><p><strong>Organize vencimentos</strong><small>Saiba o que precisa ser pago ou recebido.</small></p></div>
            <div><span>▤</span><p><strong>Entenda os custos</strong><small>Agrupe despesas por área e categoria.</small></p></div>
          </div>
        </div>
        <small className="story-footer">Simples de usar. Feito para acompanhar você.</small>
      </section>
      <section className="auth-main register-main">
        <div className="auth-card register-card">
          <p className="eyebrow">ACESSO À GESTÃO FINANCEIRA</p>
          <h2>Vamos organizar sua empresa.</h2>
          <p className="auth-intro">Crie seu acesso para começar a acompanhar as finanças do negócio.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form className="auth-form register-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="companyName">Nome da empresa<input autoComplete="organization" className="input-control" id="companyName" type="text" maxLength={120} required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Ex.: Empresa Anhanguera" /></label>
            <label className="field-label" htmlFor="fullName">Nome completo<input autoComplete="name" className="input-control" id="fullName" type="text" maxLength={120} required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Como podemos chamar você?" /></label>
            <label className="field-label" htmlFor="registerEmail">E-mail<input autoComplete="email" className="input-control" id="registerEmail" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="voce@exemplo.com" /></label>
            <div className="form-row">
              <label className="field-label" htmlFor="cpf">CPF<input autoComplete="off" className="input-control" id="cpf" inputMode="numeric" maxLength={14} required value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} placeholder="000.000.000-00" /></label>
              <label className="field-label" htmlFor="birthDate">Nascimento<input autoComplete="bday" className="input-control" id="birthDate" type="date" required value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label>
            </div>
            <label className="field-label" htmlFor="registerPassword">Senha<input autoComplete="new-password" className="input-control" id="registerPassword" type="password" minLength={8} maxLength={72} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo de 8 caracteres" /></label>
            <button className="button button-primary auth-submit" disabled={loading} type="submit">{loading ? 'Criando conta...' : 'Criar minha conta'}<span>→</span></button>
          </form>
          <p className="auth-switch">Já tem uma conta? <Link href="/login">Entrar</Link></p>
          <div className="auth-security"><span>◈</span> Seus dados são protegidos e acessíveis apenas por você.</div>
        </div>
      </section>
    </main>
  );
}
