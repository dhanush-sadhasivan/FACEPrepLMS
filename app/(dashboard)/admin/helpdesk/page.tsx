'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import './page.css';

type ActiveTab = 'profile_changes' | 'access_requests';

export default function HelpdeskManagerPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile_changes');
  
  // Support Tickets (Profile Changes)
  const [profileTickets, setProfileTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Contest Access Requests
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(true);

  // Common UI states
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  // Reject Modal State
  const [rejectModalTicket, setRejectModalTicket] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const { showToast } = useToast();

  const fetchProfileTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/support-tickets');
      if (res.ok) {
        const data = await res.json();
        setProfileTickets(data);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading profile change tickets', 'error');
    } finally {
      setLoadingTickets(false);
    }
  }, [showToast]);

  const fetchAccessRequests = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await fetch('/api/admin/access-requests');
      if (res.ok) {
        const data = await res.json();
        setAccessRequests(data);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading access requests', 'error');
    } finally {
      setLoadingAccess(false);
    }
  }, [showToast]);

  const refreshAll = () => {
    fetchProfileTickets();
    fetchAccessRequests();
  };

  useEffect(() => {
    fetchProfileTickets();
    fetchAccessRequests();
  }, [fetchProfileTickets, fetchAccessRequests]);

  // Handle Profile Ticket Approval
  const handleApproveProfileTicket = async (ticketId: string) => {
    setActionId(ticketId);
    try {
      const res = await fetch(`/api/support-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('✅ Profile change approved and applied to database!', 'success');
        setProfileTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? data.ticket : t))
        );
      } else {
        showToast(`Failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setActionId(null);
    }
  };

  // Handle Profile Ticket Rejection
  const handleRejectProfileTicket = async () => {
    if (!rejectModalTicket) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/support-tickets/${rejectModalTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', admin_notes: rejectReason.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Profile change request declined.', 'info');
        setProfileTickets((prev) =>
          prev.map((t) => (t.id === rejectModalTicket.id ? data.ticket : t))
        );
        setRejectModalTicket(null);
        setRejectReason('');
      } else {
        showToast(`Failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setRejecting(false);
    }
  };

  // Handle Contest Access Decision
  const handleAccessDecision = async (requestId: string, status: 'approved' | 'denied') => {
    setActionId(requestId);
    try {
      const res = await fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        showToast(`Contest access request ${status === 'approved' ? 'Approved' : 'Denied'} successfully`, 'success');
        setAccessRequests((prev) =>
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

  // Metrics calculation
  const profileMetrics = useMemo(() => {
    const total = profileTickets.length;
    const pending = profileTickets.filter((t) => t.status === 'pending').length;
    const resolved = profileTickets.filter((t) => t.status === 'resolved').length;
    const rejected = profileTickets.filter((t) => t.status === 'rejected').length;
    return { total, pending, resolved, rejected };
  }, [profileTickets]);

  const accessMetrics = useMemo(() => {
    const total = accessRequests.length;
    const pending = accessRequests.filter((r) => r.status === 'pending').length;
    const approved = accessRequests.filter((r) => r.status === 'approved').length;
    const denied = accessRequests.filter((r) => r.status === 'denied').length;
    return { total, pending, approved, denied };
  }, [accessRequests]);

  // Filtered Profile Tickets
  const filteredProfileTickets = useMemo(() => {
    return profileTickets.filter((t) => {
      const q = search.toLowerCase().trim();
      const name = (t.requester?.full_name || '').toLowerCase();
      const email = (t.requester?.email || '').toLowerCase();
      const empId = (t.requester?.emp_id || '').toLowerCase();
      const reason = (t.requested_changes?.reason || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || email.includes(q) || empId.includes(q) || reason.includes(q);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [profileTickets, search, statusFilter]);

  // Filtered Access Requests
  const filteredAccessRequests = useMemo(() => {
    return accessRequests.filter((r) => {
      const q = search.toLowerCase().trim();
      const trainerName = (r.trainer?.full_name || '').toLowerCase();
      const trainerEmail = (r.trainer?.email || '').toLowerCase();
      const contestTitle = (r.contest?.title || '').toLowerCase();
      const msg = (r.message || '').toLowerCase();

      const matchesSearch = !q || trainerName.includes(q) || trainerEmail.includes(q) || contestTitle.includes(q) || msg.includes(q);
      const mappedFilter = statusFilter === 'resolved' ? 'approved' : statusFilter === 'rejected' ? 'denied' : statusFilter;
      const matchesStatus = statusFilter === 'all' || r.status === mappedFilter;

      return matchesSearch && matchesStatus;
    });
  }, [accessRequests, search, statusFilter]);

  const currentLoading = activeTab === 'profile_changes' ? loadingTickets : loadingAccess;

  return (
    <div className="helpdesk-page">
      {/* Header */}
      <header className="helpdesk-header">
        <div>
          <h1 className="helpdesk-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎫</span> Helpdesk &amp; Support Ticket Manager
          </h1>
          <p className="helpdesk-subtitle">
            Review and approve trainer profile change requests, unique handle bindings, and contest access extensions.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={refreshAll} disabled={currentLoading} style={{ fontSize: '0.78rem' }}>
          {currentLoading ? '⏳ Refreshing…' : '🔄 Refresh All Tickets'}
        </button>
      </header>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'profile_changes' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => { setActiveTab('profile_changes'); setStatusFilter('all'); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}
        >
          <span>👤</span> Profile Change Tickets ({profileMetrics.pending > 0 ? `🚨 ${profileMetrics.pending} Pending` : profileMetrics.total})
        </button>

        <button
          className={`btn ${activeTab === 'access_requests' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => { setActiveTab('access_requests'); setStatusFilter('all'); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}
        >
          <span>🏆</span> Contest Access Requests ({accessMetrics.pending > 0 ? `🚨 ${accessMetrics.pending} Pending` : accessMetrics.total})
        </button>
      </div>

      {/* Top Overview Stats Grid */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>🎟️</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>
              {activeTab === 'profile_changes' ? profileMetrics.total : accessMetrics.total}
            </div>
            <div className="stat-widget-label">Total Requests</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#f59e0b' }}>⏳</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#f59e0b' }}>
              {activeTab === 'profile_changes' ? profileMetrics.pending : accessMetrics.pending}
            </div>
            <div className="stat-widget-label">Pending Review</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#10b981' }}>✅</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#10b981' }}>
              {activeTab === 'profile_changes' ? profileMetrics.resolved : accessMetrics.approved}
            </div>
            <div className="stat-widget-label">Approved &amp; Applied</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#ef4444' }}>❌</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#ef4444' }}>
              {activeTab === 'profile_changes' ? profileMetrics.rejected : accessMetrics.denied}
            </div>
            <div className="stat-widget-label">Declined</div>
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
            All Tickets
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            ⏳ Pending ({activeTab === 'profile_changes' ? profileMetrics.pending : accessMetrics.pending})
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('resolved')}
          >
            ✅ Approved ({activeTab === 'profile_changes' ? profileMetrics.resolved : accessMetrics.approved})
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            ❌ Declined ({activeTab === 'profile_changes' ? profileMetrics.rejected : accessMetrics.denied})
          </button>
        </div>

        <div className="search-box-wrapper" style={{ maxWidth: 340 }}>
          <span className="search-box-icon">🔍</span>
          <input
            type="text"
            className="search-box-input"
            placeholder={activeTab === 'profile_changes' ? 'Search by name, email, handle, reason…' : 'Search by trainer, contest, reason…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content Rendering: Profile Changes */}
      {activeTab === 'profile_changes' && (
        loadingTickets ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="roadmaps-spinner" style={{ margin: '0 auto 0.75rem' }} />
            Loading profile change tickets…
          </div>
        ) : filteredProfileTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0.25rem 0' }}>No Profile Change Tickets Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {search ? `No tickets matching "${search}"` : 'All profile change requests have been resolved!'}
            </p>
          </div>
        ) : (
          <div className="tickets-grid">
            {filteredProfileTickets.map((t) => {
              const isPending = t.status === 'pending';
              const isApproved = t.status === 'resolved';
              const isRejected = t.status === 'rejected';
              const isProcessing = actionId === t.id;

              const req = t.requested_changes || {};
              const cur = t.current_values || {};

              return (
                <div key={t.id} className={`ticket-card status-${t.status}`}>
                  <div>
                    <div className="ticket-header">
                      <div>
                        <h3 className="ticket-user-name">{t.requester?.full_name || 'Trainer'}</h3>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {t.requester?.email || '—'} • Emp ID: <code style={{ color: 'var(--text-primary)' }}>{t.requester?.emp_id || 'N/A'}</code>
                        </div>
                      </div>

                      <span
                        className={`badge ${isPending ? 'badge-warning' : isApproved ? 'badge-success' : 'badge-danger'}`}
                        style={{ fontSize: '0.68rem', fontWeight: 800 }}
                      >
                        {isPending ? '⏳ PENDING' : isApproved ? '✅ APPROVED' : '❌ DECLINED'}
                      </span>
                    </div>

                    {/* Requested Diff Highlight Box */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', margin: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                        Requested Profile Changes:
                      </div>

                      {req.full_name && req.full_name !== cur.full_name && (
                        <div>
                          <strong>Full Name:</strong>{' '}
                          <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{cur.full_name || '—'}</span>{' '}
                          ➔ <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{req.full_name}</span>
                        </div>
                      )}

                      {req.emp_email !== undefined && req.emp_email !== cur.emp_email && (
                        <div>
                          <strong>Employee Email:</strong>{' '}
                          <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{cur.emp_email || '—'}</span>{' '}
                          ➔ <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{req.emp_email || 'None'}</span>
                        </div>
                      )}

                      {req.hackerrank_id !== undefined && req.hackerrank_id !== cur.hackerrank_id && (
                        <div>
                          <strong>HackerRank ID:</strong>{' '}
                          <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{cur.hackerrank_id || '—'}</span>{' '}
                          ➔ <span style={{ color: '#10b981', fontWeight: 800 }}>{req.hackerrank_id || 'None'}</span>
                        </div>
                      )}

                      {req.leetcode_id !== undefined && req.leetcode_id !== cur.leetcode_id && (
                        <div>
                          <strong>LeetCode ID:</strong>{' '}
                          <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{cur.leetcode_id || '—'}</span>{' '}
                          ➔ <span style={{ color: '#ffa116', fontWeight: 800 }}>{req.leetcode_id || 'None'}</span>
                        </div>
                      )}
                    </div>

                    {req.reason && (
                      <div className="ticket-message-box" style={{ margin: '0.5rem 0' }}>
                        💬 &quot;{req.reason}&quot;
                      </div>
                    )}

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }} suppressHydrationWarning>
                      🗓️ Submitted: {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {isPending ? (
                    <div className="ticket-actions" style={{ marginTop: '0.9rem' }}>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleApproveProfileTicket(t.id)}
                        disabled={isProcessing}
                        style={{ flex: 1, fontSize: '0.78rem', fontWeight: 800 }}
                      >
                        {isProcessing ? 'Applying…' : '✅ Approve & Apply'}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => { setRejectModalTicket(t); setRejectReason(''); }}
                        disabled={isProcessing}
                        style={{ flex: 1, fontSize: '0.78rem', fontWeight: 800, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                      >
                        ❌ Decline…
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div>
                        👤 <strong>{isApproved ? 'Approved by:' : 'Declined by:'}</strong>{' '}
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                          {t.resolver?.full_name || 'Administrator'}
                        </span>
                        {t.resolved_at && (
                          <span> on {new Date(t.resolved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                      {t.admin_notes && (
                        <div style={{ color: isApproved ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                          Note: &quot;{t.admin_notes}&quot;
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Content Rendering: Contest Access Requests */}
      {activeTab === 'access_requests' && (
        loadingAccess ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="roadmaps-spinner" style={{ margin: '0 auto 0.75rem' }} />
            Loading access extension requests…
          </div>
        ) : filteredAccessRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0.25rem 0' }}>No Access Requests Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {search ? `No requests matching "${search}"` : 'All contest access requests have been managed!'}
            </p>
          </div>
        ) : (
          <div className="tickets-grid">
            {filteredAccessRequests.map((r) => {
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
                    <div className="ticket-actions" style={{ marginTop: '0.9rem' }}>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAccessDecision(r.id, 'approved')}
                        disabled={isProcessing}
                        style={{ flex: 1, fontSize: '0.78rem', fontWeight: 800 }}
                      >
                        {isProcessing ? 'Wait…' : '✅ Approve Access'}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleAccessDecision(r.id, 'denied')}
                        disabled={isProcessing}
                        style={{ flex: 1, fontSize: '0.78rem', fontWeight: 800, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                      >
                        {isProcessing ? 'Wait…' : '❌ Deny'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Resolved by Admin</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleAccessDecision(r.id, isApproved ? 'denied' : 'approved')}
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
        )
      )}

      {/* Rejection Modal for Profile Changes */}
      {rejectModalTicket && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <h2 className="modal-title" style={{ color: '#ef4444' }}>
              ❌ Decline Profile Change Request
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              You are declining the profile change request from <strong>{rejectModalTicket.requester?.full_name}</strong>. Provide an optional note explaining the reason to the trainer.
            </p>

            <div className="form-group mb-4">
              <label className="label">Decline Reason / Comments (Optional)</label>
              <textarea
                className="input"
                rows={3}
                placeholder="e.g. Please verify the handle spelling, handle already claimed, etc."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={rejecting}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectModalTicket(null)}
                disabled={rejecting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRejectProfileTicket}
                disabled={rejecting}
                style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff', fontWeight: 700 }}
              >
                {rejecting ? 'Declining…' : '❌ Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
