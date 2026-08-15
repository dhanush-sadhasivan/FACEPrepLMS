'use client';

import { useState, useEffect } from 'react';

export default function ITAttendanceModal() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkITStatus() {
      try {
        const res = await fetch('/api/trainer/it-check');
        if (res.ok) {
          const data = await res.json();
          if (data.needsCheck) {
            setShowModal(true);
          }
        }
      } catch {
        // silent fail
      }
    }
    checkITStatus();
  }, []);

  const handleResponse = async (didIT: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/trainer/it-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ didIT }),
      });

      if (res.ok) {
        const data = await res.json();
        if (didIT) {
          setToastMsg(`🎉 Internal Training Day Counted! Total IT Days: ${data.newCount}`);
          setTimeout(() => setToastMsg(null), 4000);
        }
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  return (
    <>
      {/* Celebration Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff', padding: '0.85rem 1.25rem', borderRadius: '12px',
          fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {toastMsg}
        </div>
      )}

      {/* IT Attendance Modal Prompt */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 99998, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="modal" style={{ maxWidth: 460, padding: '2rem', borderRadius: '20px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)',
              color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', margin: '0 auto 1.25rem auto', border: '1px solid rgba(99, 102, 241, 0.3)',
            }}>
              🎓
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Daily Internal Training Check
            </h2>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', lineHeight: 1.5, fontWeight: 600 }}>
              Did you conduct or participate in <strong>Internal Training (IT)</strong> today?
            </p>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.5rem', background: 'var(--surface-2)', padding: '0.5rem 0.85rem', borderRadius: '8px', display: 'inline-block' }}>
              🗓️ Today: {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handleResponse(true)}
                disabled={loading}
                className="btn btn-primary"
                style={{
                  padding: '0.8rem', fontWeight: 800, fontSize: '0.95rem',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                }}
              >
                <span>✅</span> Yes, I did IT today
              </button>

              <button
                onClick={() => handleResponse(false)}
                disabled={loading}
                className="btn btn-secondary"
                style={{
                  padding: '0.75rem', fontWeight: 700, fontSize: '0.9rem',
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                <span>❌</span> No, not today
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
