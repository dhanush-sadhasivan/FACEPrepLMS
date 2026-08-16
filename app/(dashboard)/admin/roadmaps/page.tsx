'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import './page.css';

export default function AdminRoadmapsPage() {
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('All');

  useEffect(() => {
    async function loadRoadmaps() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/roadmaps');
        if (res.ok) setRoadmaps(await res.json());
      } catch (err) {
        console.error('Error loading roadmaps:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRoadmaps();
  }, []);

  // Calculate Overview Metrics
  const metrics = useMemo(() => {
    const total = roadmaps.length;
    const contestLinked = roadmaps.filter((r) => Boolean(r.contest_id)).length;
    const totalAssigned = roadmaps.reduce((acc, r) => acc + (r.stats?.total_assigned || 0), 0);
    const totalCompleted = roadmaps.reduce((acc, r) => acc + (r.stats?.completed || 0), 0);
    return { total, contestLinked, totalAssigned, totalCompleted };
  }, [roadmaps]);

  // Unique Domains for Filter Tabs
  const domains = useMemo(() => {
    const set = new Set<string>();
    roadmaps.forEach((r) => {
      if (r.domain) set.add(r.domain);
    });
    return Array.from(set);
  }, [roadmaps]);

  // Filtered Roadmaps
  const filteredRoadmaps = useMemo(() => {
    return roadmaps.filter((rm) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rm.title?.toLowerCase().includes(q) ||
        rm.description?.toLowerCase().includes(q) ||
        rm.domain?.toLowerCase().includes(q) ||
        rm.contest_title?.toLowerCase().includes(q);

      const matchesDomain = domainFilter === 'All' || rm.domain?.toLowerCase() === domainFilter.toLowerCase();

      return matchesSearch && matchesDomain;
    });
  }, [roadmaps, search, domainFilter]);

  return (
    <div className="admin-roadmaps-page">
      {/* Header */}
      <header className="admin-roadmaps-header">
        <div>
          <h1 className="admin-roadmaps-title">Topic Roadmaps Manager</h1>
          <p className="admin-roadmaps-subtitle">
            Build, manage, and track contest-linked learning paths for trainer cohorts.
          </p>
        </div>
        <Link href="/admin/roadmaps/new" className="btn btn-primary">
          ➕ Create New Roadmap
        </Link>
      </header>

      {/* Top Overview Stats Widgets */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>🗺️</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{metrics.total}</div>
            <div className="stat-widget-label">Total Roadmaps</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>🏆</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{metrics.contestLinked}</div>
            <div className="stat-widget-label">Contest Linked</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--text-primary)' }}>👥</div>
          <div>
            <div className="stat-widget-val">{metrics.totalAssigned}</div>
            <div className="stat-widget-label">Total Assigned</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--success)' }}>✅</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--success)' }}>{metrics.totalCompleted}</div>
            <div className="stat-widget-label">Completions</div>
          </div>
        </div>
      </div>

      {/* Controls Bar & Domain Filter Tabs */}
      <div className="roadmap-controls-bar">
        <div className="domain-filter-tabs">
          <button
            className={`domain-tab-btn ${domainFilter === 'All' ? 'active' : ''}`}
            onClick={() => setDomainFilter('All')}
          >
            All Domains <span className="tab-count-pill">{roadmaps.length}</span>
          </button>
          {domains.map((dom) => {
            const count = roadmaps.filter((r) => r.domain?.toLowerCase() === dom.toLowerCase()).length;
            return (
              <button
                key={dom}
                className={`domain-tab-btn ${domainFilter.toLowerCase() === dom.toLowerCase() ? 'active' : ''}`}
                onClick={() => setDomainFilter(dom)}
              >
                {dom} <span className="tab-count-pill">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="search-box-wrapper" style={{ maxWidth: 340 }}>
          <span className="search-box-icon">🔍</span>
          <input
            type="text"
            className="search-box-input"
            placeholder="Search roadmaps, contest, domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Section Separator */}
      <div className="section-separator">
        <div className="separator-line" />
        <div className="separator-badge">
          <span>🗺️</span> ACTIVE TOPIC ROADMAPS ({filteredRoadmaps.length})
        </div>
        <div className="separator-line" />
      </div>

      {/* Roadmaps Grid */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="roadmap-spinner" style={{ margin: '0 auto 0.75rem' }} />
          Loading roadmaps data…
        </div>
      ) : filteredRoadmaps.length === 0 ? (
        <div className="admin-roadmaps-empty">
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🗺️</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--text-primary)' }}>
            No roadmaps found
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {search
              ? `No matches for "${search}". Try adjusting your search query.`
              : 'Click "+ Create New Roadmap" above to build your first contest-linked learning path.'}
          </p>
        </div>
      ) : (
        <div className="admin-roadmaps-grid">
          {filteredRoadmaps.map((rm) => {
            const stats = rm.stats || { total_assigned: 0, completed: 0, in_progress: 0 };
            const topicsCount = rm.topics?.length || 0;
            const completionPct =
              stats.total_assigned > 0
                ? Math.round((stats.completed / stats.total_assigned) * 100)
                : 0;

            return (
              <div key={rm.id} className="admin-roadmap-card">
                <div className="admin-roadmap-card-header">
                  <div>
                    <h3 className="admin-roadmap-card-title">{rm.title}</h3>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      <span className="admin-chip-domain">{rm.domain || 'General'}</span>
                      <span className="admin-chip-level">{rm.level || 'Beginner'}</span>
                      {rm.contest_title && (
                        <span className="admin-chip-contest">🏆 {rm.contest_title}</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    📖 {topicsCount} {topicsCount === 1 ? 'Topic' : 'Topics'}
                  </span>
                </div>

                {rm.description && <p className="admin-roadmap-desc">{rm.description}</p>}

                {/* Progress Bar */}
                {stats.total_assigned > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                      <span>Overall Progress</span>
                      <span style={{ color: 'var(--success)' }}>{completionPct}% Completed</span>
                    </div>
                    <div className="rm-progress-bar-track">
                      <div className="rm-progress-bar-fill" style={{ width: `${completionPct}%` }} />
                    </div>
                  </div>
                )}

                {/* Stats Row */}
                <div className="admin-roadmap-stats-row">
                  <div className="admin-stat-item">
                    <span className="admin-stat-val">{stats.total_assigned}</span>
                    <span className="admin-stat-lbl">Assigned</span>
                  </div>
                  <div className="admin-stat-item">
                    <span className="admin-stat-val" style={{ color: 'var(--accent)' }}>
                      {stats.in_progress}
                    </span>
                    <span className="admin-stat-lbl">In Progress</span>
                  </div>
                  <div className="admin-stat-item">
                    <span className="admin-stat-val" style={{ color: 'var(--success)' }}>
                      {stats.completed}
                    </span>
                    <span className="admin-stat-lbl">Completed</span>
                  </div>
                </div>

                {/* Footer: Target Groups & Actions */}
                <div
                  style={{
                    marginTop: '0.85rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {rm.assignments && rm.assignments.length > 0 ? (
                      <>
                        🎯 Target:{' '}
                        {rm.assignments.map((a: any, idx: number) => (
                          <span key={a.id || idx} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {a.group?.name || a.user?.full_name || 'Group'}
                            {idx < rm.assignments.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span style={{ fontStyle: 'italic' }}>Unassigned</span>
                    )}
                  </div>

                  <Link href={`/admin/roadmaps/${rm.id}/edit`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem' }}>
                    ✏️ Edit Roadmap
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
