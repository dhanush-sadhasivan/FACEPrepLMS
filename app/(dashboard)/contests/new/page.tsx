import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ContestWizard from './ContestWizard';
import '../page.css';

export default async function NewContestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    redirect('/contests');
  }

  const [groupsRes, usersRes, trainersRes] = await Promise.all([
    supabase.from('groups').select('*').order('name', { ascending: true }),
    supabase.from('users').select('team').not('team', 'is', null),
    supabase
      .from('users')
      .select('id, full_name, emp_id, email, team, role, hackerrank_id, leetcode_id')
      .neq('role', 'admin')
      .order('full_name', { ascending: true }),
  ]);

  const groups = groupsRes.data || [];
  const distinctTeams = Array.from(new Set((usersRes.data || []).map((u: { team: string }) => u.team).filter(Boolean)));
  const trainers = trainersRes.data || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Contest</h1>
      <ContestWizard groups={groups} teams={distinctTeams as string[]} trainers={trainers} />
    </div>
  );
}
