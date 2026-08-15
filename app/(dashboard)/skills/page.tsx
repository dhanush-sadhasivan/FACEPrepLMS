'use client';

import { useState, useEffect, useCallback } from 'react';
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
      <header className="courses-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="courses-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🏆</span> My Skills &amp; Badges
          </h1>
          <p className="courses-subtitle">
            Complete 100% of all problems in any topic (e.g. Linked List: 20/20) or Contest to earn badges automatically!
          </p>
        </div>

        {/* Stats Header Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', padding: '0.5rem 0.85rem', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>{earnedBadges.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Earned Badges</div>
          </div>
          <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', padding: '0.5rem 0.85rem', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#6366f1' }}>{skillsData?.totalSolved || 0}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Solved Questions</div>
          </div>
        </div>
      </header>

      {/* ── Main Section Tabs ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', marginBottom: '1.75rem' }}>
        <button
          onClick={() => setActiveMainTab('badges')}
          className={`btn ${activeMainTab === 'badges' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>🏆</span> Earned Badges ({earnedBadges.length})
        </button>

        <button
          onClick={() => setActiveMainTab('courses')}
          className={`btn ${activeMainTab === 'courses' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>📚</span> Assigned Courses ({assignments.length})
        </button>
      </div>

      {/* ── TAB 1: SKILLS & BADGES VIEW ──────────────────────────────────────── */}
      {activeMainTab === 'badges' && (
        <div>
          {/* Badge Category Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {(['all', 'topic', 'contest'] as BadgeFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setBadgeFilter(f)}
                className={`courses-level-tab ${badgeFilter === f ? 'active' : ''}`}
                style={{ textTransform: 'capitalize', fontWeight: 600 }}
              >
                {f === 'all' && `🏆 All Earned Badges (${earnedBadges.length})`}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
              {filteredEarnedBadges.map(b => (
                <div
                  key={b.id}
                  style={{
                    background: 'var(--surface)', border: '1.5px solid var(--accent)',
                    borderRadius: '16px', padding: '1.25rem', display: 'flex',
                    flexDirection: 'column', justifyContent: 'space-between',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: '0 10px 25px rgba(99, 102, 241, 0.15)',
                  }}
                >
                  {/* Glowing completion ribbon */}
                  <div style={{
                    position: 'absolute', top: 12, right: -28, background: 'linear-gradient(135deg, #f59e0b, #eab308)',
                    color: '#000', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase',
                    padding: '0.15rem 1.8rem', transform: 'rotate(45deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}>
                    EARNED
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.85rem' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '12px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.6rem', border: '1px solid rgba(245, 158, 11, 0.4)',
                      }}>
                        {b.badgeIcon}
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🏆 {b.badgeCategory}
                        </span>
                        <h3 style={{ margin: '0.1rem 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {b.title}
                        </h3>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                        <span>Completion Progress</span>
                        <span style={{ color: 'var(--success)', fontWeight: 800 }}>
                          {b.solved} / {b.total} Solved (100%)
                        </span>
                      </div>
                      <div style={{ height: '8px', width: '100%', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '999px' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      🏆 Badge Earned (100%)
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {b.type === 'topic' ? 'Topic Mastered' : 'Full Contest Champion'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── IN-PROGRESS TOPIC PROGRESS TRACKER ──────────────────────────────── */}
          {inProgressTopics.length > 0 && (
            <div style={{ marginTop: '2.5rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚡</span> Active Progress Towards Next Badges
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
                Solve the remaining problems in these topics to unlock your official 100% skill badges!
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                {inProgressTopics.map((t: any) => (
                  <div
                    key={t.id}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.3rem' }}>{t.badgeIcon}</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700 }}>
                          Need {t.total - t.solved} more solved to earn badge
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                        <span>Progress</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{t.solved} / {t.total} ({t.pct}%)</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
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
                    {lv === 'all' ? 'All Levels' : lv}
                    <span className="courses-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="courses-search-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="courses-search-icon">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  className="courses-search"
                  placeholder="Search courses…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {allCategories.length > 1 && (
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="courses-select">
                  <option value="all">All Categories</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Courses Grid + Detail */}
          {coursesLoading ? (
            <div className="courses-loading">
              <div className="courses-spinner" />
              <span>Loading your assigned courses…</span>
            </div>
          ) : (
            <div className={`courses-layout ${selectedAssignment ? 'has-detail' : ''}`}>
              <div className="courses-grid">
                {filteredCourses.length === 0 ? (
                  <div className="courses-empty">
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📚</div>
                    <h3>{search ? 'No courses matched your search.' : 'No courses found.'}</h3>
                    <p>{search ? 'Try different keywords.' : 'No courses have been assigned to you yet.'}</p>
                  </div>
                ) : (
                  filteredCourses.map(assignment => {
                    const course = assignment.course!;
                    const lc = LEVEL_CONFIG[course.level] || LEVEL_CONFIG.Beginner;
                    const icon = CATEGORY_ICONS[course.category] || '📚';
                    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
                    const isOverdue = dueDate && dueDate < new Date();
                    const isSelected = selectedAssignment?.id === assignment.id;
                    const stats = getCourseSubtopicStats(course);

                    return (
                      <div
                        key={assignment.id}
                        className={`course-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedAssignment(isSelected ? null : assignment)}
                      >
                        <div className="course-card-top" style={{ background: lc.bg, borderBottom: `2px solid ${lc.color}` }}>
                          <span className="course-card-icon">{icon}</span>
                          <span className={`course-status-badge ${stats.status}`}>
                            {stats.status === 'completed' ? '✅ Completed' : stats.status === 'in_progress' ? '⚡ In Progress' : '⏳ Not Started'}
                          </span>
                        </div>

                        <div className="course-card-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <h3 className="course-card-title">{course.title}</h3>
                            <span className="course-level-badge" style={{ color: lc.color, background: lc.bg }}>
                              {course.level}
                            </span>
                          </div>

                          {course.description && (
                            <p className="course-card-desc">{course.description}</p>
                          )}

                          <div className="course-card-progress">
                            <div className="course-progress-header">
                              <span className="course-progress-lbl">Progress</span>
                              <span className="course-progress-pct">{stats.completed}/{stats.total} Topics ({stats.pct}%)</span>
                            </div>
                            <div className="course-progress-bar-bg">
                              <div
                                className={`course-progress-bar-fill ${stats.status === 'completed' ? 'completed' : ''}`}
                                style={{ width: `${stats.pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="course-card-meta">
                            <span className="course-meta-chip">📂 {course.category}</span>
                            <span className="course-meta-chip">🗓️ {course.duration_weeks}w</span>
                            {dueDate && (
                              <span className="course-meta-chip" style={{ color: isOverdue ? 'var(--error)' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
                                {isOverdue ? '⚠️' : '📅'} Due {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>

                          {course.syllabus && course.syllabus.length > 0 && (
                            <div className="course-card-footer">
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {course.syllabus.length} week modules
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                                View Syllabus →
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Course Detail View */}
              {selectedAssignment && selectedAssignment.course && (
                <div className="course-detail">
                  {(() => {
                    const course = selectedAssignment.course!;
                    const lc = LEVEL_CONFIG[course.level] || LEVEL_CONFIG.Beginner;
                    const icon = CATEGORY_ICONS[course.category] || '📚';
                    const dueDate = selectedAssignment.due_date ? new Date(selectedAssignment.due_date) : null;
                    const isOverdue = dueDate && dueDate < new Date();
                    const stats = getCourseSubtopicStats(course);

                    return (
                      <>
                        <div className="course-detail-header">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '2rem' }}>{icon}</span>
                            <button className="course-detail-close" onClick={() => setSelectedAssignment(null)}>✕</button>
                          </div>
                          <h2 className="course-detail-title">{course.title}</h2>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: lc.bg, color: lc.color, fontWeight: 700 }}>
                              {course.level}
                            </span>
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'var(--surface-3)', color: 'var(--text-muted)', fontWeight: 600 }}>
                              📂 {course.category}
                            </span>
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'var(--surface-3)', color: 'var(--text-muted)', fontWeight: 600 }}>
                              🗓️ {course.duration_weeks} weeks
                            </span>
                          </div>

                          {dueDate && (
                            <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.9rem', background: isOverdue ? 'var(--error-muted)' : 'var(--surface-3)', borderRadius: 'var(--radius-sm)', fontSize: '0.83rem', color: isOverdue ? 'var(--error)' : 'var(--text-muted)', fontWeight: 600 }}>
                              {isOverdue ? '⚠️ Overdue · ' : '📅 Due '} {dueDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                          )}

                          {course.description && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.6 }}>{course.description}</p>
                          )}
                        </div>

                        <div className="course-detail-syllabus">
                          <div className="syllabus-progress-card">
                            <div className="syllabus-progress-top">
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Subtopic Completion Tracker</span>
                              <span style={{ fontWeight: 800, color: stats.status === 'completed' ? 'var(--success)' : 'var(--accent)' }}>
                                {stats.completed} / {stats.total} ({stats.pct}%)
                              </span>
                            </div>
                            <div className="course-progress-bar-bg" style={{ height: '8px' }}>
                              <div
                                className={`course-progress-bar-fill ${stats.status === 'completed' ? 'completed' : ''}`}
                                style={{ width: `${stats.pct}%` }}
                              />
                            </div>
                          </div>

                          {stats.status === 'completed' && (
                            <div className="course-completed-banner">
                              <span>🎉</span>
                              <span>Course Completed! All subtopics have been checked off.</span>
                            </div>
                          )}

                          <h3 className="course-syllabus-heading">Weekly Syllabus &amp; Subtopics</h3>
                          {(!course.syllabus || course.syllabus.length === 0) ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No syllabus defined for this course yet.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                              {course.syllabus.map((week, idx) => (
                                <div key={idx} className="course-week-item">
                                  <div className="course-week-label" style={{ background: lc.bg, color: lc.color }}>
                                    Week {week.week}
                                  </div>
                                  <div className="course-week-body">
                                    <div className="course-week-topics">
                                      {(week.topics || []).map((topic, ti) => {
                                        const topicKey = `${course.id}___${topic}`;
                                        const isChecked = completedSubtopicKeys.includes(topicKey);

                                        return (
                                          <label key={ti} className={`syllabus-topic-checkbox-label ${isChecked ? 'completed' : ''}`}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => toggleSubtopicCompletion(course.id, topic)}
                                            />
                                            <span>{topic}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    {week.resources && week.resources.length > 0 && (
                                      <div className="course-week-resources">
                                        {week.resources.map((r, ri) => (
                                          <span key={ri} className="course-resource-chip">📎 {r}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
