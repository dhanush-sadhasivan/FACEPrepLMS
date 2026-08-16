'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

export default function GlobalSupportModal({
  isOpen,
  onClose,
  defaultContestId = '',
  defaultContestTitle = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultContestId?: string;
  defaultContestTitle?: string;
}) {
  const [category, setCategory] = useState<'access_extension' | 'score_sync' | 'question_bug' | 'general'>('access_extension');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);

    const categoryLabels: Record<string, string> = {
      access_extension: '🔒 Access Extension',
      score_sync: '⚡ HackerRank Score Sync',
      question_bug: '🐛 Question / Testcase Bug',
      general: '💬 General Technical Support',
    };

    const formattedMessage = `[${categoryLabels[category]} | Priority: ${priority.toUpperCase()}]\n${message.trim()}`;

    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contestId: defaultContestId || null,
          message: formattedMessage,
          category,
          priority,
        }),
      });

      if (res.ok) {
        showToast('Support ticket submitted successfully! Admins will review your request.', 'success');
        setMessage('');
        onClose();
      } else {
        const data = await res.json();
        showToast(`Submission failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error submitting support ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <span>🎧</span> Helpdesk Support &amp; Ticket Request
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {defaultContestTitle && (
            <div style={{ background: 'var(--surface-2)', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700 }}>
              🏆 Contest: {defaultContestTitle}
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              Issue Category
            </label>
            <select
              value={category}
              onChange={(e: any) => setCategory(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.84rem' }}
            >
              <option value="access_extension">🔒 Contest Access Extension / Unlock Request</option>
              <option value="score_sync">⚡ HackerRank Score / Submission Sync Issue</option>
              <option value="question_bug">🐛 Question / Testcase Bug Report</option>
              <option value="general">💬 General Technical / Platform Support</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              Priority Level
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['normal', 'high', 'urgent'] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  style={{
                    flex: 1,
                    padding: '0.35rem',
                    borderRadius: 6,
                    border: priority === p ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: priority === p ? 'var(--accent-muted)' : 'var(--surface-2)',
                    color: priority === p ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {p === 'urgent' ? '🔥 Urgent' : p === 'high' ? '⚠️ High' : '🟢 Normal'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              Issue Details &amp; Reason
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Describe your issue or request reason in detail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.84rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !message.trim()}>
              {submitting ? 'Submitting…' : '📨 Submit Support Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
