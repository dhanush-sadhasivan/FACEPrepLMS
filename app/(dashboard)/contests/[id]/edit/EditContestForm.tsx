'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

interface EditContestFormProps {
  contest: {
    id: string;
    title: string;
    hackerrank_slug: string;
    start_date: string;
    end_date: string;
  };
  currentGroupIds: string[];
  currentTeams: string[];
  allGroups: Array<{ id: string; name: string }>;
  allTeams: string[];
}

export default function EditContestForm({
  contest,
  currentGroupIds,
  currentTeams,
  allGroups,
  allTeams,
}: EditContestFormProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [title, setTitle] = useState(contest.title);
  const [hackerrankSlug, setHackerrankSlug] = useState(contest.hackerrank_slug || '');
  const [startDate, setStartDate] = useState(formatDateForInput(contest.start_date));
  const [endDate, setEndDate] = useState(formatDateForInput(contest.end_date));
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(currentGroupIds));
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set(currentTeams));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleGroup = (id: string) => {
    const next = new Set(selectedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGroups(next);
  };

  const toggleTeam = (teamName: string) => {
    const next = new Set(selectedTeams);
    if (next.has(teamName)) next.delete(teamName);
    else next.add(teamName);
    setSelectedTeams(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (new Date(endDate) <= new Date(startDate)) {
      showToast('End date must be after start date', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/contests/${contest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          hackerrank_slug: hackerrankSlug,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          groups: Array.from(selectedGroups),
          teams: Array.from(selectedTeams),
        }),
      });

      if (res.ok) {
        showToast('Contest & assignments updated successfully!', 'success');
        router.push(`/contests/${contest.id}`);
        router.refresh();
      } else {
        const data = await res.json();
        showToast(`Failed to update contest: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('An error occurred while updating the contest', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/contests/${contest.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showToast(`Contest "${contest.title}" deleted successfully.`, 'success');
        router.push('/contests');
        router.refresh();
      } else {
        const data = await res.json();
        showToast(`Failed to delete contest: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to delete contest', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Contest Title */}
        <div className="form-group">
          <label htmlFor="title" className="label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Contest Title</label>
          <input
            type="text"
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* HackerRank Slug */}
        <div className="form-group">
          <label htmlFor="slug" className="label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>HackerRank Contest Slug</label>
          <input
            type="text"
            id="slug"
            className="input"
            value={hackerrankSlug}
            onChange={(e) => setHackerrankSlug(e.target.value)}
            required
            style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
            The slug as seen in the HackerRank URL (e.g. <code>pjl-a-ds</code>)
          </small>
        </div>

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="start_date" className="label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Start Date &amp; Time</label>
            <input
              type="datetime-local"
              id="start_date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="end_date" className="label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>End Date &amp; Time</label>
            <input
              type="datetime-local"
              id="end_date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Assign / Revoke / Reassign Section */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>👥 Contest Assignments (Assign / Revoke)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Select the Groups or Teams that should have access to this contest. Uncheck a group or team to revoke access.
          </p>

          {/* Groups */}
          {allGroups.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Assigned Groups ({selectedGroups.size}/{allGroups.length}):</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedGroups(new Set(allGroups.map(g => g.id)))}>Select All</button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedGroups(new Set())}>Clear All</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                {allGroups.map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(g.id)}
                      onChange={() => toggleGroup(g.id)}
                    />
                    <span>{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Teams */}
          {allTeams.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Assigned Teams ({selectedTeams.size}/{allTeams.length}):</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedTeams(new Set(allTeams))}>Select All</button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedTeams(new Set())}>Clear All</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                {allTeams.map(teamName => (
                  <label key={teamName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedTeams.has(teamName)}
                      onChange={() => toggleTeam(teamName)}
                    />
                    <span>{teamName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="form-actions mt-6" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowDeleteModal(true)}
            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: '1px solid var(--error)' }}
          >
            🗑️ Delete Contest
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href={`/contests/${contest.id}`} className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)} style={{ zIndex: 100 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', maxWidth: 480, width: '90%' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--error)', marginBottom: '0.75rem' }}>
              ⚠️ Delete Contest
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{contest.title}"</strong> (<code>{contest.hackerrank_slug}</code>)?
            </p>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem', color: 'var(--error)', marginBottom: '1.25rem' }}>
              This action cannot be undone. All questions, assigned permissions, and progress history for this contest will be permanently deleted.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="btn" onClick={handleDelete} disabled={isDeleting} style={{ background: 'var(--error)', color: '#fff' }}>
                {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
