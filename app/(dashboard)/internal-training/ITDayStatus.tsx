'use client';

import { useState, useEffect } from 'react';
import { ITAttendanceLocation, ITAttendanceDispute } from '@/lib/types';
import ITAttendanceToggle from './ITAttendanceToggle';

interface ITDayStatusProps {
  itDaysCount: number;
  isITCountedToday: boolean;
  totalPlannedDays: number;
  currentDay: number;
  location?: ITAttendanceLocation | null;
  pendingDispute?: ITAttendanceDispute | null;
  topicTitle?: string;
  onOpenCheckIn: () => void;
  onOpenDispute: () => void;
  isActionInProgress?: boolean;
}

export default function ITDayStatus({
  itDaysCount,
  isITCountedToday,
  totalPlannedDays,
  currentDay,
  location,
  pendingDispute,
  topicTitle,
  onOpenCheckIn,
  onOpenDispute,
  isActionInProgress = false,
}: ITDayStatusProps) {
  const [counted, setCounted] = useState(isITCountedToday);
  const [count, setCount] = useState(itDaysCount);

  useEffect(() => {
    setCounted(isITCountedToday);
    setCount(itDaysCount);
  }, [isITCountedToday, itDaysCount]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      {/* Primary Interactive Toggle Banner */}
      <ITAttendanceToggle
        isCheckedInToday={counted}
        pendingDispute={pendingDispute}
        location={location}
        dayNumber={counted ? count : Math.min(count + 1, totalPlannedDays || 1)}
        totalDays={totalPlannedDays}
        topicTitle={topicTitle}
        onOpenCheckIn={onOpenCheckIn}
        onOpenDispute={onOpenDispute}
        disabled={isActionInProgress}
      />

      {/* Stats Cards Grid */}
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

        {/* Current Active Location Card */}
        <div className="it-stat-card" style={{ flex: 1.2 }}>
          <div
            className="it-stat-icon-wrap"
            style={{
              background: counted && location ? 'rgba(59, 130, 246, 0.15)' : 'rgba(156, 163, 175, 0.15)',
              color: counted && location ? '#3b82f6' : '#9ca3af',
            }}
          >
            📍
          </div>
          <div>
            <div className="it-stat-value" style={{ fontSize: '1.05rem', color: counted && location ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {counted && location ? location.type : 'No Location Logged'}
            </div>
            <div className="it-stat-label">
              {counted && location?.detail ? location.detail : 'Today\'s Training Location'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
