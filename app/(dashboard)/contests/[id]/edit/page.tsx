import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import EditContestForm from './EditContestForm';
import './edit.css';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContestEditPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    redirect('/dashboard');
  }

  const supabaseAdmin = getAdminClient();

  // 1. Fetch Contest
  const { data: contest, error } = await supabaseAdmin
    .from('contests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !contest) redirect('/contests');

  // 2. Fetch existing assignments
  const { data: assignments } = await supabaseAdmin
    .from('contest_assignments')
    .select('group_id, team')
    .eq('contest_id', id);

  const currentGroupIds: string[] = [];
  const currentTeams: string[] = [];

  (assignments || []).forEach((a: any) => {
    if (a.group_id) currentGroupIds.push(a.group_id);
    if (a.team) currentTeams.push(a.team);
  });

  // 3. Fetch all available groups
  const { data: allGroups } = await supabaseAdmin
    .from('groups')
    .select('id, name')
    .order('name', { ascending: true });

  // 4. Fetch all available unique teams and trainers from users table
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, full_name, emp_id, email, team, role, hackerrank_id, leetcode_id')
    .neq('role', 'admin')
    .order('full_name', { ascending: true });

  const teamSet = new Set<string>();
  (users || []).forEach((u: any) => {
    if (u.team && u.team.trim() !== '') {
      teamSet.add(u.team.trim());
    }
  });
  const allTeams = Array.from(teamSet).sort();

  return (
    <div className="edit-container" style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <Link href={`/contests/${id}`} className="back-link mb-4 block" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none' }}>
        ← Back to Contest
      </Link>

      <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem' }}>
        <h1 className="text-xl font-bold mb-4" style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1.25rem' }}>
          Edit {contest.platform === 'leetcode' ? 'LeetCode Track' : 'Contest'} &amp; Manage Assignments
        </h1>
        <EditContestForm
          contest={contest}
          currentGroupIds={currentGroupIds}
          currentTeams={currentTeams}
          allGroups={allGroups || []}
          allTeams={allTeams}
          trainers={users || []}
        />
      </div>
    </div>
  );
}
