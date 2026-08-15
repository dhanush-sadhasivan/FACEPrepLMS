'use client';

import { useState } from 'react';

export default function HelpdeskWidget() {
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[${subject.trim()}] ${message.trim()}`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit ticket');
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setShowModal(false);
        setSubject('');
        setMessage('');
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="widget-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h3 className="widget-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.95rem' }}>
            <span>💬</span>
            Helpdesk &amp; Support
          </h3>
          <span style={{ fontSize: '0.72rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 800 }}>
            ● Online
          </span>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
          Need assistance with HackerRank sync, contest access, or account settings? Our support desk is here to help!
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>❓ HackerRank Profile Syncing</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Auto-Synced</span>
          </div>
          <div style={{ padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🏆 Contest Leaderboard Issues</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Auto-Updated</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="btn btn-primary btn-sm"
        style={{ width: '100%', padding: '0.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
      >
        <span>📩</span> Raise Support Ticket
      </button>

      {/* Support Request Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.75)' }}>
          <div className="modal" style={{ maxWidth: 480, padding: '1.75rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>💬</span> Raise Helpdesk Ticket
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            {submitted ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--success)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Ticket Submitted Successfully!</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Our support team will review your query shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {errorMsg && (
                  <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid var(--error)', color: 'var(--error)', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.82rem', marginBottom: '1rem' }}>
                    ⚠️ {errorMsg}
                  </div>
                )}
                <div className="form-group mb-3">
                  <label className="label">Subject / Issue Title *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. HackerRank ID sync issue"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group mb-4">
                  <label className="label">Issue Description *</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Describe the problem you are experiencing..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    required
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
