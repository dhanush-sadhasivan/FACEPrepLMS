import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import ContestListClient from './ContestListClient';
import './page.css';

export default async function ContestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <div className="p-6 text-muted">Unauthorized</div>;

  const { data: profile } = await supabase
    .from('users')
    .select('role, team')
    .eq('id', user.id)
    .single();

  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';
  let contestsData: any[] = [];

  const dbAdmin = getAdminClient();

  if (isAdminOrManager) {
    // Admin & Manager see ALL contests using admin client
    const { data, error } = await dbAdmin
      .from('contests')
      .select(`
        *,
        questions(count),
        assignments:contest_assignments(
          group_id,
          team,
          groups(name)
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) contestsData = data;
  } else if (profile) {
    // Trainer sees contests assigned to their team or groups
    const { data: userGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    const userGroupIds = (userGroups || []).map((g: { group_id: string }) => g.group_id);

    let assignmentQuery = supabase.from('contest_assignments').select('contest_id');
    const conditions: string[] = [];

    if (profile.team) {
      conditions.push(`team.eq.${profile.team}`);
    }
    if (userGroupIds.length > 0) {
      conditions.push(`group_id.in.(${userGroupIds.join(',')})`);
    }

    if (conditions.length > 0) {
      const { data: matchedAssignments } = await assignmentQuery.or(conditions.join(','));
      const contestIds = Array.from(new Set((matchedAssignments || []).map((a: { contest_id: string }) => a.contest_id)));

      if (contestIds.length > 0) {
        const { data } = await dbAdmin
          .from('contests')
          .select(`
            *,
            questions(count),
            assignments:contest_assignments(
              group_id,
              team,
              groups(name)
            )
          `)
          .in('id', contestIds)
          .order('created_at', { ascending: false });
        if (data) contestsData = data;
      }
    }
  }

  // Format assignments into human-readable assignedGroups and assignedTeams arrays
  const formattedContests = contestsData.map((c: any) => {
    const assignedGroups: string[] = [];
    const assignedTeams: string[] = [];

    (c.assignments || []).forEach((a: any) => {
      if (a.groups?.name) assignedGroups.push(a.groups.name);
      if (a.team) assignedTeams.push(a.team);
    });

    return {
      ...c,
      assignedGroups: Array.from(new Set(assignedGroups)),
      assignedTeams: Array.from(new Set(assignedTeams)),
    };
  });

  return (
    <div className="contests-container">
      <ContestListClient initialContests={formattedContests} isAdminOrManager={isAdminOrManager} />
    </div>
  );
}
