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

  const { data: groups } = await supabase.from('groups').select('*');

  // Extract distinct teams from users table (team column)
  const { data: users } = await supabase.from('users').select('team').not('team', 'is', null);
  const distinctTeams = Array.from(new Set((users || []).map((u: { team: string }) => u.team).filter(Boolean)));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Contest</h1>
      <ContestWizard groups={groups || []} teams={distinctTeams as string[]} />
    </div>
  );
}
