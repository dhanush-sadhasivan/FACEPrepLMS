'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatISODate } from '@/lib/it-calendar';

interface ITAttendanceModalProps {
  currentUser?: {
    id: string;
    role?: string;
  } | null;
}

function getDailyGuardKey(userId: string | null | undefined, dateStr: string) {
  return userId ? `it_check_guard_${userId}_${dateStr}` : `it_check_guard_device_${dateStr}`;
}

function hasAnsweredOrDismissedToday(userId: string | null | undefined, dateStr: string): boolean {
  if (typeof window === 'undefined' || !dateStr) return false;
  try {
    if (userId) {
      const userKey = `it_check_guard_${userId}_${dateStr}`;
      const userVal = localStorage.getItem(userKey) || sessionStorage.getItem(userKey);
      if (userVal === 'true') return true;
    }
    const deviceKey = `it_check_guard_device_${dateStr}`;
    const deviceVal = localStorage.getItem(deviceKey) || sessionStorage.getItem(deviceKey);
    return deviceVal === 'true';
  } catch {
    return false;
  }
}

function markAnsweredOrDismissedToday(userId: string | null | undefined, dateStr: string): void {
  if (typeof window === 'undefined' || !dateStr) return;
  // If userId is known, isolate the guard strictly to that user so another user on a shared device is not suppressed
  const keys = userId
    ? [`it_check_guard_${userId}_${dateStr}`]
    : [`it_check_guard_device_${dateStr}`];
  for (const key of keys) {
    try {
      localStorage.setItem(key, 'true');
    } catch {
      // localStorage may throw SecurityError or QuotaExceededError in restricted sandboxes
    }
    try {
      sessionStorage.setItem(key, 'true');
    } catch {
      // sessionStorage fallback
    }
  }
}

export default function ITAttendanceModal({ currentUser }: ITAttendanceModalProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(currentUser?.id || null);
  const [activeDate, setActiveDate] = useState<string>(formatISODate(new Date()));

  useEffect(() => {
    // Non-trainers should not see the IT attendance modal
    if (currentUser?.role && currentUser.role !== 'trainer') {
      return;
    }

    const localToday = formatISODate(new Date());

    // Pre-flight check with current user ID if available
    if (hasAnsweredOrDismissedToday(currentUser?.id, localToday)) {
      return;
    }

    let isMounted = true;

    async function checkITStatus() {
      try {
        const res = await fetch('/api/trainer/it-check');
        if (res.ok && isMounted) {
          const data = await res.json();
          const effectiveUserId = data.userId || currentUser?.id;
          const effectiveDate = data.today || localToday;

          if (effectiveUserId) {
            setActiveUserId(effectiveUserId);
          }
          if (effectiveDate) {
            setActiveDate(effectiveDate);
          }

          // Check if already answered or dismissed on this client device today
          if (hasAnsweredOrDismissedToday(effectiveUserId, effectiveDate)) {
            return;
          }

          if (!data.needsCheck) {
            // Already checked on server; persist client guard to avoid redundant fetches on route change
            markAnsweredOrDismissedToday(effectiveUserId, effectiveDate);
          } else {
            setShowModal(true);
          }
        }
      } catch {
        // silent fail
      }
    }

    checkITStatus();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const handleDismiss = useCallback(() => {
    const uid = activeUserId || currentUser?.id;
    const d = activeDate || formatISODate(new Date());
    markAnsweredOrDismissedToday(uid, d);
    setShowModal(false);
  }, [activeUserId, activeDate, currentUser]);

  const handleResponse = async (didIT: boolean) => {
    const uid = activeUserId || currentUser?.id;
    const d = activeDate || formatISODate(new Date());
    markAnsweredOrDismissedToday(uid, d);
    setShowModal(false);
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
        // Broadcast custom event so other components on page re-sync immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('it-attendance-updated', { detail: data }));
        }
        // Refresh Server Component tree on current route to update dashboard header badge
        router.refresh();
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Celebration Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
          background: 'linear-gradient(135deg, var(--success), #059669)',
          color: '#fff', padding: '0.85rem 1.35rem', borderRadius: 'var(--radius-full)',
          fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.45)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {toastMsg}
        </div>
      )}

      {/* IT Attendance Modal Prompt */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleDismiss();
            }
          }}
          style={{ zIndex: 99998, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="modal" style={{ maxWidth: 460, padding: '2rem', borderRadius: 'var(--radius-xl)', textAlign: 'center', border: '1px solid var(--border)', background: 'var(--gradient-card)', boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss IT Check for Today"
              title="Dismiss for today"
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none',
                color: 'var(--text-muted)', fontSize: '1.25rem',
                cursor: 'pointer', padding: '0.35rem',
                lineHeight: 1, borderRadius: '6px',
              }}
            >
              ✕
            </button>

            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--indigo-muted)',
              color: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', margin: '0 auto 1.25rem auto', border: '1px solid var(--border)',
            }}>
              🎓
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Daily Internal Training Check
            </h2>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', lineHeight: 1.5, fontWeight: 600 }}>
              Did you conduct or participate in <strong>Internal Training (IT)</strong> today?
            </p>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.5rem', background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-full)', display: 'inline-block' }}>
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
                  border: 'none', borderRadius: 'var(--radius)',
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
                  borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                <span>❌</span> No, not today
              </button>

              <button
                onClick={handleDismiss}
                type="button"
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', fontSize: '0.8rem',
                  fontWeight: 600, cursor: 'pointer',
                  padding: '0.35rem', textDecoration: 'underline',
                }}
              >
                Remind me tomorrow (Dismiss)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
