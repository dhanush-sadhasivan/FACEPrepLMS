'use client';

import { useState, useEffect, useCallback } from 'react';
import ProfileChangeRequestModal from './ProfileChangeRequestModal';
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
  };
}

export default function ProfileDetailsView({ initialData }: ProfileDetailsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const fetchTickets = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const cleanDisplay = (val?: string | null) => {
    if (!val) return '—';
    const s = String(val).trim();
    if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(s.toLowerCase())) return '—';
    return s;
  };

  return (
    <div>
      {/* Account Preferences / Details Card */}
      <div className="profile-settings-card">
        <div className="profile-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>👤 Account Profile Details</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: 'var(--indigo)', border: '1px solid rgba(99,102,241,0.25)' }}>
              🔒 Verified Account
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700 }}
          >
            <span>🎫</span> Request Profile Change
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.15rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Name</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {initialData.full_name || '—'}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employee ID</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
              {initialData.emp_id || '—'}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Login Email</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {initialData.email || '—'}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employee Work Email</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {cleanDisplay(initialData.emp_email) !== '—' ? initialData.emp_email : (initialData.email || '—')}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Team / Department</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              🏢 {cleanDisplay(initialData.team)}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reporting Manager</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              👤 {cleanDisplay(initialData.manager)}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>HackerRank Handle</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {initialData.hackerrank_id ? (
                <a
                  href={`https://www.hackerrank.com/profile/${initialData.hackerrank_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  ⚡ @{initialData.hackerrank_id} ↗
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Not linked</span>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>LeetCode Handle</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {initialData.leetcode_id ? (
                <a
                  href={`https://leetcode.com/u/${initialData.leetcode_id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#ffa116', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  🟠 @{initialData.leetcode_id} ↗
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Not linked</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '0.85rem 1rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            🔒 <strong>Profile Protection Enabled:</strong> To protect contest rankings and avoid duplicate accounts, direct profile edits are managed via support tickets.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsModalOpen(true)}
            style={{ fontSize: '0.78rem' }}
          >
            ✏️ Request Update
          </button>
        </div>
      </div>

      {/* Support Ticket History Card */}
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

      {/* Profile Change Request Modal */}
      <ProfileChangeRequestModal
        initialData={initialData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTicketCreated={fetchTickets}
      />
    </div>
  );
}
