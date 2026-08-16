/**
 * FACEPrep LMS — Learning Management System
 * Copyright (c) 2026 Dhanush Sadhasivan. All rights reserved.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from './ThemeProvider';
import { UserRole } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import './Sidebar.css';

interface SidebarProps {
  role: UserRole;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ role, mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Always start false so server HTML matches client initial render.
  // After mount we read localStorage and update — no hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('lms_sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('lms_sidebar_collapsed', String(next));
  };

  // Use the real collapsed value only after mount; before that treat as false
  // so the server-rendered HTML is never stale relative to what React expects.
  const isCollapsed = mounted && collapsed;


  const links = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        </svg>
      ),
    },
    {
      href: '/contests',
      label: 'Contests',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
        </svg>
      ),
    },
    {
      href: '/roadmaps',
      label: 'Topic Roadmaps',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h7v7H3z"/>
          <path d="M14 3h7v7h-7z"/>
          <path d="M3 14h7v7H3z"/>
          <path d="M17.5 17.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0"/>
          <path d="M10 6.5h4"/>
          <path d="M6.5 14v-4"/>
        </svg>
      ),
    },
    {
      href: '/courses',
      label: 'Skills & Badges',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15l-2 5l9-9l-9-9l2 5l-7 4z"/>
          <circle cx="12" cy="8" r="6"/>
        </svg>
      ),
    },
    {
      href: '/todos',
      label: 'To-Do Notes',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <polyline points="3 6 4 7 6 5"/>
          <polyline points="3 12 4 13 6 11"/>
          <polyline points="3 18 4 19 6 17"/>
        </svg>
      ),
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="5"></circle>
          <path d="M20 21a8 8 0 1 0-16 0"></path>
        </svg>
      ),
    },
  ];


  if (role === 'admin' || role === 'manager') {
    links.push(
      {
        href: '/admin/roadmaps',
        label: 'Manage Roadmaps',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        ),
      },
      {
        href: '/groups',
        label: 'Groups',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        ),
      },
      {
        href: '/notifications',
        label: 'Notifications',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
          </svg>
        ),
      },
      {
        href: '/admin/helpdesk',
        label: 'Helpdesk Support',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <path d="M7 15h10"></path>
            <path d="M7 9h10"></path>
          </svg>
        ),
      }
    );
  }

  if (role === 'admin') {
    links.push({
      href: '/admin/users',
      label: 'Users',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <line x1="19" y1="8" x2="19" y2="14"></line>
          <line x1="22" y1="11" x2="16" y2="11"></line>
        </svg>
      ),
    });
  }

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
              <div style={{ background: '#ffffff', padding: '4px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <img
                  src="/faceprep-logo.png"
                  alt="FACEPrep LMS"
                  style={{ height: '24px', width: 'auto', objectFit: 'contain' }}
                />
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--accent)', background: 'var(--accent-muted)', padding: '0.15rem 0.45rem', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                LMS
              </span>
            </div>
          ) : (
            <div style={{ background: '#ffffff', padding: '5px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <img
                src="/faceprep-icon.png"
                alt="FACEPrep Icon"
                style={{ height: '24px', width: '24px', objectFit: 'contain' }}
              />
            </div>
          )}
          <button
            className="sidebar-collapse-btn"
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
                title={isCollapsed ? link.label : undefined}
              >
                <span className="nav-icon">{link.icon}</span>
                {!isCollapsed && <span className="nav-label">{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <ThemeToggle showLabel={!isCollapsed} />
          <button
            onClick={handleLogout}
            className="logout-btn"
            title={isCollapsed ? 'Logout' : undefined}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!isCollapsed && <span>Logout</span>}
          </button>

          {!isCollapsed && (
            <div style={{
              padding: '0.5rem 0.6rem 0.2rem 0.6rem', textAlign: 'center',
              fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)',
              marginTop: '0.35rem', lineHeight: 1.35,
            }}>
              <div>© 2026 FACEPrep LMS</div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Designed &amp; Developed by<br />
                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>Dhanush Sadhasivan</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {mobileOpen && (
        <div className="sidebar-mobile-overlay" onClick={onCloseMobile} />
      )}
    </>
  );
}
