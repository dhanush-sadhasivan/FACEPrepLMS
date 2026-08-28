'use client';

interface ProfileTicket {
  id: string;
  type: string;
  requested_changes: {
    full_name?: string;
    emp_email?: string;
    hackerrank_id?: string;
    leetcode_id?: string;
    reason?: string;
  };
  current_values: {
    full_name?: string;
    emp_email?: string;
    hackerrank_id?: string;
    leetcode_id?: string;
  };
  status: 'pending' | 'resolved' | 'rejected';
  resolved_by?: string | null;
  resolver?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  resolved_at?: string | null;
  admin_notes?: string | null;
  created_at: string;
}

interface ProfileTicketsListProps {
  tickets: ProfileTicket[];
  loading?: boolean;
}

export default function ProfileTicketsList({ tickets, loading }: ProfileTicketsListProps) {
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading support requests…
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div style={{ padding: '1.75rem', textAlign: 'center', background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        <span>📭</span> You have no pending or past profile change requests.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {tickets.map((ticket) => {
        const isPending = ticket.status === 'pending';
        const isApproved = ticket.status === 'resolved';
        const isRejected = ticket.status === 'rejected';

        const req = ticket.requested_changes || {};
        const cur = ticket.current_values || {};

        return (
          <div
            key={ticket.id}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderLeft: `4px solid ${isPending ? '#f59e0b' : isApproved ? '#10b981' : '#ef4444'}`,
              borderRadius: 'var(--radius)',
              padding: '1rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Profile Change Request
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Submitted on {new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  background: isPending ? 'rgba(245,158,11,0.12)' : isApproved ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: isPending ? '#f59e0b' : isApproved ? '#10b981' : '#ef4444',
                  border: `1px solid ${isPending ? 'rgba(245,158,11,0.3)' : isApproved ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  textTransform: 'uppercase',
                }}
              >
                {isPending ? '⏳ Pending Review' : isApproved ? '✅ Approved & Applied' : '❌ Declined'}
              </span>
            </div>

            {/* Changes requested details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', background: 'var(--surface)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '0.65rem' }}>
              {req.full_name && req.full_name !== cur.full_name && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Full Name:</strong>{' '}
                  <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{cur.full_name || '—'}</span>{' '}
                  ➔ <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{req.full_name}</span>
                </div>
              )}
              {req.emp_email !== undefined && req.emp_email !== cur.emp_email && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Employee Email:</strong>{' '}
                  <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{cur.emp_email || '—'}</span>{' '}
                  ➔ <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{req.emp_email || 'None'}</span>
                </div>
              )}
              {req.hackerrank_id !== undefined && req.hackerrank_id !== cur.hackerrank_id && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>HackerRank ID:</strong>{' '}
                  <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{cur.hackerrank_id || '—'}</span>{' '}
                  ➔ <span style={{ color: '#10b981', fontWeight: 700 }}>{req.hackerrank_id || 'None'}</span>
                </div>
              )}
              {req.leetcode_id !== undefined && req.leetcode_id !== cur.leetcode_id && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>LeetCode ID:</strong>{' '}
                  <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{cur.leetcode_id || '—'}</span>{' '}
                  ➔ <span style={{ color: '#ffa116', fontWeight: 700 }}>{req.leetcode_id || 'None'}</span>
                </div>
              )}
              {req.reason && (
                <div style={{ marginTop: '0.2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  💬 &quot;{req.reason}&quot;
                </div>
              )}
            </div>

            {/* Resolution footer */}
            {!isPending && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.76rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <div>
                  👤 <strong>{isApproved ? 'Approved by:' : 'Declined by:'}</strong>{' '}
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                    {ticket.resolver?.full_name || 'Administrator'}
                  </span>
                  {ticket.resolved_at && (
                    <span> on {new Date(ticket.resolved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
                {ticket.admin_notes && (
                  <div style={{ color: isApproved ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                    Note: &quot;{ticket.admin_notes}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
