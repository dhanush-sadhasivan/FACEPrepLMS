'use client';

import { useState, useEffect } from 'react';

interface ITDayStatusProps {
  itDaysCount: number;
  isITCountedToday: boolean;
  totalPlannedDays: number;
  currentDay: number;
  onITStatusChanged?: () => void;
}

export default function ITDayStatus({
  itDaysCount,
  isITCountedToday,
  totalPlannedDays,
  currentDay,
  onITStatusChanged,
}: ITDayStatusProps) {
  const [counted, setCounted] = useState(isITCountedToday);
  const [count, setCount] = useState(itDaysCount);

  useEffect(() => {
    setCounted(isITCountedToday);
    setCount(itDaysCount);
  }, [isITCountedToday, itDaysCount]);

  return (
    <div className="it-stats-grid">
      {/* IT Days Card (Per-Roadmap) */}
      <div className="it-stat-card">
        <div className="it-stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
          🎓
        </div>
        <div>
          <div className="it-stat-value" style={{ color: '#10b981' }}>
            {count}
          </div>
          <div className="it-stat-label">IT Days Logged (This Roadmap)</div>
        </div>
      </div>

      {/* Days Remaining Card */}
      <div className="it-stat-card">
        <div className="it-stat-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
          📋
        </div>
        <div>
          <div className="it-stat-value" style={{ color: '#6366f1' }}>
            {Math.max(0, totalPlannedDays - count)}
          </div>
          <div className="it-stat-label">Days Remaining</div>
        </div>
      </div>

      {/* Today's Status Card */}
      <div className="it-stat-card" style={{ flex: 1.5 }}>
        <div className="it-stat-icon-wrap" style={{ background: counted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: counted ? '#10b981' : '#f59e0b' }}>
          {counted ? '✅' : '⏳'}
        </div>
        <div style={{ flex: 1 }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {counted ? "Checked In for IT Today" : "Not Checked In Yet"}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {counted
                ? `Great job! Day ${count} of ${totalPlannedDays} unlocked for this roadmap.`
                : 'Use the "Check In for IT Today" button below to unlock the next day\'s problems.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
