'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { UserRole } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { SessionManager } from '@/components/SessionManager';
import { PresenceProvider } from '@/components/PresenceProvider';
import './layout.css';

interface DashboardLayoutClientProps {
  role: UserRole;
  currentUser?: {
    id: string;
    full_name?: string;
    role?: string;
  } | null;
  children: React.ReactNode;
}

import GlobalFloatingTodo from '@/components/GlobalFloatingTodo';
import ITAttendanceModal from '@/components/ITAttendanceModal';
import GlobalSupportModal from '@/components/GlobalSupportModal';

export default function DashboardLayoutClient({ role, currentUser, children }: DashboardLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { showToast } = useToast();

  const supabase = createClient();

  useEffect(() => {
    async function checkUserMetadata() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.must_change_password) {
        setMustChangePassword(true);
      }
    }
    checkUserMetadata();

    const handleOpenSupport = () => setSupportOpen(true);
    window.addEventListener('open-global-support', handleOpenSupport);
    return () => window.removeEventListener('open-global-support', handleOpenSupport);
  }, [supabase]);

  const handleForceUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const { error } = await supabase.auth.updateUser({
      password: newPassword.trim(),
      data: { must_change_password: false },
    });

    if (error) {
      setErrorMsg(error.message);
      setIsSubmitting(false);
      return;
    }

    showToast('Password updated successfully! Welcome to FACEPrep LMS.', 'success');
    setMustChangePassword(false);
    setIsSubmitting(false);
  };

  return (
    <PresenceProvider currentUser={currentUser}>
      <SessionManager>
        <div className="layout">
          <Sidebar
            role={role}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
          <main className="main-content">
            <TopBar
              userRole={role}
              onToggleSidebar={() => setMobileOpen(!mobileOpen)}
            />
            {children}
          </main>

          {/* Global Floating To-Do Notes Widget */}
          <GlobalFloatingTodo />

          {/* Daily Internal Training (IT) Check Modal for Trainers */}
          <ITAttendanceModal currentUser={currentUser} />

          {/* Global Helpdesk & Support Ticket Request Modal */}
          <GlobalSupportModal
            isOpen={supportOpen}
            onClose={() => setSupportOpen(false)}
          />

          {/* Force Password Change Modal overlay */}
          {mustChangePassword && (
            <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)' }}>
              <div className="modal" style={{ maxWidth: 460, padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Action Required: Set New Password</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    You logged in with a temporary password. Please set a new permanent password to continue.
                  </p>
                </div>

                {errorMsg && (
                  <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid var(--error)', borderRadius: 6, padding: '0.6rem 0.85rem', color: 'var(--error)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <form onSubmit={handleForceUpdatePassword}>
                  <div className="form-group mb-3">
                    <label className="label">New Password *</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group mb-4">
                    <label className="label">Confirm New Password *</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-full" style={{ width: '100%', padding: '0.75rem' }} disabled={isSubmitting}>
                    {isSubmitting ? 'Updating Password...' : '🔒 Save New Password & Continue'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </SessionManager>
    </PresenceProvider>
  );
}
