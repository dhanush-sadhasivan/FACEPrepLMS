'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import ManageTopicsModal from './ManageTopicsModal';

interface ContestCardData {
  id: string;
  title: string;
  hackerrank_slug: string;
  start_date: string;
  end_date: string;
  created_at: string;
  questions?: Array<{ count: number }>;
  assignments?: Array<{ group_id: string | null; team: string | null }>;
  assignedGroups?: string[];
  assignedTeams?: string[];
}

interface ContestListClientProps {
  initialContests: ContestCardData[];
  isAdminOrManager: boolean;
}

export default function ContestListClient({
  initialContests,
  isAdminOrManager,
}: ContestListClientProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [contests, setContests] = useState<ContestCardData[]>(initialContests);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'past' | 'duplicates'>('all');

  const [deleteTarget, setDeleteTarget] = useState<ContestCardData | null>(null);
  const [managingTopicsContest, setManagingTopicsContest] = useState<ContestCardData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate detection
  const duplicateSlugs = useMemo(() => {
    const slugCounts = new Map<string, number>();
    contests.forEach((c) => {
      const slug = (c.hackerrank_slug || '').toLowerCase().trim();
      if (slug) {
        slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);
      }
    });
    const dupes = new Set<string>();
    slugCounts.forEach((count, slug) => {
      if (count > 1) dupes.add(slug);
    });
    return dupes;
  }, [contests]);

  const now = new Date();
  const getStatus = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (now < start) return 'upcoming';
    if (now > end) return 'past';
    return 'active';
  };

  // Metrics
  const metrics = useMemo(() => {
    let active = 0;
    let upcoming = 0;
    let past = 0;
    contests.forEach((c) => {
      const st = getStatus(c.start_date, c.end_date);
      if (st === 'active') active++;
      else if (st === 'upcoming') upcoming++;
      else past++;
    });
    return { total: contests.length, active, upcoming, past };
  }, [contests]);

  // Filtered contests
  const filteredContests = useMemo(() => {
    return contests.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (c.title || '').toLowerCase().includes(q);
      const slugMatch = (c.hackerrank_slug || '').toLowerCase().includes(q);
      const teamMatch = (c.assignedTeams || []).some((t) => t.toLowerCase().includes(q));
      const groupMatch = (c.assignedGroups || []).some((g) => g.toLowerCase().includes(q));
      const matchesSearch = q === '' || titleMatch || slugMatch || teamMatch || groupMatch;

      const status = getStatus(c.start_date, c.end_date);
      const isDuplicate = duplicateSlugs.has((c.hackerrank_slug || '').toLowerCase().trim());

      if (!matchesSearch) return false;
      if (filterStatus === 'all') return true;
      if (filterStatus === 'duplicates') return isDuplicate;
      return status === filterStatus;
    });
  }, [contests, searchQuery, filterStatus, duplicateSlugs]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/contests/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showToast(`Contest "${deleteTarget.title}" deleted successfully.`, 'success');
        setContests((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
        router.refresh();
      } else {
        const data = await res.json();
        showToast(`Failed to delete contest: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('An error occurred while deleting the contest', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* Header & Main Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 0.15rem' }}>
            Contests Manager
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            {isAdminOrManager
              ? 'Manage HackerRank contests, group assignments, and question topic tags'
              : 'View and attempt your assigned competitive programming contests'}
          </p>
        </div>
        {isAdminOrManager && (
          <Link href="/contests/new" className="btn btn-primary">
            ➕ Create Contest
          </Link>
        )}
      </div>

      {/* Top Overview Stats Widgets */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>🏆</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{metrics.total}</div>
            <div className="stat-widget-label">Total Contests</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--success)' }}>🟢</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--success)' }}>{metrics.active}</div>
            <div className="stat-widget-label">Active Now</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: '#f59e0b' }}>⏰</div>
          <div>
            <div className="stat-widget-val" style={{ color: '#f59e0b' }}>{metrics.upcoming}</div>
            <div className="stat-widget-label">Upcoming</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>🏁</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{metrics.past}</div>
            <div className="stat-widget-label">Completed</div>
          </div>
        </div>
      </div>

      {/* Duplicate Alert Banner for Admins */}
      {isAdminOrManager && duplicateSlugs.size > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)', borderRadius: 10, padding: '0.65rem 0.95rem', margin: '0.85rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--warning)' }}>Duplicate Contests Detected:</strong>
              <span style={{ fontSize: '0.82rem', marginLeft: '0.4rem', color: 'var(--text-muted)' }}>
                {duplicateSlugs.size} contest slug(s) are duplicated ({Array.from(duplicateSlugs).join(', ')}).
              </span>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.78rem', color: 'var(--warning)', borderColor: 'var(--warning)' }}
            onClick={() => setFilterStatus(filterStatus === 'duplicates' ? 'all' : 'duplicates')}
          >
            {filterStatus === 'duplicates' ? 'Show All Contests' : 'Filter Duplicates Only'}
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="search-filter-bar">
        {/* Search input */}
        <div className="search-box-wrapper" style={{ maxWidth: 360 }}>
          <span className="search-box-icon">🔍</span>
          <input
            type="text"
            className="search-box-input"
            placeholder="Search contests by title, slug, or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="filter-pills">
          {(['all', 'active', 'upcoming', 'past'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`filter-pill ${filterStatus === st ? 'active' : ''}`}
            >
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
          {duplicateSlugs.size > 0 && (
            <button
              onClick={() => setFilterStatus(filterStatus === 'duplicates' ? 'all' : 'duplicates')}
              className={`filter-pill ${filterStatus === 'duplicates' ? 'active warning' : 'warning-outline'}`}
            >
              ⚠ Duplicates ({duplicateSlugs.size})
            </button>
          )}
        </div>
      </div>

      {/* Section Separator */}
      <div className="section-separator">
        <div className="separator-line" />
        <div className="separator-badge">
          <span>🏆</span> COMPETITIVE CONTESTS ({filteredContests.length})
        </div>
        <div className="separator-line" />
      </div>

      {/* Contests Grid */}
      {filteredContests.length === 0 ? (
        <div className="todos-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.35rem' }}>🏆</div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0.2rem 0', color: 'var(--text-primary)' }}>
            No contests found
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            {searchQuery
              ? `No matches for "${searchQuery}". Try adjusting your search keyword.`
              : 'Click "+ Create Contest" above to add your first contest.'}
          </p>
        </div>
      ) : (
        <div className="contest-grid">
          {filteredContests.map((contest) => {
            const status = getStatus(contest.start_date, contest.end_date);
            const statusClass = status === 'active' ? 'badge-success' : status === 'upcoming' ? 'badge-warning' : 'badge-muted';
            const isDuplicate = duplicateSlugs.has((contest.hackerrank_slug || '').toLowerCase().trim());
            const questionCount = contest.questions?.[0]?.count || 0;

            return (
              <div
                key={contest.id}
                className="contest-card"
                style={{
                  border: isDuplicate ? '1px solid var(--warning)' : undefined,
                  boxShadow: isDuplicate ? '0 0 12px rgba(245,158,11,0.15)' : undefined,
                }}
              >
                <div>
                  {/* Header Row */}
                  <div className="contest-card-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/contests/${contest.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <h3 className="contest-card-title">
                          {contest.title}
                        </h3>
                      </Link>
                      <code className="contest-slug-code">
                        ⚡ {contest.hackerrank_slug}
                      </code>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                      <span className={`badge ${statusClass}`} style={{ fontSize: '0.7rem', fontWeight: 800 }}>{status.toUpperCase()}</span>
                      {isDuplicate && (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>DUPLICATE</span>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="contest-meta-list">
                    <div className="contest-meta-row">🗓️ Starts: <strong>{new Date(contest.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
                    <div className="contest-meta-row">⏳ Ends: <strong>{new Date(contest.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
                    <div className="contest-meta-row">💡 Questions: <strong style={{ color: 'var(--text-primary)' }}>{questionCount}</strong></div>

                    {/* Group & Team badges */}
                    {isAdminOrManager && (
                      <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {(contest.assignedTeams || []).map((t) => (
                          <span key={t} style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--indigo)', border: '1px solid rgba(99,102,241,0.3)', padding: '0.12rem 0.45rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700 }}>
                            Team: {t}
                          </span>
                        ))}
                        {(contest.assignedGroups || []).map((g) => (
                          <span key={g} style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)', padding: '0.12rem 0.45rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700 }}>
                            Group: {g}
                          </span>
                        ))}
                        {(!contest.assignedTeams || contest.assignedTeams.length === 0) &&
                         (!contest.assignedGroups || contest.assignedGroups.length === 0) && (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.72rem' }}>Unassigned</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div className="contest-actions-footer">
                  <Link href={`/contests/${contest.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem' }}>
                    📊 View Details
                  </Link>

                  {isAdminOrManager && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Manage Question Categories"
                        onClick={() => setManagingTopicsContest(contest)}
                        style={{ fontSize: '0.78rem' }}
                      >
                        🏷️ Categories
                      </button>
                      <Link href={`/contests/${contest.id}/edit`} className="btn btn-ghost btn-sm" title="Edit & Manage Assignments" style={{ fontSize: '0.82rem' }}>
                        ⚙️
                      </Link>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Delete Contest"
                        onClick={() => setDeleteTarget(contest)}
                        style={{ color: '#ef4444', fontSize: '0.82rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, maxWidth: 420, width: '100%', padding: '1.35rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>⚠️ Delete Contest?</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: '0 0 1.15rem' }}>
              Are you sure you want to delete <strong>&quot;{deleteTarget.title}&quot;</strong>? This will remove all contest assignments and question associations.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="btn" style={{ background: '#ef4444', color: '#fff' }} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Contest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Question Topics Modal */}
      {managingTopicsContest && (
        <ManageTopicsModal
          contestId={managingTopicsContest.id}
          contestTitle={managingTopicsContest.title}
          onClose={() => setManagingTopicsContest(null)}
        />
      )}
    </div>
  );
}
