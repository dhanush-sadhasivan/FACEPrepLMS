import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/roadmaps — List all roadmaps with stats for admin/manager
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbAdmin = (await import('@/lib/supabase/admin')).getAdminClient();
  const { extractRoadmapQuestionIds } = await import('@/lib/roadmap-analytics');

  // Fetch all roadmaps with contest titles, user progress, and target assignments
  const [roadmapsRes, contestsRes, progressRes, assignmentsRes, groupMembersRes, qProgressRes] = await Promise.all([
    dbAdmin.from('roadmaps').select('*').order('created_at', { ascending: false }),
    dbAdmin.from('contests').select('id, title'),
    dbAdmin.from('user_roadmap_progress').select('*'),
    dbAdmin.from('roadmap_assignments').select('*, group:groups(name), user:users!roadmap_assignments_user_id_fkey(full_name)'),
    dbAdmin.from('group_members').select('group_id, user_id'),
    dbAdmin.from('progress').select('user_id, question_id, status, score').or('status.eq.solved,score.gt.0'),
  ]);

  const roadmaps = roadmapsRes.data || [];
  const contests = contestsRes.data || [];
  const progressList = progressRes.data || [];
  const assignments = assignmentsRes.data || [];
  const groupMembers = groupMembersRes.data || [];
  const qProgress = qProgressRes.data || [];

  const groupMembersMap = new Map<string, string[]>();
  groupMembers.forEach((gm: any) => {
    if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, []);
    groupMembersMap.get(gm.group_id)!.push(gm.user_id);
  });

  const result = roadmaps.map((rm: any) => {
    const contest = contests.find((c: any) => c.id === rm.contest_id);
    const rmAssignments = assignments.filter((a: any) => a.roadmap_id === rm.id);
    const qIds = extractRoadmapQuestionIds(rm.topics || []);
    const totalQuestions = qIds.length;

    // Resolve assigned users
    const assignedUserIds = new Set<string>();
    rmAssignments.forEach((a: any) => {
      if (a.user_id) assignedUserIds.add(a.user_id);
      if (a.group_id) {
        (groupMembersMap.get(a.group_id) || []).forEach((uid) => assignedUserIds.add(uid));
      }
    });

    let completedCount = 0;
    let inProgressCount = 0;

    assignedUserIds.forEach((uid) => {
      const userSolvedCount = qIds.filter((qid) =>
        qProgress.some((p: any) => p.user_id === uid && String(p.question_id) === qid)
      ).length;

      const userProgRow = progressList.find((p: any) => p.roadmap_id === rm.id && p.user_id === uid);
      const isDone = (totalQuestions > 0 && userSolvedCount >= totalQuestions) || userProgRow?.status === 'completed';

      if (isDone) {
        completedCount++;
      } else if (userSolvedCount > 0 || userProgRow?.status === 'in_progress') {
        inProgressCount++;
      }
    });

    return {
      ...rm,
      contest_title: contest?.title || null,
      assignments: rmAssignments,
      stats: {
        total_assigned: assignedUserIds.size,
        completed: completedCount,
        in_progress: inProgressCount,
      },
    };
  });

  return NextResponse.json(result);
}

// POST /api/admin/roadmaps — Create a new roadmap and assign to groups/trainers
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    description,
    domain,
    level,
    estimated_hours,
    topics,
    contest_id,
    is_it_roadmap,
    target_group_ids,
    target_user_ids,
  } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Roadmap title is required' }, { status: 400 });
  }

  if (!topics || !Array.isArray(topics) || topics.length === 0) {
    return NextResponse.json({ error: 'At least one topic is required' }, { status: 400 });
  }

  // 1. Insert Roadmap
  const { data: roadmap, error: insertError } = await supabase
    .from('roadmaps')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      domain: domain || 'General',
      level: level || 'Beginner',
      estimated_hours: estimated_hours || 20,
      topics,
      contest_id: contest_id || null,
      is_it_roadmap: Boolean(is_it_roadmap),
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 2. Create Roadmap Assignments (Group or User based)
  const assignmentsToInsert: { roadmap_id: string; group_id?: string; user_id?: string; assigned_by: string }[] = [];

  if (target_group_ids && Array.isArray(target_group_ids)) {
    target_group_ids.forEach((gid: string) => {
      assignmentsToInsert.push({
        roadmap_id: roadmap.id,
        group_id: gid,
        assigned_by: user.id,
      });
    });
  }

  if (target_user_ids && Array.isArray(target_user_ids)) {
    target_user_ids.forEach((uid: string) => {
      assignmentsToInsert.push({
        roadmap_id: roadmap.id,
        user_id: uid,
        assigned_by: user.id,
      });
    });
  }

  if (assignmentsToInsert.length > 0) {
    await supabase.from('roadmap_assignments').insert(assignmentsToInsert);
  }

  return NextResponse.json(roadmap, { status: 201 });
}
