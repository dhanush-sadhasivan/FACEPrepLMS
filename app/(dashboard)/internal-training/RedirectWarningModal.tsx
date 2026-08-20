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
    <div
      className="redirect-modal-overlay"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '1.25rem',
      }}
    >
      <div
        className="redirect-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface, #1e293b)',
          border: '1.5px solid var(--border, #334155)',
          borderRadius: '22px',
          width: '100%',
          maxWidth: '500px',
          padding: '2.25rem 2rem',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          position: 'relative',
        }}
      >
        {/* Warning Icon Badge */}
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.2rem',
            margin: '0 auto 1.25rem auto',
            border: '1.5px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.2)',
          }}
        >
          ⚠️
        </div>

        {/* Modal Title */}
        <h3
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            margin: '0 0 0.5rem 0',
            color: 'var(--text-primary, #ffffff)',
            letterSpacing: '-0.02em',
          }}
        >
          Leaving FACEPrep LMS
        </h3>

        {/* Question Title Subtitle */}
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-secondary, #94a3b8)',
            lineHeight: 1.5,
            margin: '0 0 1.35rem 0',
          }}
        >
          You are opening <strong style={{ color: 'var(--text-primary, #fff)' }}>&quot;{questionTitle}&quot;</strong> on HackerRank / external platform.
        </p>

        {/* Attendance Warning Notice Box */}
        <div
          style={{
            background: 'var(--surface-2, #0f172a)',
            border: '1px solid var(--border, #334155)',
            borderRadius: '14px',
            padding: '1.1rem 1.25rem',
            textAlign: 'left',
            fontSize: '0.86rem',
            color: 'var(--text-secondary, #94a3b8)',
            lineHeight: 1.55,
            marginBottom: '1.75rem',
          }}
        >
          <div
            style={{
              fontWeight: 800,
              color: '#f59e0b',
              marginBottom: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.88rem',
            }}
          >
            <span>📌</span> Strict Attendance Rule:
          </div>
          You must solve this problem and <strong>return back to this LMS platform</strong> to proceed to the next problem. Attempting questions directly outside without launching from this portal will not count towards your IT day attendance!
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            style={{
              flex: 1,
              fontWeight: 700,
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              fontSize: '0.9rem',
            }}
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
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              fontSize: '0.92rem',
              background: 'linear-gradient(135deg, var(--accent, #6366f1), #8b5cf6)',
              border: 'none',
              color: '#ffffff',
              boxShadow: '0 4px 18px rgba(99, 102, 241, 0.4)',
              cursor: 'pointer',
            }}
          >
            Continue to Problem ↗
          </button>
        </div>
      </div>
    </div>
  );
}
