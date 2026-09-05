import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { isValidIdentifier } from '@/lib/security';

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

    if (error) {
      console.error('[GET /api/contests] Admin query error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch contests' }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // Trainer view
  const { data: userGroups } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = (userGroups || []).map((g: { group_id: string }) => g.group_id);

  const conditions: string[] = [];
  // Quote team name to handle spaces and special characters in PostgREST filters
  if (profile?.team) conditions.push(`team.eq."${profile.team}"`);
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

  if (error) {
    console.error('[GET /api/contests] Trainer query error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch contests' }, { status: 500 });
  }
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
    const {
      title,
      slug,
      hackerrank_contest_slug,
      platform = 'hackerrank',
      start_date,
      start_time,
      end_date,
      end_time,
      questions,
      groups = [],
      teams = [],
      new_group,
    } = body;

    const contestSlug = String(slug || hackerrank_contest_slug || '').trim();
    const contestTitle = String(title || '').trim();
    const contestStart = String(start_date || start_time || '').trim();
    const contestEnd = String(end_date || end_time || '').trim();

    if (!contestTitle || !contestSlug || !contestStart || !contestEnd) {
      return NextResponse.json({ error: 'Missing required contest fields: title, slug, start_date, end_date' }, { status: 400 });
    }

    if (!isValidIdentifier(contestSlug)) {
      return NextResponse.json({ error: 'Invalid contest slug format. Must contain only alphanumeric characters, underscores, or hyphens.' }, { status: 400 });
    }

    const cleanPlatform = platform === 'leetcode' ? 'leetcode' : (platform === 'hackerrank' ? 'hackerrank' : null);
    if (!cleanPlatform) {
      return NextResponse.json({ error: 'Invalid contest platform. Allowed platforms are "hackerrank" or "leetcode".' }, { status: 400 });
    }

    const finalGroups: string[] = Array.isArray(groups) ? groups.filter(g => typeof g === 'string') : [];
    const finalTeams: string[] = Array.isArray(teams) ? teams.filter(t => typeof t === 'string') : [];

    console.log(`[POST /api/contests] Creating contest "${contestTitle}" (${contestSlug}) [${cleanPlatform}] with ${questions?.length || 0} question(s)`);

    // 1. Create Contest with strict field allowlist (mass-assignment protection)
    const contestInsertPayload = {
      title: contestTitle,
      hackerrank_slug: contestSlug,
      platform: cleanPlatform,
      start_date: contestStart,
      end_date: contestEnd,
      created_by: user.id,
    };

    const { data: contest, error: contestError } = await supabaseAdmin
      .from('contests')
      .insert(contestInsertPayload)
      .select()
      .single();

    if (contestError) {
      console.error(`[POST /api/contests] Contest insert error: ${contestError.message}`);
      throw contestError;
    }

    // 2. Insert Questions (strictly allowlisted fields)
    if (questions && questions.length > 0) {
      const questionsData = questions.map((q: any, idx: number) => {
        const rawSlug = q.slug ? String(q.slug).trim() : `q-${idx}`;
        const cleanSlug = isValidIdentifier(rawSlug) ? rawSlug : `q-${idx}`;
        const cleanTitle = q.title ? String(q.title).trim() : 'Untitled Problem';
        const cleanDomain = q.domain ? String(q.domain).trim() : 'General';
        const cleanDifficulty = ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium';
        const cleanMaxScore = typeof q.max_score === 'number' && q.max_score > 0 ? q.max_score : 10;
        const problemUrl = q.url || q.hackerrank_url || (cleanPlatform === 'leetcode' ? `https://leetcode.com/problems/${cleanSlug}/` : `https://www.hackerrank.com/contests/${contestSlug}/challenges/${cleanSlug}`);

        return {
          contest_id: contest.id,
          slug: cleanSlug,
          title: cleanTitle,
          domain: cleanDomain,
          hackerrank_url: problemUrl,
          url: problemUrl,
          difficulty: cleanDifficulty,
          max_score: cleanMaxScore,
          is_enabled: true,
          order_index: idx,
        };
      });

      const { error: qError } = await supabaseAdmin.from('questions').insert(questionsData);
      if (qError) {
        console.error(`[POST /api/contests] Questions insert error: ${qError.message}`);
        throw qError;
      }
    }

    // 2.5 Handle optional on-the-fly group creation with selected individual trainers
    if (new_group && new_group.name && Array.isArray(new_group.user_ids) && new_group.user_ids.length > 0) {
      console.log(`[POST /api/contests] Creating on-the-fly group "${new_group.name}" with ${new_group.user_ids.length} trainer(s)`);
      const { data: createdGroup, error: groupErr } = await supabaseAdmin
        .from('groups')
        .insert({
          name: new_group.name.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (!groupErr && createdGroup) {
        const groupMembers = new_group.user_ids.map((uid: string) => ({
          group_id: createdGroup.id,
          user_id: uid,
        }));
        await supabaseAdmin.from('group_members').insert(groupMembers);
        finalGroups.push(createdGroup.id);
      } else if (groupErr) {
        console.error(`[POST /api/contests] On-the-fly group creation error: ${groupErr.message}`);
      }
    }

    // 3. Insert Assignments
    const assignmentsData: Array<{ contest_id: string; group_id?: string; team?: string }> = [];
    if (finalGroups && Array.isArray(finalGroups)) {
      finalGroups.forEach((groupId: string) => assignmentsData.push({ contest_id: contest.id, group_id: groupId }));
    }
    if (finalTeams && Array.isArray(finalTeams)) {
      finalTeams.forEach((teamName: string) => assignmentsData.push({ contest_id: contest.id, team: teamName }));
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
    console.error('[POST /api/contests] Exception:', message);
    return NextResponse.json({ error: 'Failed to create contest' }, { status: 500 });
  }
}
