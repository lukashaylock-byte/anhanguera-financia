'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível solicitar a redefinição.');
      setNotice(data.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ocorreu um erro ao solicitar a redefinição.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout auth-recovery-layout">
      <section className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">RECUPERAÇÃO DE ACESSO</p>
          <h2>Esqueceu sua senha?</h2>
          <p className="auth-intro">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="team-notice" role="status">{notice}</div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="recovery-email">E-mail<input autoComplete="email" className="input-control" id="recovery-email" type="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" /></label>
            <button className="button button-primary auth-submit" disabled={loading} type="submit">{loading ? 'Enviando...' : 'Enviar link de recuperação'}<span>→</span></button>
          </form>
          <Link className="auth-back-link" href="/login">← Voltar para entrar</Link>
        </div>
      </section>
    </main>
  );
}
