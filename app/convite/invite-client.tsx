'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

type Invitation = { email: string; role: string; companyName: string; expiresAt: string };
type User = { email: string; fullName: string };
type Form = { fullName: string; password: string; cpf: string; birthDate: string };

const roleNames: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  FINANCEIRO: 'Financeiro',
  LEITURA: 'Somente leitura',
};

export default function InviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<Form>({ fullName: '', password: '', cpf: '', birthDate: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [inviteResponse, userResponse] = await Promise.all([
          fetch(`/api/team/invitations/lookup?token=${encodeURIComponent(token)}`, { cache: 'no-store' }),
          fetch('/api/auth/me', { cache: 'no-store' }),
        ]);
        const inviteData = await inviteResponse.json();
        if (!inviteResponse.ok) throw new Error(inviteData.error || 'Este convite não está disponível.');
        const userData = userResponse.ok ? await userResponse.json() : null;
        if (active) {
          setInvitation(inviteData.invitation);
          setUser(userData?.user ?? null);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível validar o convite.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [token]);

  const acceptInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/team/invitations/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email: invitation?.email, token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar sua conta.');
      router.replace('/');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao aceitar o convite.');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptAsCurrentUser = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/team/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível aceitar o convite.');
      router.replace('/');
      router.refresh();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Erro ao aceitar o convite.');
    } finally {
      setSubmitting(false);
    }
  };

  const loginLink = `/login?redirectTo=${encodeURIComponent(`/convite?token=${token}`)}`;

  if (loading) return <main className="loading-screen"><span className="spinner" />Validando seu convite...</main>;

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/" className="brand auth-brand"><span className="brand-mark">A</span><span><span className="brand-name">Anhanguera</span><span className="brand-light">Financia</span></span></Link>
        <div className="story-content"><div className="story-orbit"><span>↗</span><i /><i /><i /></div><p className="eyebrow">TRABALHO EM EQUIPE, FINANÇAS EM ORDEM</p><h1>Um mesmo espaço.<br />Mais colaboração.</h1><p>Compartilhe o acompanhamento financeiro com os colegas certos e mantenha cada empresa organizada.</p></div>
        <small className="story-footer">Acesso seguro com perfil individual.</small>
      </section>
      <section className="auth-main">
        <div className="auth-card invite-card">
          <p className="eyebrow">CONVITE PARA A EQUIPE</p>
          {invitation ? <>
            <h2>Você foi convidado.</h2>
            <p className="auth-intro"><strong>{invitation.companyName}</strong> convidou <strong>{invitation.email}</strong> para participar como <strong>{roleNames[invitation.role] ?? 'membro'}</strong>.</p>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {user && user.email.toLowerCase() === invitation.email.toLowerCase() ? <div className="invite-accept-block"><div className="invite-user-note"><span className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</span><div><strong>Conectado como {user.fullName}</strong><small>{user.email}</small></div></div><button className="button button-primary auth-submit" disabled={submitting} onClick={() => void acceptAsCurrentUser()}>{submitting ? 'Aceitando...' : 'Aceitar e acessar empresa'}<span>→</span></button></div>
              : user ? <div className="invite-existing-user"><p>Este convite foi enviado para <strong>{invitation.email}</strong>, mas você está conectado como <strong>{user.email}</strong>.</p><Link className="button button-primary auth-submit" href={loginLink}>Entrar com o e-mail convidado <span>→</span></Link></div>
                : <>
                  <div className="invite-existing-user"><p>Já possui uma conta com esse e-mail?</p><Link className="button button-secondary invite-login-link" href={loginLink}>Entrar para aceitar o convite</Link></div>
                  <div className="invite-divider"><span>OU CRIE SEU ACESSO</span></div>
                  <form className="auth-form register-form" onSubmit={acceptInvite}>
                    <label className="field-label" htmlFor="inviteName">Nome completo<input className="input-control" autoComplete="name" id="inviteName" maxLength={120} required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
                    <label className="field-label" htmlFor="inviteEmail">E-mail do convite<input className="input-control" id="inviteEmail" type="email" readOnly value={invitation.email} /></label>
                    <div className="form-row"><label className="field-label" htmlFor="inviteCpf">CPF<input className="input-control" id="inviteCpf" inputMode="numeric" maxLength={14} required value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} /></label><label className="field-label" htmlFor="inviteBirthDate">Nascimento<input className="input-control" id="inviteBirthDate" type="date" required value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label></div>
                    <label className="field-label" htmlFor="invitePassword">Crie sua senha<input className="input-control" id="invitePassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
                    <button className="button button-primary auth-submit" disabled={submitting} type="submit">{submitting ? 'Criando acesso...' : 'Criar acesso e aceitar'}<span>→</span></button>
                  </form>
                </>}
          </> : <><h2>Convite indisponível.</h2><p className="auth-intro">{error || 'Peça ao administrador da empresa para enviar outro convite.'}</p><Link className="button button-primary auth-submit" href="/login">Ir para entrar <span>→</span></Link></>}
          <div className="auth-security"><span>◈</span> Seus dados só serão compartilhados com a empresa deste convite.</div>
        </div>
      </section>
    </main>
  );
}
