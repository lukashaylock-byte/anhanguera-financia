'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type AppSidebarProps = {
  fullName: string;
  email?: string;
  onLogout: () => void;
};

const navigation = [
  { href: '/', icon: '◫', label: 'Visão geral' },
  { href: '/contas', icon: '▣', label: 'Contas' },
  { href: '/centros-de-custo', icon: '▤', label: 'Centros de custo' },
  { href: '/relatorios', icon: '▥', label: 'Relatórios' },
];

export default function AppSidebar({ fullName, email, onLogout }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <span className="brand-mark">A</span>
        <span><span className="brand-name">Anhanguera</span><span className="brand-light">Financia</span></span>
      </Link>
      <div className="workspace-chip"><span className="workspace-icon">▦</span><span><strong>Área financeira</strong><small>Ambiente de gestão</small></span><span className="workspace-chevron">⌄</span></div>
      <p className="nav-caption">MENU PRINCIPAL</p>
      <nav className="side-nav" aria-label="Navegação principal">
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
          return (
            <Link key={item.href} href={item.href} className={`nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.href === '/contas' && <span className="nav-link-arrow">→</span>}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="security-note"><span className="security-dot" /><div><strong>Seus dados protegidos</strong><small>Acesso seguro à sua conta</small></div></div>
        <div className="sidebar-profile"><span className="avatar">{fullName.slice(0, 1).toUpperCase() || 'U'}</span><div><strong>{fullName}</strong><small>{email || 'Conta financeira'}</small></div></div>
        <button className="nav-link logout-button" type="button" onClick={onLogout}><span className="nav-icon">↪</span>Sair da conta</button>
      </div>
    </aside>
  );
}
