'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { CourseAssignment, Course } from '@/lib/types';
import { useSkills, useCourses } from '@/lib/swr-hooks';
import './page.css';

type LevelFilter = 'all' | 'Beginner' | 'Intermediate' | 'Advanced';
type BadgeStatusFilter = 'all' | 'mastered' | 'in_progress' | 'locked' | 'contest' | 'topic';

const LEVEL_CONFIG: Record<string, { color: string; bg: string }> = {
  Beginner: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  Intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  Advanced: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const CATEGORY_ICONS: Record<string, string> = {
  Python: '🐍',
  'Data Structures': '📊',
  'Web Dev': '🌐',
  Cloud: '☁️',
  'System Design': '🏗️',
  SQL: '🗃️',
  General: '📚',
  Java: '☕',
  DSA: '🧠',
  DevOps: '⚙️',
};

const STORAGE_KEY = 'lms_completed_course_subtopics';

// Helper to determine trainer tier rank
function getTrainerRank(earnedCount: number) {
  if (earnedCount >= 12) return { title: 'Legendary Master', icon: '🌟', level: 5, color: '#f59e0b', nextGoal: null };
  if (earnedCount >= 8) return { title: 'Grandmaster Trainer', icon: '👑', level: 4, color: '#ec4899', nextGoal: 12 };
  if (earnedCount >= 4) return { title: 'Master Problem Solver', icon: '💎', level: 3, color: '#6366f1', nextGoal: 8 };
  if (earnedCount >= 1) return { title: 'Specialist Trainer', icon: '⚡', level: 2, color: '#10b981', nextGoal: 4 };
  return { title: 'Apprentice Coder', icon: '🎯', level: 1, color: '#94a3b8', nextGoal: 1 };
}

export default function SkillsPage() {
  const [activeMainTab, setActiveMainTab] = useState<'badges' | 'courses'>('badges');
  const [statusFilter, setStatusFilter] = useState<BadgeStatusFilter>('all');
  const [badgeSearch, setBadgeSearch] = useState('');

  // SWR Cached State for Badges & Courses
  const { data: skillsData, isLoading: skillsLoading } = useSkills();
  const { data: coursesData, isLoading: coursesLoading } = useCourses();
  const assignments = coursesData || [];
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);

  // Filter state
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<CourseAssignment | null>(null);

  // Subtopic completion tracking state
  const [completedSubtopicKeys, setCompletedSubtopicKeys] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCompletedSubtopicKeys(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load completed subtopics from storage:', e);
    }
  }, []);

  const toggleSubtopicCompletion = (courseId: string, topicName: string) => {
    const key = `${courseId}___${topicName}`;
    setCompletedSubtopicKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save completed subtopics:', e);
      }
      return next;
    });
  };

  const getCourseSubtopicStats = (course: Course) => {
    let total = 0;
    let completed = 0;
    (course.syllabus || []).forEach((w) => {
      (w.topics || []).forEach((t) => {
        total++;
        const key = `${course.id}___${t}`;
        if (completedSubtopicKeys.includes(key)) completed++;
      });
    });

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const status: 'completed' | 'in_progress' | 'not_started' =
      total > 0 && completed === total
        ? 'completed'
        : completed > 0
        ? 'in_progress'
        : 'not_started';

    return { total, completed, pct, status };
  };

  const earnedTopicBadges = skillsData?.topicBadges || [];
  const earnedContestBadges = skillsData?.contestBadges || [];
  const inProgressTopics = skillsData?.inProgressTopics || [];
  const allBadges: any[] = skillsData?.allBadges || [...earnedTopicBadges, ...earnedContestBadges, ...inProgressTopics];

  const earnedBadges = useMemo(() => {
    return allBadges.filter((b) => b.isCompleted);
  }, [allBadges]);

  const inProgressBadges = useMemo(() => {
    return allBadges.filter((b) => !b.isCompleted && (b.solved > 0));
  }, [allBadges]);

  const lockedBadges = useMemo(() => {
    return allBadges.filter((b) => !b.isCompleted && (!b.solved || b.solved === 0));
  }, [allBadges]);

  const rankInfo = getTrainerRank(earnedBadges.length);

  // Filtered badges based on status filter & search
  const filteredBadges = useMemo(() => {
    let list = allBadges;

    if (statusFilter === 'mastered') {
      list = earnedBadges;
    } else if (statusFilter === 'in_progress') {
      list = inProgressBadges;
    } else if (statusFilter === 'locked') {
      list = lockedBadges;
    } else if (statusFilter === 'contest') {
      list = allBadges.filter((b) => b.type === 'contest');
    } else if (statusFilter === 'topic') {
      list = allBadges.filter((b) => b.type === 'topic');
    }

    if (badgeSearch.trim()) {
      const q = badgeSearch.toLowerCase().trim();
      list = list.filter((b) =>
        b.title?.toLowerCase().includes(q) ||
        b.badgeCategory?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allBadges, earnedBadges, inProgressBadges, lockedBadges, statusFilter, badgeSearch]);

  const allCategories = [...new Set(assignments.map((a) => a.course?.category).filter(Boolean))] as string[];

  const filteredCourses = assignments.filter((a) => {
    const course = a.course;
    if (!course) return false;
    if (levelFilter !== 'all' && course.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && course.category !== categoryFilter) return false;
    if (
      search &&
      !course.title.toLowerCase().includes(search.toLowerCase()) &&
      !(course.description || '').toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="courses-page">
      {/* ── Hero Mastery Showcase Banner ──────────────────────────────────────── */}
      <div className="skills-hero-banner">
        <div className="skills-hero-left">
          <div className="skills-hero-avatar-emblem">
            {rankInfo.icon}
          </div>
          <div>
            <div className="skills-hero-rank-tag">
              Level {rankInfo.level} &bull; {rankInfo.title}
            </div>
            <h1 className="skills-hero-title">
              Skills &amp; Mastery Badges
            </h1>
            <p className="skills-hero-subtitle">
              Solve 100% of all challenges in any topic or contest to unlock official verified skill trophies.
            </p>
          </div>
        </div>

        <div className="skills-hero-stats">
          <div className="skills-hero-stat-item">
            <div className="skills-hero-stat-val" style={{ color: '#f59e0b' }}>
              {earnedBadges.length}
            </div>
            <div className="skills-hero-stat-label">Trophies Earned</div>
          </div>

          <div className="skills-hero-stat-item">
            <div className="skills-hero-stat-val" style={{ color: 'var(--accent)' }}>
              {inProgressBadges.length}
            </div>
            <div className="skills-hero-stat-label">In Progress</div>
          </div>

          <div className="skills-hero-stat-item">
            <div className="skills-hero-stat-val" style={{ color: 'var(--success)' }}>
              {skillsData?.totalSolved || 0}
            </div>
            <div className="skills-hero-stat-label">Solved Problems</div>
          </div>
        </div>
      </div>

      {/* ── Top Overview Stats Widgets ────────────────────────────────────────── */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#f59e0b' }}>🏆</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#f59e0b' }}>{earnedBadges.length}</div>
            <div className="stat-widget-label">Earned Badges</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#10b981' }}>👑</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#10b981' }}>{earnedTopicBadges.length}</div>
            <div className="stat-widget-label">Topic Masters</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>⚡</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{inProgressBadges.length}</div>
            <div className="stat-widget-label">Active Milestones</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#8b5cf6' }}>🔒</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#8b5cf6' }}>{lockedBadges.length}</div>
            <div className="stat-widget-label">Available to Unlock</div>
          </div>
        </div>
      </div>

      {/* ── Main Section Tabs ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setActiveMainTab('badges')}
          className={`btn btn-sm ${activeMainTab === 'badges' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 800, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem' }}
        >
          <span>🏆</span> Skills &amp; Badges Library ({allBadges.length})
        </button>

        <button
          onClick={() => setActiveMainTab('courses')}
          className={`btn btn-sm ${activeMainTab === 'courses' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 800, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem' }}
        >
          <span>📚</span> Assigned Courses &amp; Curriculum ({assignments.length})
        </button>
      </div>

      {/* ── TAB 1: SKILLS & BADGES VIEW ──────────────────────────────────────── */}
      {activeMainTab === 'badges' && (
        <div>
          {/* Filters & Search Toolbar */}
          <div className="skills-filter-toolbar">
            <div className="skills-filter-tabs">
              {[
                { id: 'all', label: `✨ All (${allBadges.length})` },
                { id: 'mastered', label: `🏆 Mastered (${earnedBadges.length})` },
                { id: 'in_progress', label: `⚡ In Progress (${inProgressBadges.length})` },
                { id: 'locked', label: `🔒 Available (${lockedBadges.length})` },
                { id: 'topic', label: `🔗 Topic Skills (${allBadges.filter((b) => b.type === 'topic').length})` },
                { id: 'contest', label: `👑 Contest Champions (${allBadges.filter((b) => b.type === 'contest').length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as BadgeStatusFilter)}
                  className={`skills-filter-btn ${statusFilter === f.id ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="search-box-wrapper" style={{ minWidth: 240, maxWidth: 320 }}>
              <span className="search-box-icon">🔍</span>
              <input
                type="text"
                className="search-box-input"
                placeholder="Search badges by skill..."
                value={badgeSearch}
                onChange={(e) => setBadgeSearch(e.target.value)}
              />
            </div>
          </div>

          {skillsLoading ? (
            <div className="courses-loading">
              <div className="courses-spinner" />
              <span>Loading your skills &amp; badges catalog…</span>
            </div>
          ) : filteredBadges.length === 0 ? (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px dashed var(--border)',
                borderRadius: '16px',
                padding: '3rem 2rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎯</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>No Badges Found</h3>
              <p style={{ maxWidth: 460, margin: '0.5rem auto 1.5rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {badgeSearch
                  ? `No skill badges match "${badgeSearch}". Try a different keyword.`
                  : 'No badges currently match the selected filter.'}
              </p>
              {badgeSearch && (
                <button onClick={() => setBadgeSearch('')} className="btn btn-secondary btn-sm">
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="badges-modern-grid">
              {filteredBadges.map((b) => {
                const isMastered = b.isCompleted;
                const isInProgress = !isMastered && b.solved > 0;
                const isLocked = !isMastered && (!b.solved || b.solved === 0);

                const tierClass = isMastered
                  ? 'tier-mastered'
                  : isInProgress
                  ? 'tier-in-progress'
                  : 'tier-locked';

                const emblemClass = isMastered
                  ? 'mastered'
                  : isInProgress
                  ? 'in-progress'
                  : 'locked';

                return (
                  <div
                    key={b.id}
                    className={`badge-modern-card ${tierClass}`}
                    onClick={() => setSelectedBadge(b)}
                  >
                    {/* Top Row: Icon + Status Pill */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div className={`badge-emblem-frame ${emblemClass}`}>
                        {b.badgeIcon || (isMastered ? '🏆' : isInProgress ? '⚡' : '🔒')}
                      </div>

                      {isMastered ? (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.5rem',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: 'var(--success, #10b981)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <span>✓</span> Mastered
                        </span>
                      ) : isInProgress ? (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.5rem',
                            borderRadius: '6px',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: 'var(--accent, #6366f1)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <span>⚡</span> {b.pct}% DONE
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.5rem',
                            borderRadius: '6px',
                            background: 'var(--surface-3)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          🔒 Available
                        </span>
                      )}
                    </div>

                    {/* Middle: Title & Category */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: isMastered ? '#f59e0b' : isInProgress ? 'var(--accent)' : 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '0.15rem',
                        }}
                      >
                        {b.badgeCategory || (b.type === 'contest' ? 'Contest Mastery' : 'Topic Skill')}
                      </div>

                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.02rem',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          lineHeight: 1.3,
                        }}
                      >
                        {b.title}
                      </h3>

                      {isInProgress && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700, marginTop: '0.3rem' }}>
                          🎯 Need {b.total - b.solved} more to unlock
                        </div>
                      )}
                    </div>

                    {/* Bottom: Progress Bar */}
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                        <span>Progress</span>
                        <span
                          style={{
                            color: isMastered ? 'var(--success)' : isInProgress ? 'var(--accent)' : 'var(--text-muted)',
                            fontWeight: 800,
                          }}
                        >
                          {b.solved || 0} / {b.total} ({b.pct || 0}%)
                        </span>
                      </div>

                      <div style={{ height: '6px', width: '100%', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${b.pct || 0}%`,
                            background: isMastered
                              ? 'linear-gradient(90deg, #10b981, #059669)'
                              : 'linear-gradient(90deg, #6366f1, #38bdf8)',
                            borderRadius: '999px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ASSIGNED COURSES VIEW ────────────────────────────────────── */}
      {activeMainTab === 'courses' && (
        <div>
          {/* Controls */}
          <div className="courses-controls">
            <div className="courses-level-tabs">
              {(['all', 'Beginner', 'Intermediate', 'Advanced'] as LevelFilter[]).map((lv) => {
                const count =
                  lv === 'all'
                    ? assignments.length
                    : assignments.filter((a) => a.course?.level === lv).length;
                if (lv !== 'all' && count === 0) return null;
                return (
                  <button
                    key={lv}
                    className={`courses-level-tab ${levelFilter === lv ? 'active' : ''}`}
                    onClick={() => setLevelFilter(lv)}
                    style={
                      levelFilter === lv && lv !== 'all'
                        ? {
                            color: LEVEL_CONFIG[lv].color,
                            background: LEVEL_CONFIG[lv].bg,
                            borderColor: LEVEL_CONFIG[lv].color,
                          }
                        : undefined
                    }
                  >
                    {lv === 'all' ? 'All Courses' : lv} <span className="tab-count-pill">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="search-box-wrapper" style={{ maxWidth: 300 }}>
              <span className="search-box-icon">🔍</span>
              <input
                type="text"
                className="search-box-input"
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Category Pills */}
          {allCategories.length > 0 && (
            <div className="courses-category-pills">
              <button
                className={`category-pill ${categoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
                All Categories
              </button>
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  className={`category-pill ${categoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  <span>{CATEGORY_ICONS[cat] || '📚'}</span>
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          )}

          {coursesLoading ? (
            <div className="courses-loading">
              <div className="courses-spinner" />
              <span>Loading assigned courses…</span>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="courses-empty">
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📚</div>
              <h3>No courses found</h3>
              <p>No courses match your filter criteria.</p>
            </div>
          ) : (
            <div className="courses-grid">
              {filteredCourses.map((assignment) => {
                const course = assignment.course;
                if (!course) return null;
                const stats = getCourseSubtopicStats(course);
                const lvlCfg = LEVEL_CONFIG[course.level] || LEVEL_CONFIG.Beginner;

                return (
                  <div key={assignment.id} className="course-card">
                    <div className="course-card-body">
                      <div className="course-card-meta">
                        <span className="course-level-badge" style={{ color: lvlCfg.color, background: lvlCfg.bg }}>
                          {course.level}
                        </span>
                        <span className="course-cat-chip">
                          {CATEGORY_ICONS[course.category] || '📚'} {course.category}
                        </span>
                      </div>

                      <h3 className="course-card-title">{course.title}</h3>
                      {course.description && (
                        <p className="course-card-desc">{course.description}</p>
                      )}

                      {/* Subtopic Progress Bar */}
                      <div style={{ marginTop: '0.85rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginBottom: '0.3rem',
                            fontWeight: 600,
                          }}
                        >
                          <span>Module Progress</span>
                          <span style={{ color: stats.pct === 100 ? 'var(--success)' : 'var(--accent)', fontWeight: 800 }}>
                            {stats.completed} / {stats.total} subtopics ({stats.pct}%)
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${stats.pct}%`,
                              background:
                                stats.pct === 100
                                  ? 'linear-gradient(90deg, #10b981, #059669)'
                                  : 'linear-gradient(90deg, #f05237, #e87a00)',
                              borderRadius: '999px',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="course-card-footer">
                      <div className="course-meta-info">
                        <span>⏱️ {(course as any).estimated_hours || 10}h</span>
                        <span>•</span>
                        <span>
                          📅 {new Date((assignment as any).assigned_at || assignment.created_at || Date.now()).toLocaleDateString()}
                        </span>
                      </div>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedAssignment(assignment)}
                        style={{ fontWeight: 600 }}
                      >
                        📖 View Syllabus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 3D-STYLED BADGE DETAILS MODAL ────────────────────────────────────────── */}
      {selectedBadge && (
        <div className="badge-modal-backdrop" onClick={() => setSelectedBadge(null)}>
          <div className="badge-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedBadge(null)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '1rem',
                fontWeight: 700,
              }}
            >
              ✕
            </button>

            <div className="badge-modal-icon-circle">
              {selectedBadge.badgeIcon || (selectedBadge.isCompleted ? '🏆' : '⚡')}
            </div>

            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: selectedBadge.isCompleted ? '#f59e0b' : 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '0.25rem',
              }}
            >
              🏆 {selectedBadge.badgeCategory || 'Official Skill Badge'}
            </div>

            <h2 className="badge-modal-title">{selectedBadge.title}</h2>

            <div style={{ margin: '0.5rem 0 1rem' }}>
              {selectedBadge.isCompleted ? (
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    padding: '0.25rem 0.85rem',
                    borderRadius: '999px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  ✅ OFFICIAL BADGE EARNED (100% MASTERED)
                </span>
              ) : selectedBadge.solved > 0 ? (
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    padding: '0.25rem 0.85rem',
                    borderRadius: '999px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#6366f1',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  ⚡ IN PROGRESS ({selectedBadge.pct}%)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    padding: '0.25rem 0.85rem',
                    borderRadius: '999px',
                    background: 'var(--surface-3)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}
                >
                  🔒 AVAILABLE TO UNLOCK
                </span>
              )}
            </div>

            <p className="badge-modal-desc">
              {selectedBadge.type === 'contest'
                ? `Awarded for demonstrating competitive programming mastery by completing 100% of all challenges in "${selectedBadge.title}". Validates speed, test-case resilience, and problem-solving execution under contest conditions.`
                : `Awarded for achieving 100% mastery across all curated practice questions in the "${selectedBadge.title}" domain. Certifies deep understanding of core algorithmic patterns, data structures, and optimal edge-case handling.`}
            </p>

            {/* Progress Breakdown */}
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  marginBottom: '0.4rem',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>Questions Solved</span>
                <span
                  style={{
                    color: selectedBadge.isCompleted
                      ? 'var(--success)'
                      : selectedBadge.solved > 0
                      ? 'var(--accent)'
                      : 'var(--text-muted)',
                  }}
                >
                  {selectedBadge.solved || 0} / {selectedBadge.total} ({selectedBadge.pct || 0}%)
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${selectedBadge.pct || 0}%`,
                    background: selectedBadge.isCompleted
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #6366f1, #38bdf8)',
                    borderRadius: 999,
                  }}
                />
              </div>
              {!selectedBadge.isCompleted && (
                <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, marginTop: '0.5rem', textAlign: 'center' }}>
                  🎯 Solve {selectedBadge.total - (selectedBadge.solved || 0)} more problem(s) to unlock this badge!
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/roadmaps" className="btn btn-primary" style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                🗺️ Practice in Roadmaps →
              </Link>
              <Link href="/contests" className="btn btn-secondary" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                🏆 Explore Contests
              </Link>
              <button onClick={() => setSelectedBadge(null)} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COURSE SYLLABUS MODAL ────────────────────────────────────────────── */}
      {selectedAssignment && selectedAssignment.course && (
        <div className="modal-backdrop" onClick={() => setSelectedAssignment(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <span className="course-cat-chip" style={{ marginBottom: '0.35rem', display: 'inline-block' }}>
                  {CATEGORY_ICONS[selectedAssignment.course.category] || '📚'} {selectedAssignment.course.category}
                </span>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>{selectedAssignment.course.title}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedAssignment(null)}>✕</button>
            </div>

            <div className="modal-body">
              {selectedAssignment.course.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                  {selectedAssignment.course.description}
                </p>
              )}

              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                📖 Interactive Course Syllabus &amp; Tracker
              </h3>

              {(!selectedAssignment.course.syllabus || selectedAssignment.course.syllabus.length === 0) ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No syllabus modules defined for this course.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedAssignment.course.syllabus.map((week, wIdx) => (
                    <div key={wIdx} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>
                        Week {week.week}: {(week as any).title || 'Module'}
                      </div>
                      {week.topics && week.topics.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                          {week.topics.map((topic, tIdx) => {
                            const subtopicKey = `${selectedAssignment.course?.id}___${topic}`;
                            const isDone = completedSubtopicKeys.includes(subtopicKey);
                            return (
                              <label
                                key={tIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.6rem',
                                  fontSize: '0.85rem',
                                  color: isDone ? 'var(--text-muted)' : 'var(--text-secondary)',
                                  textDecoration: isDone ? 'line-through' : 'none',
                                  cursor: 'pointer',
                                  padding: '0.2rem 0',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => toggleSubtopicCompletion(selectedAssignment.course!.id, topic)}
                                  style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                                />
                                <span>{topic}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
