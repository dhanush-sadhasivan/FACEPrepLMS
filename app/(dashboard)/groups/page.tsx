import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import CreateGroupModal from './CreateGroupModal';
import './page.css';
import { Group } from '@/lib/types';

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

  const formattedGroups = groups?.map((g: any) => ({
    ...g,
    memberCount: g.members[0].count
  })) || [];

  return (
    <div className="groups-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">Manage training groups and cohorts.</p>
        </div>
        <CreateGroupModal />
      </div>

      <div className="groups-grid">
        {formattedGroups.map((group) => (
          <div key={group.id} className="card group-card">
            <h3 className="group-name">{group.name}</h3>
            <p className="group-meta">Created on: {new Date(group.created_at).toLocaleDateString()}</p>
            <div className="group-stats">
              <span className="badge badge-gray">{group.memberCount} Members</span>
            </div>
            <div className="group-actions mt-4">
              <Link href={`/groups/${group.id}`} className="btn btn-secondary btn-sm flex-1 text-center">
                View Details
              </Link>
            </div>
          </div>
        ))}
        {formattedGroups.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted">
            No groups found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
