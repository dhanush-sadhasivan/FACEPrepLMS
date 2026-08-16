'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/Toast';
import './page.css';

export default function HelpdeskManagerPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const { showToast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/access-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading helpdesk tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleDecision = async (requestId: string, status: 'approved' | 'denied') => {
    setActionId(requestId);
    try {
      const res = await fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        showToast(`Request ${status === 'approved' ? 'Approved' : 'Denied'} successfully`, 'success');
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status } : r))
        );
      } else {
        const data = await res.json();
        showToast(`Failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating request status', 'error');
    } finally {
      setActionId(null);
    }
  };

  // Calculate Metrics
  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const denied = requests.filter((r) => r.status === 'denied').length;
    return { total, pending, approved, denied };
  }, [requests]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const query = search.toLowerCase().trim();
      const trainerName = (r.trainer?.full_name || '').toLowerCase();
      const trainerEmail = (r.trainer?.email || '').toLowerCase();
      const contestTitle = (r.contest?.title || '').toLowerCase();
      const message = (r.message || '').toLowerCase();

      const matchesSearch =
        !query ||
        trainerName.includes(query) ||
        trainerEmail.includes(query) ||
        contestTitle.includes(query) ||
        message.includes(query);

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  return (
    <div className="helpdesk-page">
      {/* Header */}
      <header className="helpdesk-header">
        <div>
          <h1 className="helpdesk-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎫</span> Helpdesk Support &amp; Access Requests Manager
          </h1>
          <p className="helpdesk-subtitle">
            Manage access extension requests, trainer support tickets, and contest unlocks.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchRequests} disabled={loading} style={{ fontSize: '0.78rem' }}>
          {loading ? '⏳ Refreshing…' : '🔄 Refresh Tickets'}
        </button>
      </header>

      {/* Top Overview Stats Grid */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>🎟️</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{metrics.total}</div>
            <div className="stat-widget-label">Total Tickets</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#f59e0b' }}>⏳</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#f59e0b' }}>{metrics.pending}</div>
            <div className="stat-widget-label">Pending Review</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#10b981' }}>✅</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#10b981' }}>{metrics.approved}</div>
            <div className="stat-widget-label">Approved</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#ef4444' }}>❌</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#ef4444' }}>{metrics.denied}</div>
            <div className="stat-widget-label">Denied</div>
          </div>
        </div>
      </div>

      {/* Controls Bar & Filter Pills */}
      <div className="helpdesk-controls-bar">
        <div className="status-filter-pills">
          <button
            className={`status-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Tickets ({metrics.total})
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            ⏳ Pending ({metrics.pending})
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            ✅ Approved ({metrics.approved})
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'denied' ? 'active' : ''}`}
            onClick={() => setStatusFilter('denied')}
          >
            ❌ Denied ({metrics.denied})
          </button>
        </div>

        <div className="search-box-wrapper" style={{ maxWidth: 320 }}>
          <span className="search-box-icon">🔍</span>
          <input
            type="text"
            className="search-box-input"
            placeholder="Search tickets by trainer, contest, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tickets List / Grid */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="roadmaps-spinner" style={{ margin: '0 auto 0.75rem' }} />
          Loading support tickets…
        </div>
      ) : filteredRequests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
          <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0.25rem 0' }}>No Support Tickets Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {search ? `No tickets matching "${search}"` : 'All access requests and support tickets have been managed!'}
          </p>
        </div>
      ) : (
        <div className="tickets-grid">
          {filteredRequests.map((r) => {
            const isPending = r.status === 'pending';
            const isApproved = r.status === 'approved';
            const isProcessing = actionId === r.id;

            return (
              <div key={r.id} className={`ticket-card status-${r.status}`}>
                <div>
                  <div className="ticket-header">
                    <div>
                      <h3 className="ticket-user-name">{r.trainer?.full_name || 'Trainer'}</h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.trainer?.email || '—'}
                      </div>
                    </div>

                    <span
                      className={`badge ${isPending ? 'badge-warning' : isApproved ? 'badge-success' : 'badge-danger'}`}
                      style={{ fontSize: '0.68rem', fontWeight: 800 }}
                    >
                      {r.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="ticket-contest-title">
                    🏆 Contest: {r.contest?.title || 'Contest'}
                  </div>

                  {r.message && (
                    <div className="ticket-message-box">
                      💬 &quot;{r.message}&quot;
                    </div>
                  )}

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }} suppressHydrationWarning>
                    🗓️ Submitted: {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {isPending ? (
                  <div className="ticket-actions">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleDecision(r.id, 'approved')}
                      disabled={isProcessing}
                      style={{ flex: 1, fontSize: '0.78rem', fontWeight: 800 }}
                    >
                      {isProcessing ? 'Wait…' : '✅ Approve Access'}
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleDecision(r.id, 'denied')}
                      disabled={isProcessing}
                      style={{ flex: 1, fontSize: '0.78rem', fontWeight: 800, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      {isProcessing ? 'Wait…' : '❌ Deny'}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Resolved by Admin</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDecision(r.id, isApproved ? 'denied' : 'approved')}
                      disabled={isProcessing}
                      style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                    >
                      Change to {isApproved ? 'Denied' : 'Approved'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
