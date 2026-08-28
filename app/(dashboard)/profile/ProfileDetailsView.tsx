'use client';

import { useState, useEffect, useCallback } from 'react';
import ProfileChangeRequestModal from './ProfileChangeRequestModal';
import AdminDirectEditModal from './AdminDirectEditModal';
import ProfileTicketsList from './ProfileTicketsList';

interface ProfileDetailsViewProps {
  initialData: {
    id: string;
    full_name: string;
    email: string;
    emp_email?: string | null;
    emp_id: string;
    team?: string | null;
    manager?: string | null;
    hackerrank_id?: string | null;
    leetcode_id?: string | null;
    role: string;
    updated_by?: string | null;
    updated_at?: string | null;
    updater?: {
      id: string;
      full_name: string;
      role?: string;
    } | null;
  };
}

export default function ProfileDetailsView({ initialData }: ProfileDetailsViewProps) {
  const [profileData, setProfileData] = useState(initialData);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isAdminEditModalOpen, setIsAdminEditModalOpen] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const isAdminOrManager = profileData.role === 'admin' || profileData.role === 'manager';

  const fetchTickets = useCallback(async () => {
    if (isAdminOrManager) return; // Only trainers track personal ticket approvals on this page
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/support-tickets');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  }, [isAdminOrManager]);

  useEffect(() => {
    if (!isAdminOrManager) {
      fetchTickets();
    }
  }, [isAdminOrManager, fetchTickets]);

  const cleanDisplay = (val?: string | null) => {
    if (!val) return '—';
    const s = String(val).trim();
    if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(s.toLowerCase())) return '—';
    return s;
  };

  const handleProfileUpdated = (updatedUser: any) => {
    setProfileData((prev) => ({ ...prev, ...updatedUser }));
  };

  return (
    <div>
      {/* Account Preferences / Details Card */}
      <div className="profile-settings-card">
        <div className="profile-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>👤 Account Profile Details</span>
            {isAdminOrManager ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999, background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(240,82,55,0.3)' }}>
                👑 System {profileData.role === 'admin' ? 'Admin' : 'Manager'}
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: 'var(--indigo)', border: '1px solid rgba(99,102,241,0.25)' }}>
                🎓 Trainer Account
              </span>
            )}
          </div>

          {/* Single Action Button based on Role */}
          {isAdminOrManager ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsAdminEditModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700 }}
            >
              <span>✏️</span> Edit Profile
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsRequestModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700 }}
            >
              <span>🎫</span> Request Profile Change
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.15rem' }}>
          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Name</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {profileData.full_name || '—'}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employee ID</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
              {profileData.emp_id || '—'}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Login Email</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {profileData.email || '—'}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employee Work Email</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {cleanDisplay(profileData.emp_email) !== '—' ? profileData.emp_email : (profileData.email || '—')}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Team / Department</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              🏢 {cleanDisplay(profileData.team)}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reporting Manager</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              👤 {cleanDisplay(profileData.manager)}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>HackerRank Handle</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {profileData.hackerrank_id ? (
                <a
                  href={`https://www.hackerrank.com/profile/${profileData.hackerrank_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  ⚡ @{profileData.hackerrank_id} ↗
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Not linked</span>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>LeetCode Handle</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {profileData.leetcode_id ? (
                <a
                  href={`https://leetcode.com/u/${profileData.leetcode_id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#ffa116', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  🟠 @{profileData.leetcode_id} ↗
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Not linked</span>
              )}
            </div>
          </div>
        </div>

        {/* Audit Trace Information */}
        {profileData.updated_at && (
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🕒</span> Last modified on{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {new Date(profileData.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </strong>
            {profileData.updater?.full_name && (
              <span> by <strong style={{ color: 'var(--accent)' }}>{profileData.updater.full_name}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* For Trainers: Show Support Tickets History Section */}
      {!isAdminOrManager && (
        <div className="profile-settings-card">
          <div className="profile-section-header">
            <span>🎫 My Profile Change Requests &amp; Support Tickets</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={fetchTickets}
              disabled={loadingTickets}
              style={{ fontSize: '0.76rem' }}
            >
              {loadingTickets ? '⏳ Loading…' : '🔄 Refresh Status'}
            </button>
          </div>

          <ProfileTicketsList tickets={tickets} loading={loadingTickets} />
        </div>
      )}

      {/* Modals */}
      {isAdminOrManager ? (
        <AdminDirectEditModal
          initialData={profileData}
          isOpen={isAdminEditModalOpen}
          onClose={() => setIsAdminEditModalOpen(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      ) : (
        <ProfileChangeRequestModal
          initialData={profileData}
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          onTicketCreated={fetchTickets}
        />
      )}
    </div>
  );
}
