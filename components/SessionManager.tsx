'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE_MS = 60 * 1000; // 1 minute warning before logout (at 9 min)

export function SessionManager({ children }: { children?: React.ReactNode }) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleLogout = useCallback(async () => {
    // Clear timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    await supabase.auth.signOut();
    router.push('/login?reason=inactivity');
    router.refresh();
  }, [router, supabase]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Schedule 9-minute warning timer
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(60);

      // Start countdown every second
      countdownIntervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);

    // Schedule 10-minute auto logout timer
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_LIMIT_MS);
  }, [handleLogout]);

  useEffect(() => {
    // Throttled activity handler
    let throttleTimeout: NodeJS.Timeout | null = null;
    const onUserActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 1000);

      // Only reset timer if warning modal is not currently open,
      // so user must explicitly click "Keep Me Logged In" if warning appeared
      if (!showWarning) {
        resetTimer();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => window.addEventListener(event, onUserActivity));

    // Initialize timer
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, onUserActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [resetTimer, showWarning]);

  return (
    <>
      {children}

      {/* Inactivity Warning Modal */}
      {showWarning && (
        <div className="session-warning-overlay">
          <div className="session-warning-modal">
            <div className="session-warning-icon">⏳</div>
            <h3 className="session-warning-title">Session Expiring Soon</h3>
            <p className="session-warning-desc">
              You have been inactive for 9 minutes. For security reasons, your session will automatically end in:
            </p>

            <div className="session-countdown-box">
              <span className="session-countdown-val">{secondsLeft}</span>
              <span className="session-countdown-unit">seconds</span>
            </div>

            <div className="session-warning-actions">
              <button
                className="btn btn-primary"
                onClick={resetTimer}
                style={{ width: '100%', padding: '0.75rem' }}
              >
                ⚡ Keep Me Logged In
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleLogout}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
