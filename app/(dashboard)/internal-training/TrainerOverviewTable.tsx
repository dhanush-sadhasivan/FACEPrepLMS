'use client';

import { useState, useEffect, useMemo } from 'react';
import { ITTrainerOverviewItem } from '@/lib/types';
import { useGlobalPresence } from '@/components/PresenceProvider';

interface TrainerOverviewTableProps {
  onlineUserIds?: Set<string>;
}

function getInitials(name?: string | null): string {
  if (!name) return 'TR';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

// Generate deterministic avatar gradient from string
function getAvatarGradient(name: string): string {
  const gradients = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export default function TrainerOverviewTable({ onlineUserIds: propOnlineUserIds }: TrainerOverviewTableProps) {
  const globalPresence = useGlobalPresence();
  const onlineUserIds = propOnlineUserIds || globalPresence.onlineUserIds;

  const [trainers, setTrainers] = useState<ITTrainerOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roadmapFilter, setRoadmapFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'pending' | 'ontrack'>('all');

  // Extension Modal State
  const [extendTarget, setExtendTarget] = useState<ITTrainerOverviewItem | null>(null);
  const [extraDays, setExtraDays] = useState(3);
  const [extending, setExtending] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/internal-training/trainer-overview');
      if (res.ok) {
        const data = await res.json();
        setTrainers(data.trainers || []);
      }
    } catch (err) {
      console.error('Error loading trainer overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  // Filtered trainers list with online status attached
  const enrichedTrainers = useMemo(() => {
    return trainers.map((t) => ({
      ...t,
      is_online:
        onlineUserIds.has(t.user_id) ||
        onlineUserIds.has(String(t.user_id).toLowerCase().trim()),
    }));
  }, [trainers, onlineUserIds]);

  const uniqueRoadmaps = useMemo(() => {
    const set = new Set<string>();
    trainers.forEach((t) => {
      if (t.roadmap_title) set.add(t.roadmap_title);
    });
    return Array.from(set);
  }, [trainers]);

  const counts = useMemo(() => {
    const online = enrichedTrainers.filter((t) => t.is_online).length;
    const pending = enrichedTrainers.filter((t) => t.pending_questions_count > 0).length;
    const ontrack = enrichedTrainers.filter((t) => t.pending_questions_count === 0).length;
    return { all: enrichedTrainers.length, online, pending, ontrack };
  }, [enrichedTrainers]);

  const filteredTrainers = useMemo(() => {
    return enrichedTrainers.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.full_name.toLowerCase().includes(q) ||
        t.emp_id.toLowerCase().includes(q) ||
        t.team.toLowerCase().includes(q) ||
        t.roadmap_title.toLowerCase().includes(q) ||
        (t.email && t.email.toLowerCase().includes(q));

      const matchesRoadmap = roadmapFilter === 'All' || t.roadmap_title === roadmapFilter;

      let matchesStatus = true;
      if (statusFilter === 'online') matchesStatus = t.is_online;
      if (statusFilter === 'pending') matchesStatus = t.pending_questions_count > 0;
      if (statusFilter === 'ontrack') matchesStatus = t.pending_questions_count === 0;

      return matchesSearch && matchesRoadmap && matchesStatus;
    });
  }, [enrichedTrainers, search, roadmapFilter, statusFilter]);

  const handleOpenExtend = (t: ITTrainerOverviewItem) => {
    setExtendTarget(t);
    setExtraDays(3);
  };

  const handleConfirmExtend = async () => {
    if (!extendTarget) return;
    setExtending(true);
    try {
      const res = await fetch('/api/internal-training/extension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: extendTarget.user_id,
          roadmapId: extendTarget.roadmap_id,
          extraDays: Number(extraDays),
        }),
      });

      if (res.ok) {
        showToast(`🎉 Granted +${extraDays} extra days to ${extendTarget.full_name}!`);
        setExtendTarget(null);
        await loadOverview();
      } else {
        const err = await res.json();
        showToast(`❌ Failed: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      showToast(`❌ Error: ${e.message}`);
    } finally {
      setExtending(false);
    }
  };

  const hasActiveFilters = search.length > 0 || roadmapFilter !== 'All' || statusFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setRoadmapFilter('All');
    setStatusFilter('all');
  };

  return (
    <div className="trainer-overview-section">
      {/* Toast */}
      {toastMsg && (
        <div className="it-toast">
          {toastMsg}
        </div>
      )}

      {/* Section Header */}
      <div className="it-cohort-header">
        <div className="it-cohort-title-area">
          <div className="it-cohort-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div>
            <h3 className="it-cohort-title">
              Trainer Cohort Realtime Progress &amp; Presence
            </h3>
            <p className="it-cohort-subtitle">
              Live visibility into trainer roadmap progress, IT day attendance, pending backlogs, and active online presence.
            </p>
          </div>
        </div>

        <div className="it-cohort-actions">
          <div className="it-presence-badge">
            <span className="it-presence-pulse" />
            <span className="it-presence-text">
              {counts.online} {counts.online === 1 ? 'Trainer Online' : 'Trainers Online'}
            </span>
          </div>

          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="it-refresh-btn"
            title="Refresh Cohort Data"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'it-spin' : ''}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="it-controls-bar">
        {/* Search Input */}
        <div className="it-search-wrapper">
          <svg className="it-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="it-search-input"
            placeholder="Search trainer name, emp ID, team, roadmap..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="it-search-clear"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Roadmap Dropdown Select */}
        <div className="it-select-wrapper">
          <svg className="it-select-icon-left" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <select
            className="it-select-input"
            value={roadmapFilter}
            onChange={(e) => setRoadmapFilter(e.target.value)}
          >
            <option value="All">All IT Roadmaps ({uniqueRoadmaps.length})</option>
            {uniqueRoadmaps.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <svg className="it-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        {/* Status Filter Tabs */}
        <div className="it-filter-tabs">
          <button
            type="button"
            className={`it-filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span>All</span>
            <span className="it-filter-tab-count">{counts.all}</span>
          </button>

          <button
            type="button"
            className={`it-filter-tab ${statusFilter === 'online' ? 'active' : ''}`}
            onClick={() => setStatusFilter('online')}
          >
            <span className="it-status-dot online" />
            <span>Online</span>
            <span className="it-filter-tab-count">{counts.online}</span>
          </button>

          <button
            type="button"
            className={`it-filter-tab ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <span className="it-status-dot pending" />
            <span>Backlog</span>
            <span className="it-filter-tab-count">{counts.pending}</span>
          </button>

          <button
            type="button"
            className={`it-filter-tab ${statusFilter === 'ontrack' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ontrack')}
          >
            <span className="it-status-dot ontrack" />
            <span>On Track</span>
            <span className="it-filter-tab-count">{counts.ontrack}</span>
          </button>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="it-reset-filter-btn"
            onClick={resetFilters}
            title="Reset all filters"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table Card */}
      <div className="it-table-card">
        {loading ? (
          <div className="it-table-loading">
            <div className="roadmap-spinner" />
            <p>Loading trainer cohort analytics…</p>
          </div>
        ) : filteredTrainers.length === 0 ? (
          <div className="it-table-empty">
            <div className="it-empty-icon">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <h4>No Trainers Found</h4>
            <p>
              {hasActiveFilters
                ? 'No trainers matched your search query or filters.'
                : 'No trainers have been assigned to internal training roadmaps yet.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={resetFilters}
                style={{ marginTop: '0.75rem', fontWeight: 700 }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="it-table-responsive">
            <table className="it-table">
              <thead>
                <tr>
                  <th>Trainer &amp; Presence</th>
                  <th>Team / Emp ID</th>
                  <th>Roadmap</th>
                  <th>Current Day</th>
                  <th>Solved Progress</th>
                  <th>Backlog Status</th>
                  <th>IT Attendance</th>
                  <th>Extensions</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrainers.map((t) => {
                  const compPct = t.total_questions_count > 0
                    ? Math.round((t.completed_questions_count / t.total_questions_count) * 100)
                    : 0;

                  return (
                    <tr key={`${t.user_id}_${t.roadmap_id}`}>
                      {/* Trainer Avatar & Info */}
                      <td>
                        <div className="it-trainer-cell">
                          <div className="it-avatar-wrap">
                            <div
                              className="it-avatar"
                              style={{ background: getAvatarGradient(t.full_name) }}
                            >
                              {getInitials(t.full_name)}
                            </div>
                            <span
                              className={`it-avatar-dot ${t.is_online ? 'online' : 'offline'}`}
                              title={t.is_online ? 'Online in platform' : 'Offline'}
                            />
                          </div>

                          <div className="it-trainer-meta">
                            <div className="it-trainer-name">
                              {t.full_name}
                            </div>
                            <div className="it-trainer-status-line">
                              {t.is_online ? (
                                <span className="it-online-label">
                                  <span className="it-mini-pulse" /> Active now
                                </span>
                              ) : (
                                <span className="it-offline-label">Offline</span>
                              )}
                              {t.email && (
                                <span className="it-trainer-email">· {t.email}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Team / Emp ID */}
                      <td>
                        <div className="it-team-badge">
                          {t.team || 'General'}
                        </div>
                        <div className="it-emp-id-text">
                          {t.emp_id || '—'}
                        </div>
                      </td>

                      {/* Roadmap */}
                      <td>
                        <div className="it-roadmap-pill">
                          <span>🗺️</span>
                          <span className="it-roadmap-pill-title">{t.roadmap_title}</span>
                        </div>
                      </td>

                      {/* Current Day */}
                      <td>
                        <div className="it-day-cell">
                          <span className="it-day-num">Day {t.current_day}</span>
                          <span className="it-day-total">of {t.total_days}</span>
                        </div>
                      </td>

                      {/* Solved Progress */}
                      <td>
                        <div className="it-progress-wrap">
                          <div className="it-progress-info">
                            <span className="it-progress-count">
                              {t.completed_questions_count} / {t.total_questions_count}
                            </span>
                            <span className={`it-progress-percent ${compPct === 100 ? 'done' : ''}`}>
                              {compPct}%
                            </span>
                          </div>
                          <div className="it-progress-bar-bg">
                            <div
                              className={`it-progress-bar-fill ${compPct === 100 ? 'done' : ''}`}
                              style={{ width: `${Math.min(100, Math.max(0, compPct))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Backlog Status */}
                      <td>
                        {t.pending_questions_count > 0 ? (
                          <div className="it-badge-pending">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                              <line x1="12" y1="9" x2="12" y2="13"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>{t.pending_questions_count} Pending</span>
                          </div>
                        ) : (
                          <div className="it-badge-ontrack">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>On Track</span>
                          </div>
                        )}
                      </td>

                      {/* IT Days Attendance */}
                      <td>
                        <div className="it-attendance-badge">
                          <span>🎓</span>
                          <span className="it-attendance-val">{t.it_days_count}</span>
                          <span className="it-attendance-unit">days</span>
                        </div>
                      </td>

                      {/* Extended Days */}
                      <td>
                        {t.extended_days > 0 ? (
                          <div className="it-extended-badge" title={`${t.extension_count} extension(s) granted`}>
                            <span>+{t.extended_days}d</span>
                            <span className="it-ext-count">({t.extension_count}x)</span>
                          </div>
                        ) : (
                          <span className="it-no-ext">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenExtend(t)}
                          className="it-action-extend-btn"
                          title="Extend training roadmap duration for this trainer"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          <span>Extend</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Extension Modal */}
      {extendTarget && (
        <div className="plan-modal-overlay" onClick={() => setExtendTarget(null)}>
          <div className="plan-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              ⏳ Extend Training Duration
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              Grant additional calendar days for <strong>{extendTarget.full_name}</strong> on roadmap <strong>&quot;{extendTarget.roadmap_title}&quot;</strong> to complete lagging questions.
            </p>

            <div className="day-field-group">
              <label>Additional Days to Grant</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {[1, 2, 3, 5, 7].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`weekday-btn ${extraDays === num ? 'active' : ''}`}
                    onClick={() => setExtraDays(num)}
                  >
                    +{num} Days
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="60"
                className="day-input"
                value={extraDays}
                onChange={(e) => setExtraDays(parseInt(e.target.value) || 1)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setExtendTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmExtend}
                disabled={extending}
                style={{ fontWeight: 800 }}
              >
                {extending ? 'Granting…' : `Grant +${extraDays} Days`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
