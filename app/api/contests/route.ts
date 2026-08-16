import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, team')
    .eq('id', user.id)
    .single();

  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  if (isAdminOrManager) {
    const { data, error } = await supabase
      .from('contests')
      .select('*, questions:questions(count), assignments:contest_assignments(count)')
      .order('start_date', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Trainer view
  const { data: userGroups } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = (userGroups || []).map((g: { group_id: string }) => g.group_id);

  const conditions: string[] = [];
  if (profile?.team) conditions.push(`team.eq.${profile.team}`);
  if (groupIds.length > 0) conditions.push(`group_id.in.(${groupIds.join(',')})`);

  if (conditions.length === 0) {
    return NextResponse.json([]);
  }

  const { data: assignments } = await supabase
    .from('contest_assignments')
    .select('contest_id')
    .or(conditions.join(','));

  const contestIds = Array.from(new Set((assignments || []).map((a: { contest_id: string }) => a.contest_id)));
  if (contestIds.length === 0) return NextResponse.json([]);

  const { data, error } = await supabase
    .from('contests')
    .select('*, questions:questions(count), assignments:contest_assignments(count)')
    .in('id', contestIds)
    .order('start_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify Admin/Manager role
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Use Admin Client for database mutations to bypass RLS policies
  const supabaseAdmin = getAdminClient();

  try {
    const body = await request.json();
    const { title, slug, start_date, end_date, questions, groups, teams } = body;

    if (!title || !slug || !start_date || !end_date) {
      return NextResponse.json({ error: 'Missing required contest fields' }, { status: 400 });
    }

    console.log(`[POST /api/contests] Creating contest "${title}" (${slug}) with ${questions?.length || 0} question(s)`);

    // 1. Create Contest
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('contests')
      .insert({
        title,
        hackerrank_slug: slug,
        start_date,
        end_date,
        created_by: user.id
      })
      .select()
      .single();

    if (contestError) {
      console.error(`[POST /api/contests] Contest insert error: ${contestError.message}`);
      throw contestError;
    }

    // 2. Insert Questions
    if (questions && questions.length > 0) {
      const questionsData = questions.map((q: any, idx: number) => ({
        contest_id: contest.id,
        slug: q.slug || `q-${idx}`,
        title: q.title || 'Untitled Problem',
        domain: q.domain || 'General',
        hackerrank_url: q.hackerrank_url || `https://www.hackerrank.com/contests/${slug}/challenges/${q.slug}`,
        difficulty: q.difficulty || 'Medium',
        max_score: q.max_score || 10,
        is_enabled: true,
        order_index: idx
      }));

      const { error: qError } = await supabaseAdmin.from('questions').insert(questionsData);
      if (qError) {
        console.error(`[POST /api/contests] Questions insert error: ${qError.message}`);
        throw qError;
      }
    }

    // 3. Insert Assignments
    const assignmentsData: Array<{ contest_id: string; group_id?: string; team?: string }> = [];
    if (groups && Array.isArray(groups)) {
      groups.forEach((groupId: string) => assignmentsData.push({ contest_id: contest.id, group_id: groupId }));
    }
    if (teams && Array.isArray(teams)) {
      teams.forEach((teamName: string) => assignmentsData.push({ contest_id: contest.id, team: teamName }));
    }

    if (assignmentsData.length > 0) {
      const { error: aError } = await supabaseAdmin.from('contest_assignments').insert(assignmentsData);
      if (aError) {
        console.error(`[POST /api/contests] Assignments insert error: ${aError.message}`);
        throw aError;
      }

      // 4. Generate Notifications for Assigned Users
      try {
        const targetUserIds = new Set<string>();

        if (groups && groups.length > 0) {
          const { data: gMembers } = await supabaseAdmin
            .from('group_members')
            .select('user_id')
            .in('group_id', groups);
          (gMembers || []).forEach((gm: any) => targetUserIds.add(gm.user_id));
        }

        if (teams && teams.length > 0) {
          const { data: tUsers } = await supabaseAdmin
            .from('users')
            .select('id')
            .in('team', teams);
          (tUsers || []).forEach((tu: any) => targetUserIds.add(tu.id));
        }

        if (targetUserIds.size > 0) {
          const notifs = Array.from(targetUserIds).map((uid) => ({
            user_id: uid,
            type: 'contest_assigned',
            title: `🏆 New Contest Assigned: ${title}`,
            message: `You have been assigned to contest "${title}". Click to view questions and start solving!`,
            link: `/contests/${contest.id}`,
            related_id: contest.id,
            is_read: false,
          }));

          await supabaseAdmin.from('notifications').insert(notifs);
          console.log(`[POST /api/contests] Generated ${notifs.length} contest assignment notification(s)`);
        }
      } catch (nErr: any) {
        console.error(`[POST /api/contests] Notification generation error: ${nErr.message}`);
      }
    }

    console.log(`[POST /api/contests] Successfully created contest ${contest.id}`);
    return NextResponse.json(contest, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
