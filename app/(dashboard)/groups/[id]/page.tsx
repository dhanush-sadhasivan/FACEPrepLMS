import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AddMemberModal from './AddMemberModal';
import RemoveMemberButton from './RemoveMemberButton';
import EditGroupHeader from './EditGroupHeader';

export const dynamic = 'force-dynamic';

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
  const { data: membersData, error: membersError } = await supabase
    .from('group_members')
    .select('user_id, users(id, full_name, emp_id, team, role)')
    .eq('group_id', (await params).id);
    
  const members = membersData?.map(m => m.users) || [];

  // Fetch all trainers to allow adding them
  const { data: allUsers } = await supabase.from('users').select('id, full_name, emp_id, role');
  const availableUsers = allUsers?.filter(u => !members.find((m: any) => m.id === u.id)) || [];

  return (
    <div className="groups-page">
      <div className="mb-4">
        <Link href="/groups" className="text-muted hover:text-primary">&larr; Back to Groups</Link>
      </div>
      
      <EditGroupHeader group={group} />

      <div className="card mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Members ({members.length})</h2>
          <AddMemberModal groupId={group.id} availableUsers={availableUsers} />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Team</th>
                <th>Role</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member: any) => (
                <tr key={member.id}>
                  <td>{member.emp_id}</td>
                  <td className="font-medium">{member.full_name}</td>
                  <td>{member.team || '-'}</td>
                  <td className="capitalize">{member.role}</td>
                  <td className="text-right">
                    <RemoveMemberButton groupId={group.id} userId={member.id} userName={member.full_name} />
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted">No members in this group yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
