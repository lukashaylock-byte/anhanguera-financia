'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import AppSidebar from '../../components/app-sidebar';

type Workspace = { id: string; name: string; role: string; workspaceType: string };
type User = { id: string; fullName: string; email: string; companyId: string; companyName: string; role: string; workspaces: Workspace[] };
type Member = { id: string; role: string; createdAt: string; user: { id: string; fullName: string; email: string } };
type TeamData = { company: { id: string; name: string }; memberships: Member[] };
type EncryptionProgress = {
  keyConfigured: boolean;
  migrationReady: boolean;
  usersWithPlaintext: number;
  invitationsWithPlaintext: number;
  finalized: boolean;
};

async function fetchEncryptionProgress() {
  const response = await fetch('/api/company/encryption/finalize', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível verificar a criptografia.');
  return data as EncryptionProgress;
}

const roleNames: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  FINANCEIRO: 'Financeiro',
  LEITURA: 'Somente leitura',
};
const roleDescriptions: Record<string, string> = {
  ADMINISTRADOR: 'Gerencia a empresa, equipe e todos os dados financeiros.',
  FINANCEIRO: 'Cria e atualiza lançamentos, contas e análises financeiras.',
  LEITURA: 'Consulta o painel, contas e relatórios sem alterar dados.',
};
export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('FINANCEIRO');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [finalizingEncryption, setFinalizingEncryption] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState<EncryptionProgress | null>(null);
  const [encryptionStatusError, setEncryptionStatusError] = useState('');
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    const [userResponse, teamResponse] = await Promise.all([
      fetch('/api/auth/me', { cache: 'no-store' }),
      fetch('/api/team', { cache: 'no-store' }),
    ]);
    if (userResponse.status === 401 || teamResponse.status === 401) {
      router.replace('/login');
      return null;
    }
    const [userData, teamData] = await Promise.all([userResponse.json(), teamResponse.json()]);
    if (!userResponse.ok || !teamResponse.ok) throw new Error(teamData.error || 'Não foi possível carregar a equipe.');
    return { user: userData.user as User, team: teamData as TeamData };
  }, [router]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await loadData();
        if (active && data) {
          setUser(data.user);
          setTeam(data.team);
          setCompanyName(data.team.company.name);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar a equipe.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [loadData]);

  const refreshEncryptionProgress = useCallback(async () => {
    try {
      setEncryptionProgress(await fetchEncryptionProgress());
      setEncryptionStatusError('');
    } catch (statusError) {
      setEncryptionStatusError(statusError instanceof Error ? statusError.message : 'Não foi possível verificar a criptografia.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const checkProgress = async () => {
      try {
        const progress = await fetchEncryptionProgress();
        if (active) {
          setEncryptionProgress(progress);
          setEncryptionStatusError('');
        }
      } catch (statusError) {
        if (active) setEncryptionStatusError(statusError instanceof Error ? statusError.message : 'Não foi possível verificar a criptografia.');
      }
    };
    void checkProgress();
    return () => { active = false; };
  }, []);

  const refreshTeam = async () => {
    const data = await loadData();
    if (data) {
      setUser(data.user);
      setTeam(data.team);
      setCompanyName(data.team.company.name);
    }
  };

  const updateCompanyName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o nome.');
      setNotice('Nome da empresa atualizado.');
      await refreshTeam();
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar a empresa.');
    } finally {
      setSaving(false);
    }
  };

  const memberRequest = async (member: Member, action: 'role' | 'remove', nextRole?: string) => {
    const message = action === 'remove'
      ? `Remover ${member.user.fullName} do espaço financeiro desta empresa?`
      : `Alterar o perfil de ${member.user.fullName}?`;
    if (!window.confirm(message)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/team/members/${encodeURIComponent(member.id)}`, {
        method: action === 'remove' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        ...(action === 'role' ? { body: JSON.stringify({ role: nextRole }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o membro.');
      setNotice(action === 'remove' ? 'Membro removido da empresa.' : 'Perfil atualizado.');
      await refreshTeam();
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'Erro ao atualizar o membro.');
    }
  };

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = newMemberEmail.trim();
    if (!window.confirm(`Adicionar ${email} à empresa? A conta terá acesso imediato aos dados financeiros conforme o perfil escolhido.`)) return;
    setAddingMember(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: newMemberRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível adicionar o membro.');
      setNewMemberEmail('');
      setNotice(data.message);
      await refreshTeam();
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'Erro ao adicionar o membro.');
    } finally {
      setAddingMember(false);
    }
  };

  const finalizeEncryption = async () => {
    const confirmed = window.confirm('Esta ação se aplica a todas as contas e convites do sistema e remove permanentemente os campos pessoais em texto puro. Confirme que você possui um backup restaurável e uma cópia segura da chave de criptografia.');
    if (!confirmed) return;
    setFinalizingEncryption(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/company/encryption/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupConfirmed: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível finalizar a criptografia.');
      setNotice(data.message);
      setBackupConfirmed(false);
      await refreshEncryptionProgress();
    } catch (encryptionError) {
      setError(encryptionError instanceof Error ? encryptionError.message : 'Erro ao finalizar a criptografia.');
    } finally {
      setFinalizingEncryption(false);
    }
  };

  const logout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) router.replace('/login');
    else setError('Não foi possível encerrar a sessão.');
  };

  if (loading) return <main className="loading-screen"><span className="spinner" />Carregando as configurações da empresa...</main>;

  return (
    <div className="app-shell">
      <AppSidebar fullName={user?.fullName ?? ''} email={user?.email} companyId={user?.companyId ?? ''} companyName={user?.companyName ?? ''} workspaces={user?.workspaces ?? []} onLogout={() => void logout()} />
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><Link href="/">Painel</Link><span>/</span>Empresa e equipe</div><div className="topbar-status"><span className="security-dot" />Acesso administrativo</div></header>
        <section className="page-heading"><div><p className="eyebrow">CONFIGURAÇÕES DO ESPAÇO</p><h1>Empresa e equipe</h1><p className="muted">Defina o nome do espaço e gerencie os acessos existentes aos dados financeiros.</p></div></section>
        {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}
        {notice && <div className="team-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
        <section className="team-settings-grid">
          <article className="panel company-settings-panel"><div className="panel-heading"><div><h2>Dados da empresa</h2><p className="muted">Nome mostrado na navegação da equipe.</p></div><span className="metric-icon green">▦</span></div>
            <form className="team-company-form" onSubmit={updateCompanyName}><label className="field-label" htmlFor="company-name">Nome da empresa<input className="input-control" id="company-name" maxLength={120} required value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></form>
          </article>
        </section>
        <section className="panel company-settings-panel"><div className="panel-heading"><div><h2>Adicionar membro</h2><p className="muted">Vincule uma conta já cadastrada. Não enviamos convite por e-mail.</p></div><span className="metric-icon green">＋</span></div>
          <form className="team-company-form" onSubmit={addMember}>
            <label className="field-label" htmlFor="member-email">E-mail da conta<input className="input-control" id="member-email" type="email" autoComplete="email" maxLength={254} required value={newMemberEmail} onChange={(event) => setNewMemberEmail(event.target.value)} /></label>
            <label className="field-label" htmlFor="member-role">Perfil de acesso<select className="select-control" id="member-role" value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value)}><option value="ADMINISTRADOR">Administrador</option><option value="FINANCEIRO">Financeiro</option><option value="LEITURA">Somente leitura</option></select></label>
            <p className="role-description">A pessoa precisa ter uma conta existente. Ao adicionar, ela terá acesso imediato aos dados financeiros desta empresa.</p>
            <button className="button button-primary" type="submit" disabled={addingMember}>{addingMember ? 'Adicionando...' : 'Adicionar à empresa'}</button>
          </form>
        </section>
        <section className="panel team-members-panel"><div className="panel-heading"><div><h2>Membros da empresa</h2><p className="muted">{team?.memberships.length ?? 0} pessoa(s) com acesso ao espaço financeiro.</p></div><span className="team-count">{team?.memberships.length ?? 0} membros</span></div>
          <div className="team-member-list">{team?.memberships.map((member) => <article className="team-member-row" key={member.id}><span className="avatar">{member.user.fullName.slice(0, 1).toUpperCase()}</span><div className="team-member-identity"><strong>{member.user.fullName}</strong><small>{member.user.email}</small></div><span className={`role-badge role-${member.role.toLowerCase()}`}>{roleNames[member.role] ?? member.role}</span>{member.user.id !== user?.id ? <div className="team-member-actions"><label className="sr-only" htmlFor={`role-${member.id}`}>Perfil de {member.user.fullName}</label><select id={`role-${member.id}`} className="select-control" value={member.role} onChange={(event) => void memberRequest(member, 'role', event.target.value)}><option value="ADMINISTRADOR">Administrador</option><option value="FINANCEIRO">Financeiro</option><option value="LEITURA">Somente leitura</option></select><button className="button button-secondary remove-member-button" onClick={() => void memberRequest(member, 'remove')}>Remover</button></div> : <span className="current-member-label">Você</span>}</article>)}</div>
        </section>
        <section className="panel permissions-panel"><div className="panel-heading"><div><h2>O que cada perfil pode fazer</h2><p className="muted">As permissões são verificadas no servidor em cada operação.</p></div></div><div className="permission-grid">{(['ADMINISTRADOR', 'FINANCEIRO', 'LEITURA'] as const).map((item) => <article key={item}><span className={`role-badge role-${item.toLowerCase()}`}>{roleNames[item]}</span><p>{roleDescriptions[item]}</p></article>)}</div></section>
        <section className="panel permissions-panel encryption-panel" aria-labelledby="encryption-title">
          <div className="panel-heading"><div><h2 id="encryption-title">Criptografia de dados pessoais</h2><p className="muted">AES-256-GCM protege campos pessoais; hashes HMAC permitem localizar contas sem texto puro.</p></div><span className="metric-icon green" aria-hidden="true">◈</span></div>
          <p className="role-description encryption-description">A verificação confirma se a chave está válida na implantação ativa e se a migração do banco está disponível. A etapa final criptografa os dados pessoais e remove as cópias em texto puro de todas as contas e convites do sistema.</p>
          <div className="encryption-status" role="status" aria-live="polite">
            {encryptionStatusError
              ? <p className="encryption-status-error">{encryptionStatusError}</p>
              : !encryptionProgress
                ? <p>Verificando chave e migração...</p>
                : encryptionProgress.finalized
                  ? <p className="encryption-status-ready">Criptografia finalizada. Não há cópias em texto puro pendentes.</p>
                  : <ul>
                      <li>Chave de criptografia: {encryptionProgress.keyConfigured ? 'válida' : 'indisponível'}.</li>
                      <li>Migração do banco: {encryptionProgress.migrationReady ? 'disponível' : 'pendente'}.</li>
                      <li>Registros a finalizar: {encryptionProgress.usersWithPlaintext} conta(s) e {encryptionProgress.invitationsWithPlaintext} convite(s).</li>
                    </ul>}
          </div>
          {!encryptionProgress?.finalized && <label className="encryption-backup-confirmation">
            <input type="checkbox" checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} />
            <span>Confirmo que tenho um backup do banco testado para restauração e uma cópia segura da chave guardada fora da Vercel.</span>
          </label>}
          <button className="button button-secondary encryption-finalize-button" type="button" disabled={finalizingEncryption || !encryptionProgress || !encryptionProgress.keyConfigured || !encryptionProgress.migrationReady || encryptionProgress.finalized || !backupConfirmed} onClick={() => void finalizeEncryption()}>{finalizingEncryption ? 'Criptografando dados...' : 'Finalizar criptografia e remover cópias em texto puro'}</button>
        </section>
        <footer className="app-footer">Anhanguera Financia <span>•</span> Gestão de acessos da empresa.</footer>
      </main>
    </div>
  );
}
