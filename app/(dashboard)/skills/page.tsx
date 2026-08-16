'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CourseAssignment, Course } from '@/lib/types';
import './page.css';

type LevelFilter = 'all' | 'Beginner' | 'Intermediate' | 'Advanced';
type BadgeFilter = 'all' | 'topic' | 'contest';

const LEVEL_CONFIG: Record<string, { color: string; bg: string }> = {
  Beginner: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  Intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  Advanced: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const CATEGORY_ICONS: Record<string, string> = {
  Python: '🐍', 'Data Structures': '📊', 'Web Dev': '🌐', Cloud: '☁️', 'System Design': '🏗️', SQL: '🗃️', General: '📚', Java: '☕', DSA: '🧠', DevOps: '⚙️',
};

const STORAGE_KEY = 'lms_completed_course_subtopics';

export default function SkillsPage() {
  const [activeMainTab, setActiveMainTab] = useState<'badges' | 'courses'>('badges');
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>('all');
  
  // Badges state
  const [skillsData, setSkillsData] = useState<any>(null);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);

  // Courses state
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
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

  const fetchSkillsData = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch('/api/trainer/skills');
      if (res.ok) {
        setSkillsData(await res.json());
      }
    } catch (e) {
      console.error('Failed to load skills badges:', e);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const res = await fetch('/api/trainer/courses');
      if (res.ok) setAssignments(await res.json());
    } catch (e) {
      console.error('Failed to load courses:', e);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkillsData();
    fetchCourses();
  }, [fetchSkillsData, fetchCourses]);

  const toggleSubtopicCompletion = (courseId: string, topicName: string) => {
    const key = `${courseId}___${topicName}`;
    setCompletedSubtopicKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
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
    (course.syllabus || []).forEach(w => {
      (w.topics || []).forEach(t => {
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

  // ONLY 100% EARNED BADGES ARE RETURNED IN topicBadges & contestBadges
  const earnedTopicBadges = skillsData?.topicBadges || [];
  const earnedContestBadges = skillsData?.contestBadges || [];
  const inProgressTopics = skillsData?.inProgressTopics || [];

  const earnedBadges = [
    ...earnedTopicBadges,
    ...earnedContestBadges,
  ];

  const filteredEarnedBadges = earnedBadges.filter(b => {
    if (badgeFilter === 'topic') return b.type === 'topic';
    if (badgeFilter === 'contest') return b.type === 'contest';
    return true;
  });

  const allCategories = [...new Set(assignments.map(a => a.course?.category).filter(Boolean))] as string[];

  const filteredCourses = assignments.filter(a => {
    const course = a.course;
    if (!course) return false;
    if (levelFilter !== 'all' && course.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && course.category !== categoryFilter) return false;
    if (search && !course.title.toLowerCase().includes(search.toLowerCase()) && !(course.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="courses-page">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <header className="courses-header" style={{ marginBottom: '0.75rem', paddingBottom: '0.65rem' }}>
        <div>
          <h1 className="courses-title" style={{ fontSize: '1.45rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <span>🏆</span> My Skills &amp; Badges
          </h1>
          <p className="courses-subtitle" style={{ fontSize: '0.84rem', marginTop: '0.15rem' }}>
            Complete 100% of all problems in any topic or contest to earn official skill badges!
          </p>
        </div>
      </header>

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
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{inProgressTopics.length}</div>
            <div className="stat-widget-label">In Progress</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>📊</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{skillsData?.totalSolved || 0}</div>
            <div className="stat-widget-label">Solved Problems</div>
          </div>
        </div>
      </div>

      {/* ── Main Section Tabs ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.45rem', marginBottom: '0.85rem' }}>
        <button
          onClick={() => setActiveMainTab('badges')}
          className={`btn btn-sm ${activeMainTab === 'badges' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <span>🏆</span> Earned Badges ({earnedBadges.length})
        </button>

        <button
          onClick={() => setActiveMainTab('courses')}
          className={`btn btn-sm ${activeMainTab === 'courses' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <span>📚</span> Assigned Courses ({assignments.length})
        </button>
      </div>

      {/* ── TAB 1: SKILLS & BADGES VIEW ──────────────────────────────────────── */}
      {activeMainTab === 'badges' && (
        <div>
          {/* Badge Category Filters */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            {(['all', 'topic', 'contest'] as BadgeFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setBadgeFilter(f)}
                className={`courses-level-tab ${badgeFilter === f ? 'active' : ''}`}
                style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              >
                {f === 'all' && `🏆 All Badges (${earnedBadges.length})`}
                {f === 'topic' && `🔗 Topic Masters (${earnedTopicBadges.length})`}
                {f === 'contest' && `👑 Contest Champions (${earnedContestBadges.length})`}
              </button>
            ))}
          </div>

          {skillsLoading ? (
            <div className="courses-loading">
              <div className="courses-spinner" />
              <span>Loading your earned badges…</span>
            </div>
          ) : filteredEarnedBadges.length === 0 ? (
            <div className="courses-empty" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: '16px', padding: '3rem 2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎯</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>No 100% Completed Badges Earned Yet</h3>
              <p style={{ maxWidth: 520, margin: '0.5rem auto 1.5rem auto', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Badges are awarded when you solve <strong>100% of all problems</strong> in a specific topic (e.g. Linked List: 20/20). Check your active topics below to see your progress!
              </p>
            </div>
          ) : (
            <div className="badges-compact-grid">
              {filteredEarnedBadges.map(b => (
                <div
                  key={b.id}
                  className="badge-card-compact"
                  onClick={() => setSelectedBadge(b)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div className="badge-icon-frame">
                      {b.badgeIcon || '🏆'}
                    </div>

                    <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', letterSpacing: '0.04em' }}>
                      100% MASTERED
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {b.badgeCategory || 'Topic Skill'}
                    </span>
                    <h3 style={{ margin: '0.15rem 0 0.4rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                      {b.title}
                    </h3>
                  </div>

                  <div style={{ marginTop: '0.65rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                      <span>Mastery Solved</span>
                      <span style={{ color: 'var(--success)', fontWeight: 800 }}>{b.solved} / {b.total}</span>
                    </div>
                    <div style={{ height: '5px', width: '100%', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '999px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── IN-PROGRESS TOPIC PROGRESS TRACKER ──────────────────────────────── */}
          {inProgressTopics.length > 0 && (
            <div style={{ marginTop: '2rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem 1.5rem' }}>
              <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚡</span> Active Progress Towards Next Badges
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', margin: '0 0 1.15rem 0' }}>
                Solve the remaining problems in these topics to unlock your official 100% skill badges! Click any card for details.
              </p>

              <div className="badges-compact-grid" style={{ marginBottom: 0 }}>
                {inProgressTopics.map((t: any) => (
                  <div
                    key={t.id}
                    className="badge-card-compact in-progress"
                    onClick={() => setSelectedBadge(t)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <div className="badge-icon-frame">
                        {t.badgeIcon || '⚡'}
                      </div>

                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        {t.pct}% DONE
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary)', lineHeight: 1.25 }}>{t.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, marginTop: '0.2rem' }}>
                        Need {t.total - t.solved} more to finish
                      </div>
                    </div>

                    <div style={{ marginTop: '0.65rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                        <span>Progress</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{t.solved} / {t.total}</span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${t.pct}%`, background: 'linear-gradient(90deg, #6366f1, #4f46e5)', borderRadius: '999px' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              {(['all', 'Beginner', 'Intermediate', 'Advanced'] as LevelFilter[]).map(lv => {
                const count = lv === 'all' ? assignments.length : assignments.filter(a => a.course?.level === lv).length;
                if (lv !== 'all' && count === 0) return null;
                return (
                  <button
                    key={lv}
                    className={`courses-level-tab ${levelFilter === lv ? 'active' : ''}`}
                    onClick={() => setLevelFilter(lv)}
                    style={levelFilter === lv && lv !== 'all' ? { color: LEVEL_CONFIG[lv].color, background: LEVEL_CONFIG[lv].bg, borderColor: LEVEL_CONFIG[lv].color } : undefined}
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
              {allCategories.map(cat => (
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
              {filteredCourses.map(assignment => {
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                          <span>Module Progress</span>
                          <span style={{ color: stats.pct === 100 ? 'var(--success)' : 'var(--accent)', fontWeight: 800 }}>
                            {stats.completed} / {stats.total} subtopics ({stats.pct}%)
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${stats.pct}%`, background: stats.pct === 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f05237, #e87a00)', borderRadius: '999px' }} />
                        </div>
                      </div>
                    </div>

                    <div className="course-card-footer">
                      <div className="course-meta-info">
                        <span>⏱️ {course.estimated_hours}h</span>
                        <span>•</span>
                        <span>📅 {new Date(assignment.assigned_at).toLocaleDateString()}</span>
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

      {/* ── BADGE DETAILS MODAL ────────────────────────────────────────────────── */}
      {selectedBadge && (
        <div className="badge-modal-backdrop" onClick={() => setSelectedBadge(null)}>
          <div className="badge-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedBadge(null)}
              style={{
                position: 'absolute', top: 14, right: 14, background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: '50%', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 700
              }}
            >
              ✕
            </button>

            <div className="badge-modal-icon-circle">
              {selectedBadge.badgeIcon || '🏆'}
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>
              🏆 {selectedBadge.badgeCategory || 'Official Skill Badge'}
            </div>

            <h2 className="badge-modal-title">{selectedBadge.title}</h2>

            <div style={{ margin: '0.5rem 0 1rem' }}>
              {selectedBadge.isCompleted ? (
                <span style={{ fontSize: '0.8rem', fontWeight: 800, padding: '0.25rem 0.85rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ✅ OFFICIAL BADGE EARNED (100% MASTERED)
                </span>
              ) : (
                <span style={{ fontSize: '0.8rem', fontWeight: 800, padding: '0.25rem 0.85rem', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  ⚡ IN PROGRESS ({selectedBadge.pct}%)
                </span>
              )}
            </div>

            <p className="badge-modal-desc">
              {selectedBadge.type === 'contest'
                ? `Awarded for demonstrating competitive programming proficiency by completing 100% of all challenges in "${selectedBadge.title}". Validates speed, test-case resilience, and problem-solving execution under contest conditions.`
                : `Awarded for achieving 100% mastery across all curated practice questions in the "${selectedBadge.title}" topic. Certifies deep understanding of core algorithmic patterns, data structures, and edge-case handling.`}
            </p>

            {/* Progress Breakdown */}
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Questions Solved</span>
                <span style={{ color: selectedBadge.isCompleted ? 'var(--success)' : 'var(--accent)' }}>
                  {selectedBadge.solved} / {selectedBadge.total} ({selectedBadge.pct || (selectedBadge.isCompleted ? 100 : 0)}%)
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${selectedBadge.pct || (selectedBadge.isCompleted ? 100 : 0)}%`, background: selectedBadge.isCompleted ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #6366f1, #4f46e5)', borderRadius: 999 }} />
              </div>
              {!selectedBadge.isCompleted && (
                <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, marginTop: '0.5rem', textAlign: 'center' }}>
                  🎯 Solve {selectedBadge.total - selectedBadge.solved} more problem(s) to unlock this badge!
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link href="/contests" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                🔍 Practice Contests &amp; Topics →
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
                        Week {week.week}: {week.title}
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
                                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                                  fontSize: '0.85rem', color: isDone ? 'var(--text-muted)' : 'var(--text-secondary)',
                                  textDecoration: isDone ? 'line-through' : 'none',
                                  cursor: 'pointer', padding: '0.2rem 0',
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
