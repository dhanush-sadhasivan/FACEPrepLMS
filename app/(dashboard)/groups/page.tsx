import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import CreateGroupModal from './CreateGroupModal';
import './page.css';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const supabase = await createClient();

  // Fetch groups and count members
  const { data: groups, error } = await supabase
    .from('groups')
    .select('*, members:group_members(count)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching groups:', error);
  }

  const formattedGroups =
    groups?.map((g: any) => ({
      ...g,
      memberCount: g.members[0]?.count || 0,
    })) || [];

  const totalMembers = formattedGroups.reduce((acc, g) => acc + g.memberCount, 0);

  return (
    <div className="groups-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups Management</h1>
          <p className="page-subtitle">
            Manage training cohorts, group memberships, and target assignments.
          </p>
        </div>
        <CreateGroupModal />
      </div>

      {/* Top Stats Overview Widgets */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>📁</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{formattedGroups.length}</div>
            <div className="stat-widget-label">Active Groups</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>👥</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{totalMembers}</div>
            <div className="stat-widget-label">Enrolled Members</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--success)' }}>🎯</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--success)' }}>{formattedGroups.length}</div>
            <div className="stat-widget-label">Target Cohorts</div>
          </div>
        </div>
      </div>

      {/* Section Separator */}
      <div className="section-separator">
        <div className="separator-line" />
        <div className="separator-badge">
          <span>📁</span> ALL TRAINING COHORTS
        </div>
        <div className="separator-line" />
      </div>

      {/* Groups Grid */}
      <div className="groups-grid">
        {formattedGroups.map((group) => (
          <div key={group.id} className="group-card">
            <div className="group-card-header">
              <div className="group-card-icon">👥</div>
              <div>
                <h3 className="group-name">{group.name}</h3>
                <div className="group-meta">
                  Created {new Date(group.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>

            <div className="group-stats-row">
              <span className="group-stat-chip members">
                👥 {group.memberCount} {group.memberCount === 1 ? 'Member' : 'Members'}
              </span>
            </div>

            <div style={{ marginTop: 'auto' }}>
              <Link href={`/groups/${group.id}`} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                📊 View & Manage Group
              </Link>
            </div>
          </div>
        ))}

        {formattedGroups.length === 0 && (
          <div className="empty-groups-state">
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0.25rem 0' }}>No Groups Created Yet</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Click "+ Create Group" above to start managing trainer cohorts and assign roadmaps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
