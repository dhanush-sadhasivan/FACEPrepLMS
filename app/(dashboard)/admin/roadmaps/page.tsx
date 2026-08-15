'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './page.css';

export default function AdminRoadmapsPage() {
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoadmaps() {
      setLoading(true);
      const res = await fetch('/api/admin/roadmaps');
      if (res.ok) setRoadmaps(await res.json());
      setLoading(false);
    }
    loadRoadmaps();
  }, []);

  return (
    <div className="admin-roadmaps-page">
      {/* Header */}
      <header className="admin-roadmaps-header">
        <div>
          <h1 className="admin-roadmaps-title">Topic Roadmaps Manager</h1>
          <p className="admin-roadmaps-subtitle">
            Create and track topic roadmaps mapped to contests for trainers
          </p>
        </div>
        <Link href="/admin/roadmaps/new" className="btn btn-primary">
          + Create New Roadmap
        </Link>
      </header>

      {/* Roadmaps List */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="roadmap-spinner" style={{ margin: '0 auto 0.5rem' }} />
          Loading roadmaps…
        </div>
      ) : roadmaps.length === 0 ? (
        <div className="admin-roadmaps-empty">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
          <h3>No roadmaps created yet</h3>
          <p>Click &quot;+ Create New Roadmap&quot; to build your first contest-linked learning path.</p>
        </div>
      ) : (
        <div className="admin-roadmaps-grid">
          {roadmaps.map(rm => {
            const stats = rm.stats || { total_assigned: 0, completed: 0, in_progress: 0 };
            const topicsCount = rm.topics?.length || 0;

            return (
              <div key={rm.id} className="admin-roadmap-card">
                <div className="admin-roadmap-card-header">
                  <div>
                    <h3 className="admin-roadmap-card-title">{rm.title}</h3>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      <span className="admin-chip-domain">{rm.domain}</span>
                      <span className="admin-chip-level">{rm.level}</span>
                      {rm.contest_title && (
                        <span className="admin-chip-contest">🏆 {rm.contest_title}</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {topicsCount} topics
                  </span>
                </div>

                {rm.description && (
                  <p className="admin-roadmap-desc">{rm.description}</p>
                )}

                {/* Assignments & Completion Stats */}
                <div className="admin-roadmap-stats-row">
                  <div className="admin-stat-item">
                    <span className="admin-stat-val">{stats.total_assigned}</span>
                    <span className="admin-stat-lbl">Assigned</span>
                  </div>
                  <div className="admin-stat-item">
                    <span className="admin-stat-val" style={{ color: 'var(--accent)' }}>{stats.in_progress}</span>
                    <span className="admin-stat-lbl">In Progress</span>
                  </div>
                  <div className="admin-stat-item">
                    <span className="admin-stat-val" style={{ color: 'var(--success)' }}>{stats.completed}</span>
                    <span className="admin-stat-lbl">Completed</span>
                  </div>
                </div>

                {/* Target Groups & Action Footer */}
                <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {rm.assignments && rm.assignments.length > 0 ? (
                      <>
                        Assigned to:{' '}
                        {rm.assignments.map((a: any, idx: number) => (
                          <span key={a.id || idx} style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {a.group?.name || a.user?.full_name || 'Group'}
                            {idx < rm.assignments.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span>Unassigned</span>
                    )}
                  </div>
                  <Link href={`/admin/roadmaps/${rm.id}/edit`} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}>
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
