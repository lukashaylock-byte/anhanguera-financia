'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ workspaceType: 'EMPRESA', companyName: '', fullName: '', email: '', password: '', cpf: '', birthDate: '' });
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
        <Image
          src="/images/finance-team.jpg"
          alt="Equipe trabalhando em conjunto em um escritório moderno"
          fill
          priority
          sizes="(max-width: 760px) 100vw, 54vw"
          className="auth-story-image"
        />
        <Link href="/" className="brand auth-brand"><span className="brand-mark">A</span><span><span className="brand-name">Anhanguera</span><span className="brand-light">Financia</span></span></Link>
        <div className="story-content">
          <div className="story-orbit"><span>+</span><i /><i /><i /></div>
          <p className="eyebrow">FINANÇAS PARA A VIDA E OS NEGÓCIOS</p>
          <h1>Organize seu dinheiro.<br />Planeje o que vem pela frente.</h1>
          <p>Reúna contas, vencimentos e custos em uma visão simples para cuidar das finanças pessoais ou da empresa.</p>
          <div className="auth-feature-list">
            <div><span>↗</span><p><strong>Veja o caixa com clareza</strong><small>Separe valores realizados e previstos.</small></p></div>
            <div><span>▣</span><p><strong>Organize os vencimentos</strong><small>Planeje pagamentos e recebimentos.</small></p></div>
            <div><span>▤</span><p><strong>Entenda seus custos</strong><small>Acompanhe despesas por área e projeto.</small></p></div>
          </div>
        </div>
        <small className="story-footer">Clareza financeira para crescer com confiança.</small>
      </section>
      <section className="auth-main register-main">
        <div className="auth-card register-card">
          <p className="eyebrow">SEU PRÓXIMO PASSO</p>
          <h2>Finanças mais claras para você.</h2>
          <p className="auth-intro">Escolha seu tipo de espaço e organize as finanças pessoais ou da sua empresa.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form className="auth-form register-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="workspaceType">Tipo de cadastro<select className="input-control" id="workspaceType" value={form.workspaceType} onChange={(event) => setForm({ ...form, workspaceType: event.target.value })}><option value="EMPRESA">Empresa</option><option value="PESSOAL">Pessoa física (uso pessoal)</option></select></label>
            {form.workspaceType === 'EMPRESA' && <label className="field-label" htmlFor="companyName">Nome da empresa<input autoComplete="organization" className="input-control" id="companyName" type="text" maxLength={120} required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Ex.: Empresa Anhanguera" /></label>}
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
