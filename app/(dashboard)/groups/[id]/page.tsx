import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AddMemberModal from './AddMemberModal';
import EditGroupHeader from './EditGroupHeader';
import GroupMembersTable from './GroupMembersTable';
import '../page.css';

export const dynamic = 'force-dynamic';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function renderRoleBadge(role?: string) {
  const r = role?.toLowerCase() || 'trainer';
  if (r === 'admin') return <span className="role-badge admin">👑 Admin</span>;
  if (r === 'manager') return <span className="role-badge manager">🛡️ Manager</span>;
  return <span className="role-badge trainer">🎓 Trainer</span>;
}

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();

  // Fetch group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', (await params).id)
    .single();

  if (groupError || !group) {
    notFound();
  }

  // Fetch members
  const { data: membersData } = await supabase
    .from('group_members')
    .select('user_id, users(id, full_name, emp_id, team, role)')
    .eq('group_id', (await params).id);

  const members = (membersData?.map((m: any) => m.users).filter(Boolean) || []) as any[];

  // Fetch all trainers/users to allow adding them
  const { data: allUsers } = await supabase.from('users').select('id, full_name, emp_id, role');
  const availableUsers = allUsers?.filter((u) => !members.find((m: any) => m?.id === u.id)) || [];

  return (
    <div className="groups-page">
      {/* Breadcrumbs */}
      <div className="page-breadcrumb">
        <Link href="/groups">← Back to All Groups</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{group.name}</span>
      </div>

      {/* Group Detail Banner */}
      <EditGroupHeader group={group} />

      {/* Quick Stats overview */}
      <div className="stats-overview-grid">
        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--accent)' }}>👥</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--accent)' }}>{members.length}</div>
            <div className="stat-widget-label">Enrolled Members</div>
          </div>
        </div>

        <div className="stat-card-widget">
          <div className="stat-widget-icon" style={{ color: 'var(--indigo)' }}>➕</div>
          <div>
            <div className="stat-widget-val" style={{ color: 'var(--indigo)' }}>{availableUsers.length}</div>
            <div className="stat-widget-label">Available to Add</div>
          </div>
        </div>
      </div>

      {/* Section Separator */}
      <div className="section-separator">
        <div className="separator-line" />
        <div className="separator-badge">
          <span>👥</span> ENROLLED GROUP MEMBERS ({members.length})
        </div>
        <div className="separator-line" />
      </div>

      {/* Group Members Section */}
      <div className="members-card">
        <div className="members-card-header">
          <h2 className="members-card-title">
            <span>👥</span> Roster &amp; Member List
          </h2>
          <AddMemberModal groupId={group.id} availableUsers={availableUsers} />
        </div>

        <GroupMembersTable groupId={group.id} members={members} />
      </div>
    </div>
  );
}
