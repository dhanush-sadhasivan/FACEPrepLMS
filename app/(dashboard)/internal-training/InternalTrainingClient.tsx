'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePresence } from './PresenceTracker';
import ITDayStatus from './ITDayStatus';
import RoadmapSelector from './RoadmapSelector';
import TodaysPlanCard from './TodaysPlanCard';
import PendingQuestionsPanel from './PendingQuestionsPanel';
import TrainerOverviewTable from './TrainerOverviewTable';
import { ITDayQuestion } from '@/lib/types';
import './page.css';

interface InternalTrainingClientProps {
  currentUser: {
    id: string;
    full_name: string;
    role: string;
    it_days_count: number;
    last_it_check_date?: string | null;
  };
  assignedRoadmaps: { id: string; title: string; domain?: string }[];
}

export default function InternalTrainingClient({
  currentUser,
  assignedRoadmaps,
}: InternalTrainingClientProps) {
  // 1. Supabase Realtime Presence
  const onlineUserIds = usePresence(currentUser);

  // 2. Active Roadmap State
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>(
    assignedRoadmaps[0]?.id || ''
  );
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [trainerData, setTrainerData] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadTrainerPlan = useCallback(async (roadmapId: string) => {
    if (!roadmapId) {
      setLoadingPlan(false);
      return;
    }
    setLoadingPlan(true);
    try {
      const res = await fetch(`/api/internal-training/day-plan/${roadmapId}/trainer`);
      if (res.ok) {
        const data = await res.json();
        setTrainerData(data);
      }
    } catch (err) {
      console.error('Error loading trainer plan:', err);
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoadmapId) {
      loadTrainerPlan(selectedRoadmapId);
    } else {
      setLoadingPlan(false);
    }
  }, [selectedRoadmapId, loadTrainerPlan]);

  // Handle Question Launch & Click Recording
  const handleQuestionClickConfirmed = async (q: ITDayQuestion) => {
    try {
      // 1. Record click & trigger IT auto-count on server
      const res = await fetch('/api/internal-training/question-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayQuestionId: q.id }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.itAttendance?.alreadyCountedToday === false) {
          showToast(`🎉 Internal Training (IT) Day recorded! Total IT Days: ${result.itAttendance.newCount}`);
        }
      }
    } catch (err) {
      console.error('Error registering question click:', err);
    }

    // 2. Open problem link in new tab
    if (q.url) {
      window.open(q.url, '_blank', 'noopener,noreferrer');
    }

    // 3. Refresh day plan data
    if (selectedRoadmapId) {
      await loadTrainerPlan(selectedRoadmapId);
    }
  };

  // Handle Custom Question Completion Toggle
  const handleToggleCustomComplete = async (questionId: string, isCompleted: boolean) => {
    try {
      const res = await fetch('/api/internal-training/question-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayQuestionId: questionId, isCompleted }),
      });

      if (res.ok) {
        showToast(isCompleted ? '✅ Marked problem as completed!' : 'Problem marked incomplete.');
        if (selectedRoadmapId) {
          await loadTrainerPlan(selectedRoadmapId);
        }
      }
    } catch (err) {
      console.error('Error toggling complete:', err);
    }
  };

  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';
  const hasAssignedRoadmaps = assignedRoadmaps.length > 0;

  return (
    <div className="it-dashboard-page">
      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 999999,
            background: 'var(--surface-3, #1f2937)',
            color: 'var(--text-primary, #fff)',
            padding: '0.85rem 1.35rem',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: '1px solid var(--border)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Top Banner */}
      <header className="it-header-banner">
        <div>
          <h1 className="it-header-title">
            <span>🎓</span> Internal Training Dashboard
          </h1>
          <p className="it-header-subtitle">
            {isAdminOrManager && !hasAssignedRoadmaps ? (
              <>
                Manager Control Center: Monitor live trainer online presence, assigned roadmaps, day progress, and backlog statuses in real time.
              </>
            ) : (
              <>
                Welcome back, <strong>{currentUser.full_name}</strong>! Track your IT vs Non-IT days, solve today&apos;s assigned topics, and clear pending problem backlogs.
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="presence-dot online" style={{ margin: 0 }} />
            Live Connected
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', background: 'var(--surface-2)', padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Role: {currentUser.role}
          </span>
        </div>
      </header>

      {/* Personal Trainer Daily Plan Section (Only shown if this user is allocated with an IT roadmap) */}
      {hasAssignedRoadmaps && (
        <>
          {/* IT Day Stats Widget */}
          <ITDayStatus
            itDaysCount={trainerData?.itDaysCount ?? currentUser.it_days_count ?? 0}
            isITCountedToday={trainerData?.isITCountedToday ?? false}
            totalPlannedDays={trainerData?.progress?.total_days ?? 0}
            currentDay={trainerData?.progress?.current_day ?? 1}
            onITStatusChanged={(newCount) => {
              if (selectedRoadmapId) loadTrainerPlan(selectedRoadmapId);
            }}
          />

          {/* Roadmap Selector (if multiple assigned) */}
          {assignedRoadmaps.length > 1 && (
            <RoadmapSelector
              roadmaps={assignedRoadmaps}
              selectedId={selectedRoadmapId}
              onSelectRoadmap={(id) => setSelectedRoadmapId(id)}
            />
          )}

          {loadingPlan ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="roadmap-spinner" style={{ margin: '0 auto 0.75rem' }} />
              Loading today&apos;s day plan &amp; challenges…
            </div>
          ) : (
            <>
              {/* Today's Topic & Plan Card */}
              <TodaysPlanCard
                dayPlan={trainerData?.todayPlan || null}
                currentDay={trainerData?.progress?.current_day || 1}
                totalDays={trainerData?.progress?.total_days || 0}
                extendedDays={trainerData?.progress?.extended_days || 0}
                onQuestionClickConfirmed={handleQuestionClickConfirmed}
                onToggleCustomComplete={handleToggleCustomComplete}
              />

              {/* Previous Days Pending Backlog */}
              <PendingQuestionsPanel
                pendingByDay={trainerData?.pendingByDay || []}
                onQuestionClickConfirmed={handleQuestionClickConfirmed}
                onToggleCustomComplete={handleToggleCustomComplete}
              />
            </>
          )}
        </>
      )}

      {/* Unallocated Trainer Notice */}
      {!hasAssignedRoadmaps && !isAdminOrManager && (
        <div style={{ padding: '3.5rem 2rem', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🗺️</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
            No IT Training Roadmaps Assigned
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
            Your manager hasn&apos;t assigned any Internal Training day-wise roadmaps to your account or group yet.
          </p>
        </div>
      )}

      {/* Manager / Admin Cohort Overview & Live Presence */}
      {isAdminOrManager && (
        <TrainerOverviewTable onlineUserIds={onlineUserIds} />
      )}
    </div>
  );
}
