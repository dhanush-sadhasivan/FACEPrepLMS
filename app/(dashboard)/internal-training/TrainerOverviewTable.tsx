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

type TrainerSortField =
  | 'full_name'
  | 'team'
  | 'roadmap_title'
  | 'current_day'
  | 'solved_progress'
  | 'pending_questions_count'
  | 'it_days_count'
  | 'extended_days';

type SortDirection = 'asc' | 'desc' | null;

export default function TrainerOverviewTable({ onlineUserIds: propOnlineUserIds }: TrainerOverviewTableProps) {
  const globalPresence = useGlobalPresence();
  const onlineUserIds = propOnlineUserIds || globalPresence.onlineUserIds;

  const [trainers, setTrainers] = useState<ITTrainerOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roadmapFilter, setRoadmapFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'pending' | 'ontrack'>('all');

  // 3-state Sorting State (Normal -> Asc / A-Z -> Desc / Z-A -> Normal)
  const [sortField, setSortField] = useState<TrainerSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: TrainerSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      // 3rd click: Reset to normal default
      setSortField(null);
      setSortDirection(null);
    }
  };

  // Extension Modal State
  const [extendTarget, setExtendTarget] = useState<ITTrainerOverviewItem | null>(null);
  const [extraDays, setExtraDays] = useState(3);
  const [extending, setExtending] = useState(false);

  // Attendance Edit Modal State
  const [editAttendanceTarget, setEditAttendanceTarget] = useState<ITTrainerOverviewItem | null>(null);
  const [attendanceDaysInput, setAttendanceDaysInput] = useState<number>(0);
  const [updatingAttendance, setUpdatingAttendance] = useState(false);

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

  // Quick +1 IT Day handler
  const handleQuickAddAttendance = async (t: ITTrainerOverviewItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newTotal = (t.it_days_count || 0) + 1;
    // Optimistic UI update
    setTrainers((prev) =>
      prev.map((item) =>
        item.user_id === t.user_id ? { ...item, it_days_count: newTotal } : item
      )
    );
    showToast(`🎉 Added +1 IT Day for ${t.full_name}! (Total: ${newTotal} days)`);

    try {
      const res = await fetch('/api/internal-training/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: t.user_id, roadmapId: t.roadmap_id, action: 'increment' }),
      });
      if (!res.ok) {
        await loadOverview();
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
      await loadOverview();
    }
  };

  // Open Edit Attendance Modal
  const handleOpenEditAttendance = (t: ITTrainerOverviewItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditAttendanceTarget(t);
    setAttendanceDaysInput(t.it_days_count || 0);
  };

  // Confirm custom attendance count
  const handleConfirmEditAttendance = async () => {
    if (!editAttendanceTarget) return;
    setUpdatingAttendance(true);
    const targetVal = Math.max(0, Number(attendanceDaysInput) || 0);

    // Optimistic update
    setTrainers((prev) =>
      prev.map((item) =>
        item.user_id === editAttendanceTarget.user_id
          ? { ...item, it_days_count: targetVal }
          : item
      )
    );

    try {
      const res = await fetch('/api/internal-training/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editAttendanceTarget.user_id,
          roadmapId: editAttendanceTarget.roadmap_id,
          newCount: targetVal,
        }),
      });

      if (res.ok) {
        showToast(`✅ Set IT Days to ${targetVal} for ${editAttendanceTarget.full_name}!`);
        setEditAttendanceTarget(null);
      } else {
        const err = await res.json();
        showToast(`❌ Failed: ${err.error || 'Unknown error'}`);
        await loadOverview();
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
      await loadOverview();
    } finally {
      setUpdatingAttendance(false);
    }
  };

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
    const totalITDays = enrichedTrainers.reduce((sum, t) => sum + (t.it_days_count || 0), 0);
    const avgITDays = enrichedTrainers.length > 0 ? (totalITDays / enrichedTrainers.length).toFixed(1) : '0';
    return { all: enrichedTrainers.length, online, pending, ontrack, totalITDays, avgITDays };
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

  const sortedTrainers = useMemo(() => {
    if (!sortField || !sortDirection) return filteredTrainers;

    return [...filteredTrainers].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'full_name') {
        valA = (a.full_name || '').toLowerCase();
        valB = (b.full_name || '').toLowerCase();
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'team') {
        valA = (a.team || '').toLowerCase();
        valB = (b.team || '').toLowerCase();
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'roadmap_title') {
        valA = (a.roadmap_title || '').toLowerCase();
        valB = (b.roadmap_title || '').toLowerCase();
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'current_day') {
        valA = a.current_day || 0;
        valB = b.current_day || 0;
      }
      if (sortField === 'solved_progress') {
        valA = a.total_questions_count > 0 ? a.completed_questions_count / a.total_questions_count : 0;
        valB = b.total_questions_count > 0 ? b.completed_questions_count / b.total_questions_count : 0;
      }
      if (sortField === 'pending_questions_count') {
        valA = a.pending_questions_count || 0;
        valB = b.pending_questions_count || 0;
      }
      if (sortField === 'it_days_count') {
        valA = a.it_days_count || 0;
        valB = b.it_days_count || 0;
      }
      if (sortField === 'extended_days') {
        valA = a.extended_days || 0;
        valB = b.extended_days || 0;
      }

      if (sortDirection === 'asc') return valA > valB ? 1 : valA < valB ? -1 : 0;
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    });
  }, [filteredTrainers, sortField, sortDirection]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Reset to page 1 whenever filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roadmapFilter, statusFilter, sortField, sortDirection, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(sortedTrainers.length / (itemsPerPage === -1 ? sortedTrainers.length || 1 : itemsPerPage)));
  const paginatedTrainers = useMemo(() => {
    if (itemsPerPage === -1) return sortedTrainers;
    const start = (currentPage - 1) * itemsPerPage;
    return sortedTrainers.slice(start, start + itemsPerPage);
  }, [sortedTrainers, currentPage, itemsPerPage]);

  const renderSortHeader = (label: string, field: TrainerSortField, isSticky: boolean = false, style?: React.CSSProperties) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={isSticky ? 'it-sticky-col' : undefined}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'color 0.15s ease',
          color: isActive ? 'var(--accent)' : undefined,
          ...style,
        }}
        title={`Sort by ${label} (${isActive ? (sortDirection === 'asc' ? 'A-Z / Ascending' : 'Z-A / Descending') : 'Click to sort'})`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>{label}</span>
          <span style={{ fontSize: '0.75rem', opacity: isActive ? 1 : 0.4 }}>
            {isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </div>
      </th>
    );
  };

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

      {/* KPI Overview Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Enrolled</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{counts.all}</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>⚡ Active Online</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>{counts.online}</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>✓ On Track</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#6366f1', marginTop: '0.2rem' }}>{counts.ontrack}</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>⚠️ In Backlog</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem' }}>{counts.pending}</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>🎓 Avg IT Days</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>{counts.avgITDays} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>days</span></div>
        </div>
      </div>

      {/* ── Roadmap Segmented Tabs Bar ────────────────────────── */}
      <div className="it-roadmap-tabs-container">
        <button
          type="button"
          className={`it-roadmap-pill-btn ${roadmapFilter === 'All' ? 'active' : ''}`}
          onClick={() => setRoadmapFilter('All')}
        >
          <span>🗺️ All Roadmaps</span>
          <span className="it-roadmap-pill-count">{enrichedTrainers.length}</span>
        </button>
        {uniqueRoadmaps.map((rmTitle) => {
          const rmCount = enrichedTrainers.filter((t) => t.roadmap_title === rmTitle).length;
          return (
            <button
              key={rmTitle}
              type="button"
              className={`it-roadmap-pill-btn ${roadmapFilter === rmTitle ? 'active' : ''}`}
              onClick={() => setRoadmapFilter(rmTitle)}
            >
              <span>{rmTitle}</span>
              <span className="it-roadmap-pill-count">{rmCount}</span>
            </button>
          );
        })}
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
          <>
            <div className="it-table-scroll-container">
              <table className="it-table">
                <thead>
                  <tr>
                    {renderSortHeader('Trainer & Presence', 'full_name', true)}
                    {renderSortHeader('Team / Emp ID', 'team')}
                    {renderSortHeader('Roadmap', 'roadmap_title')}
                    {renderSortHeader('Current Day', 'current_day')}
                    {renderSortHeader('Solved Progress', 'solved_progress')}
                    {renderSortHeader('Backlog Status', 'pending_questions_count')}
                    {renderSortHeader('IT Attendance', 'it_days_count')}
                    {renderSortHeader('Extensions', 'extended_days')}
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrainers.map((t) => {
                    const compPct = t.total_questions_count > 0
                      ? Math.round((t.completed_questions_count / t.total_questions_count) * 100)
                      : 0;

                    return (
                      <tr key={`${t.user_id}_${t.roadmap_id}`}>
                        {/* Trainer Avatar & Info */}
                        <td className="it-sticky-col">
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

                      {/* IT Days Attendance with Quick Actions */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div
                            className="it-attendance-badge"
                            onClick={(e) => handleOpenEditAttendance(t, e)}
                            title="Click to edit IT attendance days"
                            style={{ cursor: 'pointer' }}
                          >
                            <span>🎓</span>
                            <span className="it-attendance-val">{t.it_days_count ?? 0}</span>
                            <span className="it-attendance-unit">days</span>
                          </div>

                          {/* Quick +1 Button */}
                          <button
                            type="button"
                            onClick={(e) => handleQuickAddAttendance(t, e)}
                            title="Add +1 IT Day for this trainer"
                            style={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#10b981',
                              borderRadius: '6px',
                              padding: '0.2rem 0.45rem',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.15rem',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)'}
                          >
                            +1
                          </button>

                          {/* Edit Custom Count Button */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditAttendance(t, e)}
                            title="Edit IT Days count"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '0.2rem',
                              fontSize: '0.75rem',
                              lineHeight: 1,
                            }}
                          >
                            ✏️
                          </button>
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

          {/* Pagination Bar */}
          {sortedTrainers.length > 0 && (
            <div className="it-pagination-bar">
              <div className="it-pagination-info">
                Showing{' '}
                <strong>
                  {itemsPerPage === -1
                    ? `1–${sortedTrainers.length}`
                    : `${Math.min((currentPage - 1) * itemsPerPage + 1, sortedTrainers.length)}–${Math.min(currentPage * itemsPerPage, sortedTrainers.length)}`}
                </strong>{' '}
                of <strong>{sortedTrainers.length}</strong> trainers
              </div>

              <div className="it-pagination-actions">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.75rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Per page:</span>
                  <select
                    className="it-page-select"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={-1}>All ({sortedTrainers.length})</option>
                  </select>
                </div>

                {itemsPerPage !== -1 && (
                  <>
                    <button
                      type="button"
                      className="it-page-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      ← Prev
                    </button>

                    <span style={{ fontWeight: 700, fontSize: '0.82rem', padding: '0 0.35rem' }}>
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      className="it-page-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
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

      {/* Edit Attendance Modal */}
      {editAttendanceTarget && (
        <div className="plan-modal-overlay" onClick={() => setEditAttendanceTarget(null)}>
          <div className="plan-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              🎓 Edit IT Attendance Days
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              Manually set the total Internal Training (IT) completed days for <strong>{editAttendanceTarget.full_name}</strong>.
            </p>

            <div className="day-field-group">
              <label>Total IT Days Completed</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAttendanceDaysInput(Math.max(0, attendanceDaysInput - 1))}
                  style={{ width: 38, height: 38, fontSize: '1.1rem', fontWeight: 800 }}
                >
                  −
                </button>
                <input
                  type="number"
                  min="0"
                  max="365"
                  className="day-input"
                  value={attendanceDaysInput}
                  onChange={(e) => setAttendanceDaysInput(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 800 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAttendanceDaysInput(attendanceDaysInput + 1)}
                  style={{ width: 38, height: 38, fontSize: '1.1rem', fontWeight: 800 }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditAttendanceTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmEditAttendance}
                disabled={updatingAttendance}
                style={{ fontWeight: 800 }}
              >
                {updatingAttendance ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
