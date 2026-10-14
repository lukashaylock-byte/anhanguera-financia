'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível redefinir sua senha.');
      setNotice(data.message);
      setPassword('');
      setConfirmPassword('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ocorreu um erro ao redefinir sua senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout auth-recovery-layout">
      <section className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">RECUPERAÇÃO DE ACESSO</p>
          <h2>Crie uma nova senha</h2>
          <p className="auth-intro">Escolha uma senha com pelo menos 8 caracteres para proteger sua conta.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="team-notice" role="status">{notice}</div>}
          {token
            ? <form className="auth-form" onSubmit={handleSubmit}>
                <label className="field-label" htmlFor="new-password">Nova senha<input autoComplete="new-password" className="input-control" id="new-password" type="password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                <label className="field-label" htmlFor="confirm-password">Confirme a nova senha<input autoComplete="new-password" className="input-control" id="confirm-password" type="password" minLength={8} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
                <button className="button button-primary auth-submit" disabled={loading} type="submit">{loading ? 'Salvando...' : 'Redefinir senha'}<span>→</span></button>
              </form>
            : <div className="alert alert-error" role="alert">O link de redefinição é inválido ou expirou. Solicite um novo link.</div>}
          {notice
            ? <Link className="auth-back-link" href="/login">Ir para entrar</Link>
            : <Link className="auth-back-link" href="/esqueci-senha">Solicitar outro link</Link>}
        </div>
      </section>
    </main>
  );
}
