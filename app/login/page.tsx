'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível entrar na sua conta.');
      const requestedDestination = new URLSearchParams(window.location.search).get('redirectTo') ?? '/';
      const destination = new URL(requestedDestination, window.location.origin);
      router.replace(destination.origin === window.location.origin
        ? `${destination.pathname}${destination.search}${destination.hash}`
        : '/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ocorreu um erro ao entrar.');
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
          <div className="story-orbit"><span>R$</span><i /><i /><i /></div>
          <p className="eyebrow">GESTÃO FINANCEIRA QUE FAZ SENTIDO</p>
          <h1>Mais clareza.<br />Melhores decisões.</h1>
          <p>Receitas, despesas e compromissos em um só lugar. Acompanhe o caixa pessoal ou da empresa e siga em frente com confiança.</p>
          <div className="auth-feature-list">
            <div><span>↗</span><p><strong>Visão clara do caixa</strong><small>Saiba o que entrou e o que está previsto.</small></p></div>
            <div><span>▣</span><p><strong>Vencimentos sob controle</strong><small>Organize contas a pagar e a receber.</small></p></div>
            <div><span>▤</span><p><strong>Custos bem organizados</strong><small>Acompanhe despesas por área e projeto.</small></p></div>
          </div>
        </div>
        <small className="story-footer">Clareza financeira para crescer com confiança.</small>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">SEU ESPAÇO FINANCEIRO</p>
          <h2>Bom ter você de volta.</h2>
          <p className="auth-intro">Acesse seu espaço financeiro e tenha os números importantes sempre à mão.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="email">E-mail<input autoComplete="email" className="input-control" id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" /></label>
            <label className="field-label" htmlFor="password">Senha<input autoComplete="current-password" className="input-control" id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" /></label>
            <button className="button button-primary auth-submit" disabled={loading} type="submit">{loading ? 'Entrando...' : 'Entrar na conta'}<span>→</span></button>
          </form>
          <p className="auth-switch">Ainda não tem uma conta? <Link href="/register">Criar conta</Link></p>
          <div className="auth-security"><span>◈</span> Seus dados são protegidos e acessíveis apenas por você.</div>
        </div>
      </section>
    </main>
  );
}
