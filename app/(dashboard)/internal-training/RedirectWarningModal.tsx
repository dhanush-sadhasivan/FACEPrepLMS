'use client';

interface RedirectWarningModalProps {
  isOpen: boolean;
  questionTitle: string;
  targetUrl: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RedirectWarningModal({
  isOpen,
  questionTitle,
  targetUrl,
  onConfirm,
  onCancel,
}: RedirectWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="plan-modal-overlay" onClick={onCancel}>
      <div className="plan-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, textAlign: 'center', padding: '1.75rem' }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.8rem',
          margin: '0 auto 1rem auto',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}>
          ⚠️
        </div>

        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
          Leaving FACEPrep LMS
        </h3>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
          You are opening <strong>&quot;{questionTitle}&quot;</strong>.
        </p>

        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '0.85rem 1rem',
          textAlign: 'left',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            📌 Important Attendance Rule:
          </div>
          Complete this problem and <strong>return back to this LMS platform</strong> to continue to the next problem. Solving problems directly outside without launching from this portal will not record your IT day attendance!
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ flex: 1, fontWeight: 700 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            style={{
              flex: 1.5,
              fontWeight: 800,
              background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            Continue to Problem ↗
          </button>
        </div>
      </div>
    </div>
  );
}
