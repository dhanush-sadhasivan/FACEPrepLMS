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

  // Fetch all roadmaps with contest titles, user progress, and target assignments
  const [roadmapsRes, contestsRes, progressRes, assignmentsRes] = await Promise.all([
    dbAdmin.from('roadmaps').select('*').order('created_at', { ascending: false }),
    dbAdmin.from('contests').select('id, title'),
    dbAdmin.from('user_roadmap_progress').select('*'),
    dbAdmin.from('roadmap_assignments').select('*, group:groups(name), user:users!roadmap_assignments_user_id_fkey(full_name)'),
  ]);

  const roadmaps = roadmapsRes.data || [];
  const contests = contestsRes.data || [];
  const progressList = progressRes.data || [];
  const assignments = assignmentsRes.data || [];

  const result = roadmaps.map(rm => {
    const contest = contests.find(c => c.id === rm.contest_id);
    const rmProgress = progressList.filter(p => p.roadmap_id === rm.id);
    const rmAssignments = assignments.filter(a => a.roadmap_id === rm.id);

    const completedCount = rmProgress.filter(p => p.status === 'completed').length;
    const inProgressCount = rmProgress.filter(p => p.status === 'in_progress').length;

    return {
      ...rm,
      contest_title: contest?.title || null,
      assignments: rmAssignments,
      stats: {
        total_assigned: rmProgress.length,
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
