'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Contests</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {isAdminOrManager
              ? 'Manage HackerRank contests, group assignments, and trainer completion leaderboards'
              : 'View and attempt your assigned contests'}
          </p>
        </div>
        {isAdminOrManager && (
          <Link href="/contests/new" className="btn btn-primary">
            + Create Contest
          </Link>
        )}
      </div>

      {/* Duplicate Alert Banner for Admins */}
      {isAdminOrManager && duplicateSlugs.size > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)', borderRadius: 10, padding: '0.85rem 1.15rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--warning)' }}>Duplicate Contests Detected:</strong>
              <span style={{ fontSize: '0.88rem', marginLeft: '0.4rem', color: 'var(--text-muted)' }}>
                {duplicateSlugs.size} contest slug(s) are duplicated ({Array.from(duplicateSlugs).join(', ')}).
              </span>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.8rem', color: 'var(--warning)', borderColor: 'var(--warning)' }}
            onClick={() => setFilterStatus(filterStatus === 'duplicates' ? 'all' : 'duplicates')}
          >
            {filterStatus === 'duplicates' ? 'Show All Contests' : 'Filter Duplicates Only'}
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="search-filter-bar">
        {/* Search input */}
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <input
            type="text"
            className="search-input"
            placeholder="Search contests by title, slug, or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
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

      {/* Contests Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {filteredContests.map((contest) => {
          const status = getStatus(contest.start_date, contest.end_date);
          const statusClass = status === 'active' ? 'badge-success' : status === 'upcoming' ? 'badge-warning' : 'badge-muted';
          const isDuplicate = duplicateSlugs.has((contest.hackerrank_slug || '').toLowerCase().trim());
          const questionCount = contest.questions?.[0]?.count || 0;

          return (
            <div
              key={contest.id}
              style={{
                background: 'var(--surface)',
                border: isDuplicate ? '1px solid var(--warning)' : '1px solid var(--border)',
                borderRadius: 12,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s, transform 0.15s',
                boxShadow: isDuplicate ? '0 0 12px rgba(245,158,11,0.1)' : 'none',
              }}
            >
              <div>
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/contests/${contest.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {contest.title}
                      </h3>
                    </Link>
                    <code style={{ fontSize: '0.78rem', color: 'var(--accent)', background: 'var(--surface-2)', padding: '0.1rem 0.4rem', borderRadius: 4, display: 'inline-block', marginTop: '0.25rem' }}>
                      {contest.hackerrank_slug}
                    </code>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                    <span className={`badge ${statusClass}`} style={{ fontSize: '0.72rem' }}>{status.toUpperCase()}</span>
                    {isDuplicate && (
                      <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>DUPLICATE</span>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                  <div>🗓️ Starts: {new Date(contest.start_date).toLocaleString()}</div>
                  <div>⏳ Ends: {new Date(contest.end_date).toLocaleString()}</div>
                  <div>💡 Questions: <strong>{questionCount}</strong></div>

                  {/* Group & Team badges */}
                  {isAdminOrManager && (
                    <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {(contest.assignedTeams || []).map((t) => (
                        <span key={t} style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                          Team: {t}
                        </span>
                      ))}
                      {(contest.assignedGroups || []).map((g) => (
                        <span key={g} style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                          Group: {g}
                        </span>
                      ))}
                      {(!contest.assignedTeams || contest.assignedTeams.length === 0) &&
                       (!contest.assignedGroups || contest.assignedGroups.length === 0) && (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>No assigned groups/teams</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <Link href={`/contests/${contest.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.82rem' }}>
                  📊 View Details
                </Link>

                {isAdminOrManager && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Link href={`/contests/${contest.id}/edit`} className="btn btn-ghost btn-sm" title="Edit & Manage Assignments" style={{ fontSize: '0.85rem' }}>
                      ⚙️
                    </Link>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Delete Contest"
                      onClick={() => setDeleteTarget(contest)}
                      style={{ fontSize: '0.85rem', color: 'var(--error)' }}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredContests.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Contests Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto' }}>
              {searchQuery
                ? `No contests matching "${searchQuery}". Try a different search term or clear the filter.`
                : 'No contests found for the selected status filter.'}
            </p>
            {searchQuery && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSearchQuery('')} style={{ marginTop: '1rem' }}>
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)} style={{ zIndex: 100 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', maxWidth: 460, width: '90%' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--error)', marginBottom: '0.75rem' }}>
              🗑️ Confirm Delete Contest
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Are you sure you want to delete <strong>"{deleteTarget.title}"</strong> (<code>{deleteTarget.hackerrank_slug}</code>)?
            </p>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem', color: 'var(--error)', marginBottom: '1.25rem' }}>
              This will permanently delete the contest, its questions, all group/team assignments, and trainer completion records.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="btn" onClick={handleDelete} disabled={isDeleting} style={{ background: 'var(--error)', color: '#fff' }}>
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
