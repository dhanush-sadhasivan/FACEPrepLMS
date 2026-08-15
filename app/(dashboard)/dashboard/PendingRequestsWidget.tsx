'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

export default function PendingRequestsWidget({ initialRequests }: { initialRequests: any[] }) {
  const [requests, setRequests] = useState<any[]>(initialRequests);
  const { showToast } = useToast();

  const handleDecision = async (requestId: string, action: 'approved' | 'denied') => {
    try {
      const res = await fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });

      if (!res.ok) throw new Error(`Failed to ${action} request`);

      showToast(`Request ${action}!`, 'success');
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      showToast(`Action failed: ${msg}`, 'error');
    }
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
          🔒 Extension Requests
        </h3>
        {requests.length > 0 && (
          <span className="badge badge-warning">{requests.length} Pending</span>
        )}
      </div>

      {requests.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
          No pending extension requests.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 280, overflowY: 'auto' }}>
          {requests.map(req => (
            <div key={req.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>{req.users?.full_name || 'Trainer'}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{req.users?.team || 'No Team'}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.2rem', fontWeight: 500 }}>
                {req.contests?.title || 'Contest'}
              </div>
              {req.message && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  &quot;{req.message}&quot;
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                <button
                  className="btn btn-sm"
                  onClick={() => handleDecision(req.id, 'approved')}
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#2ecc71', border: '1px solid rgba(34,197,94,0.3)', flex: 1, fontSize: '0.75rem' }}
                >
                  ✓ Approve
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => handleDecision(req.id, 'denied')}
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', flex: 1, fontSize: '0.75rem' }}
                >
                  ✕ Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
