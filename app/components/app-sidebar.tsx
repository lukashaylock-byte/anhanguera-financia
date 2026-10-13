'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type Workspace = { id: string; name: string; role: string; workspaceType: string };
type AppSidebarProps = {
  fullName: string;
  email?: string;
  companyId: string;
  companyName: string;
  workspaces: Workspace[];
  onLogout: () => void;
};

const navigation = [
  { href: '/', icon: '◫', label: 'Visão geral' },
  { href: '/contas', icon: '▣', label: 'Contas' },
  { href: '/centros-de-custo', icon: '▤', label: 'Centros de custo' },
  { href: '/relatorios', icon: '▥', label: 'Relatórios' },
  { href: '/perfil', icon: '◉', label: 'Meu perfil' },
  { href: '/empresa/equipe', icon: '♙', label: 'Empresa e equipe' },
];

const roleLabels: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  FINANCEIRO: 'Financeiro',
  LEITURA: 'Somente leitura',
};

export default function AppSidebar({ fullName, email, companyId, companyName, workspaces, onLogout }: AppSidebarProps) {
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');

  const switchWorkspace = async (nextCompanyId: string) => {
    if (nextCompanyId === companyId) return;
    setSwitching(true);
    setSwitchError('');
    try {
      const response = await fetch('/api/companies/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: nextCompanyId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível trocar de espaço.');
      window.location.assign(pathname);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Erro ao trocar de espaço.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link href="/" className="brand">
          <span className="brand-mark">A</span>
          <span><span className="brand-name">Anhanguera</span><span className="brand-light">Financia</span></span>
        </Link>
        <button className="logout-button logout-mobile-button" type="button" onClick={onLogout}>
          <span className="nav-icon" aria-hidden="true">↪</span>Sair da conta
        </button>
      </div>
      <label className="workspace-chip"><span className="workspace-icon">▦</span><span className="workspace-select-wrap"><strong>{workspaces.find((workspace) => workspace.id === companyId)?.workspaceType === 'PESSOAL' ? 'Espaço pessoal' : 'Empresa ativa'}</strong>
        {workspaces.length > 1
          ? <select aria-label="Trocar espaço financeiro" className="workspace-select" value={companyId} disabled={switching} onChange={(event) => void switchWorkspace(event.target.value)}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.workspaceType === 'PESSOAL' ? 'Pessoal' : 'Empresa'}</option>)}</select>
          : <small title={companyName}>{companyName}</small>}
      </span>{workspaces.length > 1 && <span className="workspace-chevron">{switching ? '…' : '⌄'}</span>}</label>
      {switchError && <p className="workspace-error" role="alert">{switchError}</p>}
      <p className="nav-caption">MENU PRINCIPAL</p>
      <nav className="side-nav" aria-label="Navegação principal">
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
          const currentWorkspace = workspaces.find((workspace) => workspace.id === companyId);
          const isAdmin = currentWorkspace?.role === 'ADMINISTRADOR';
          if (item.href === '/empresa/equipe' && (!isAdmin || currentWorkspace?.workspaceType !== 'EMPRESA')) return null;
          return (
            <Link key={item.href} href={item.href} className={`nav-link${active ? ' active' : ''}`} aria-label={item.label} title={item.label} aria-current={active ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span>
              {item.href === '/contas' && <span className="nav-link-arrow">→</span>}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="security-note"><span className="security-dot" /><div><strong>Seus dados protegidos</strong><small>Acesso seguro à sua conta</small></div></div>
        <Link className="sidebar-profile" href="/perfil" aria-label="Abrir meu perfil"><span className="avatar">{fullName.slice(0, 1).toUpperCase() || 'U'}</span><div><strong>{fullName}</strong><small>{roleLabels[workspaces.find((workspace) => workspace.id === companyId)?.role ?? ''] ?? email ?? 'Conta financeira'}</small></div><span className="profile-arrow" aria-hidden="true">↗</span></Link>
        <button className="nav-link logout-button logout-desktop-button" type="button" onClick={onLogout}><span className="nav-icon">↪</span>Sair da conta</button>
      </div>
    </aside>
  );
}
