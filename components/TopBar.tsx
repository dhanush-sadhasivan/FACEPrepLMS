'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import './TopBar.css';

interface TopBarProps {
  userRole: string;
  onToggleSidebar?: () => void;
}

export function TopBar({ userRole, onToggleSidebar }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine if we are on a nested route where a Back button should be shown
  const isNestedRoute =
    pathname !== '/dashboard' &&
    pathname !== '/contests' &&
    pathname !== '/groups' &&
    pathname !== '/admin/users' &&
    pathname !== '/profile' &&
    pathname !== '/notifications';

  // Compute breadcrumb items
  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    const items = [{ label: 'Dashboard', href: '/dashboard' }];
    let currentPath = '';

    parts.forEach((part) => {
      currentPath += `/${part}`;
      if (part === 'dashboard') return;
      if (part === 'admin') return;

      let label = part.charAt(0).toUpperCase() + part.slice(1);
      if (part === 'users') label = 'User Management';
      if (part === 'contests') label = 'Contests';
      if (part === 'skills') label = 'Skills & Badges';
      if (part === 'groups') label = 'Groups';
      if (part === 'new') label = 'Create New';
      if (part === 'edit') label = 'Edit';
      if (part.length > 20) label = 'Details';

      items.push({ label, href: currentPath });
    });

    return items;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Mobile Sidebar Toggle Button */}
        {onToggleSidebar && (
          <button className="mobile-menu-btn" onClick={onToggleSidebar} title="Toggle Navigation Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {/* Back Button */}
        {isNestedRoute && (
          <button className="back-btn" onClick={() => router.back()} title="Go Back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Back</span>
          </button>
        )}

        {/* Breadcrumb trail */}
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((item, idx) => (
            <span key={`${item.href}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {idx > 0 && (
                <span className="breadcrumb-separator" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </span>
              )}
              <Link
                href={item.href}
                className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>

      {/* TopBar Right: Support Ticket & Floating Notes Trigger Buttons */}
      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => window.dispatchEvent(new Event('open-global-support'))}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.65rem', fontSize: '0.78rem', fontWeight: 700,
            borderRadius: '999px', cursor: 'pointer',
          }}
          title="Open Helpdesk & Support Request"
        >
          <span>🎧</span>
          <span>Support</span>
        </button>

        <button
          onClick={() => window.dispatchEvent(new Event('toggle-floating-todo'))}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.65rem', fontSize: '0.78rem', fontWeight: 700,
            borderRadius: '999px', cursor: 'pointer',
          }}
          title="Open Floating To-Do Notes"
        >
          <span>📝</span>
          <span>Quick Notes</span>
        </button>
      </div>
    </header>
  );
}
