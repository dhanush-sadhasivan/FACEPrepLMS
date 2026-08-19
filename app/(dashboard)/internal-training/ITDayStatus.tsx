'use client';

import { useState, useEffect } from 'react';

interface ITDayStatusProps {
  itDaysCount: number;
  isITCountedToday: boolean;
  totalPlannedDays: number;
  currentDay: number;
  onITStatusChanged?: (newCount: number) => void;
}

export default function ITDayStatus({
  itDaysCount,
  isITCountedToday,
  totalPlannedDays,
  currentDay,
  onITStatusChanged,
}: ITDayStatusProps) {
  const [loading, setLoading] = useState(false);
  const [counted, setCounted] = useState(isITCountedToday);
  const [count, setCount] = useState(itDaysCount);

  useEffect(() => {
    setCounted(isITCountedToday);
    setCount(itDaysCount);
  }, [isITCountedToday, itDaysCount]);

  // Non-IT days = days elapsed so far minus IT days (cannot be negative)
  const nonITDays = Math.max(0, currentDay - count);

  const handleManualLog = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trainer/it-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ didIT: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setCounted(true);
        setCount(data.newCount);
        if (onITStatusChanged) onITStatusChanged(data.newCount);
      }
    } catch (err) {
      console.error('Error logging IT day:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="it-stats-grid">
      {/* IT Days Card */}
      <div className="it-stat-card">
        <div className="it-stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
          🎓
        </div>
        <div>
          <div className="it-stat-value" style={{ color: '#10b981' }}>
            {count}
          </div>
          <div className="it-stat-label">Internal Training (IT) Days</div>
        </div>
      </div>

      {/* Non-IT Days Card */}
      <div className="it-stat-card">
        <div className="it-stat-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
          📋
        </div>
        <div>
          <div className="it-stat-value" style={{ color: '#ef4444' }}>
            {nonITDays}
          </div>
          <div className="it-stat-label">Non-IT / Standby Days</div>
        </div>
      </div>

      {/* Today's Status Card */}
      <div className="it-stat-card" style={{ flex: 1.5 }}>
        <div className="it-stat-icon-wrap" style={{ background: counted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: counted ? '#10b981' : '#f59e0b' }}>
          {counted ? '✅' : '⏳'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {counted ? "Today's IT Attendance Counted" : "Today's IT Attendance Pending"}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {counted
                  ? 'Great job! You participated in today’s training session.'
                  : 'Launch any problem from the list below to automatically record IT attendance.'}
              </div>
            </div>

            {!counted && (
              <button
                type="button"
                onClick={handleManualLog}
                disabled={loading}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                {loading ? 'Logging…' : '✅ Mark IT Day Manually'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
