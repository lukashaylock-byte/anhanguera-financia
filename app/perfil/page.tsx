'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppSidebar from '../components/app-sidebar';

type Workspace = { id: string; name: string; role: string; workspaceType: string };
type Profile = {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  birthDate: string;
  createdAt: string;
  workspaces: Workspace[];
};
type User = {
  id: string;
  fullName: string;
  email: string;
  companyId: string;
  companyName: string;
  role: string;
  workspaces: Workspace[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProfile = useCallback(async () => {
    const [profileResponse, userResponse] = await Promise.all([
      fetch('/api/auth/profile', { cache: 'no-store' }),
      fetch('/api/auth/me', { cache: 'no-store' }),
    ]);
    if (profileResponse.status === 401 || userResponse.status === 401) {
      router.replace('/login');
      return null;
    }
    const [profileData, userData] = await Promise.all([
      profileResponse.json(),
      userResponse.json(),
    ]);
    if (!profileResponse.ok || !userResponse.ok) {
      throw new Error(profileData.error || userData.error || 'Não foi possível carregar seu perfil.');
    }
    return { profile: profileData.profile as Profile, user: userData.user as User };
  }, [router]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await loadProfile();
        if (active && data) {
          setProfile(data.profile);
          setFullName(data.profile.fullName);
          setEmail(data.profile.email);
          setUser(data.user);
        }
      } catch (loadError: unknown) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar seu perfil.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [loadProfile]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, currentPassword: profilePassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar seu perfil.');
      setProfilePassword('');
      setNotice(data.message);
      const refreshed = await loadProfile();
      if (refreshed) {
        setProfile(refreshed.profile);
        setFullName(refreshed.profile.fullName);
        setEmail(refreshed.profile.email);
        setUser(refreshed.user);
      }
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar seu perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }
    setSavingPassword(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível alterar sua senha.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setNotice(data.message);
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Erro ao alterar sua senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  const logout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) router.replace('/login');
    else setError('Não foi possível encerrar a sessão.');
  };

  if (loading) return <main className="loading-screen"><span className="spinner" />Carregando seu perfil...</main>;

  return (
    <div className="app-shell">
      <AppSidebar
        fullName={user?.fullName ?? ''}
        email={user?.email}
        companyId={user?.companyId ?? ''}
        companyName={user?.companyName ?? ''}
        workspaces={user?.workspaces ?? []}
        onLogout={() => void logout()}
      />
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><Link href="/">Painel</Link><span>/</span>Meu perfil</div>
          <div className="topbar-status"><span className="security-dot" />Conta protegida</div>
        </header>
        <section className="page-heading">
          <div><p className="eyebrow">SUA CONTA</p><h1>Meu perfil</h1><p className="muted">Mantenha seus dados de acesso atualizados e protegidos.</p></div>
        </section>
        {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}
        {notice && <div className="team-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}

        {profile && user && <>
          <section className="profile-hero panel">
            <div className="profile-hero-identity">
              <span className="profile-avatar">{profile.fullName.slice(0, 1).toUpperCase()}</span>
              <div><p className="eyebrow">PERFIL FINANCEIRO</p><h2>{profile.fullName}</h2><p>{profile.email}</p></div>
            </div>
            <div className="profile-hero-badge"><span className="security-dot" />Dados pessoais criptografados</div>
          </section>

          <section className="profile-grid">
            <article className="panel profile-panel">
              <div className="panel-heading"><div><h2>Informações pessoais</h2><p className="muted">Altere seu nome e e-mail de acesso.</p></div><span className="metric-icon green">◎</span></div>
              <form className="profile-form" onSubmit={saveProfile}>
                <label className="field-label" htmlFor="profile-name">Nome completo<input className="input-control" id="profile-name" autoComplete="name" maxLength={120} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
                <label className="field-label" htmlFor="profile-email">E-mail de acesso<input className="input-control" id="profile-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                <div className="profile-readonly-grid">
                  <div><span>CPF</span><strong>{profile.cpf}</strong><small>Protegido e não editável</small></div>
                  <div><span>Data de nascimento</span><strong>{new Date(`${profile.birthDate}T12:00:00`).toLocaleDateString('pt-BR')}</strong><small>Informada no cadastro</small></div>
                </div>
                <label className="field-label" htmlFor="profile-current-password">Confirme com sua senha atual<input className="input-control" id="profile-current-password" type="password" autoComplete="current-password" maxLength={72} required value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} /></label>
                <button className="button button-primary" type="submit" disabled={savingProfile}>{savingProfile ? 'Salvando...' : 'Salvar alterações'}</button>
              </form>
            </article>

            <div className="profile-side-column">
              <article className="panel profile-panel">
                <div className="panel-heading"><div><h2>Segurança da conta</h2><p className="muted">Use uma senha forte e exclusiva.</p></div><span className="metric-icon blue">◇</span></div>
                <form className="profile-form" onSubmit={changePassword}>
                  <label className="field-label" htmlFor="current-password">Senha atual<input className="input-control" id="current-password" type="password" autoComplete="current-password" maxLength={72} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                  <label className="field-label" htmlFor="new-password">Nova senha<input className="input-control" id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                  <label className="field-label" htmlFor="confirm-new-password">Confirme a nova senha<input className="input-control" id="confirm-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} /></label>
                  <p className="profile-hint">A senha deve ter entre 8 e 72 caracteres. A troca exige confirmação da senha atual.</p>
                  <button className="button button-secondary" type="submit" disabled={savingPassword}>{savingPassword ? 'Atualizando...' : 'Atualizar senha'}</button>
                </form>
              </article>

              <article className="panel profile-panel">
                <div className="panel-heading"><div><h2>Seus espaços</h2><p className="muted">Empresas e espaços pessoais vinculados à sua conta.</p></div><span className="metric-icon violet">▦</span></div>
                <div className="profile-workspaces">{profile.workspaces.map((workspace) => <div className="profile-workspace" key={workspace.id}><span className="workspace-icon-light">{workspace.workspaceType === 'PESSOAL' ? '◉' : '▦'}</span><span><strong>{workspace.name}</strong><small>{workspace.workspaceType === 'PESSOAL' ? 'Espaço pessoal' : 'Espaço empresarial'} · {workspace.role === 'ADMINISTRADOR' ? 'Administrador' : workspace.role === 'FINANCEIRO' ? 'Financeiro' : 'Somente leitura'}</small></span></div>)}</div>
                <p className="profile-hint">Conta criada em {new Date(profile.createdAt).toLocaleDateString('pt-BR')}.</p>
              </article>
            </div>
          </section>
        </>}
        <footer className="app-footer">Anhanguera Financia <span>•</span> Configurações da conta.</footer>
      </main>
    </div>
  );
}
