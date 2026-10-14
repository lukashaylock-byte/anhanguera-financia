'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Invitation = { email: string; role: string; companyName: string; expiresAt: string };
type CurrentUser = { email: string };

const roleNames: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  FINANCEIRO: 'Financeiro',
  OPERACIONAL: 'Operacional',
  LEITURA: 'Somente leitura',
};

export default function InvitationClient({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!token) throw new Error('O link do convite está incompleto.');
        const [invitationResponse, userResponse] = await Promise.all([
          fetch(`/api/team/invitations/lookup?token=${encodeURIComponent(token)}`, { cache: 'no-store' }),
          fetch('/api/auth/me', { cache: 'no-store' }),
        ]);
        const invitationData = await invitationResponse.json();
        const userData = userResponse.ok ? await userResponse.json() : null;
        if (!invitationResponse.ok) throw new Error(invitationData.error || 'Este convite é inválido ou expirou.');
        if (active) {
          setInvitation(invitationData.invitation);
          setUser(userData?.user ?? null);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível verificar o convite.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [token]);

  const accept = async () => {
    setAccepting(true);
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
      setError(acceptError instanceof Error ? acceptError.message : 'Não foi possível aceitar o convite.');
    } finally {
      setAccepting(false);
    }
  };

  const loginUrl = `/login?redirectTo=${encodeURIComponent(`/convite?token=${token}`)}`;
  const signupUrl = `/register?invitationToken=${encodeURIComponent(token)}`;

  return (
    <main className="auth-layout">
      <section className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">ACESSO À EMPRESA</p>
          <h1>Convite para a equipe</h1>
          {loading && <p className="auth-intro">Verificando o convite...</p>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {invitation && <>
            <p className="auth-intro">Você foi convidado para acessar <strong>{invitation.companyName}</strong> como <strong>{roleNames[invitation.role] ?? invitation.role}</strong>.</p>
            <p className="auth-intro">E-mail convidado: <strong>{invitation.email}</strong></p>
            {user
              ? user.email.toLowerCase() === invitation.email.toLowerCase()
                ? <button className="button button-primary auth-submit" disabled={accepting} onClick={() => void accept()}>{accepting ? 'Aceitando convite...' : 'Aceitar convite'}</button>
                : <p className="auth-intro">Sua sessão está aberta com outro e-mail. <Link href={loginUrl}>Entre com {invitation.email}</Link> para aceitar.</p>
              : <div className="auth-form"><Link className="button button-primary auth-submit" href={signupUrl}>Criar conta e aceitar convite</Link><p className="auth-switch">Já tem uma conta? <Link href={loginUrl}>Entrar para aceitar</Link></p></div>}
          </>}
          <p className="auth-switch"><Link href="/login">Voltar ao login</Link></p>
        </div>
      </section>
    </main>
  );
}
