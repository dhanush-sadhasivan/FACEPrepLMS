import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/roadmaps/[id] — Fetch single roadmap details for editing
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const [roadmapRes, assignmentsRes] = await Promise.all([
    supabase.from('roadmaps').select('*').eq('id', id).single(),
    supabase.from('roadmap_assignments').select('group_id, user_id').eq('roadmap_id', id),
  ]);

  if (roadmapRes.error || !roadmapRes.data) {
    return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
  }

  const roadmap = roadmapRes.data;
  const assignments = assignmentsRes.data || [];

  const targetGroupIds = assignments.map(a => a.group_id).filter(Boolean);
  const targetUserIds = assignments.map(a => a.user_id).filter(Boolean);

  return NextResponse.json({
    ...roadmap,
    target_group_ids: targetGroupIds,
    target_user_ids: targetUserIds,
  });
}

// PUT / PATCH /api/admin/roadmaps/[id] — Update an existing roadmap and its assignments
export const PATCH = PUT;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // 1. Update Roadmap row
  const updatePayload: any = {
    title: title.trim(),
    description: description?.trim() || null,
    domain: domain || 'General',
    level: level || 'Beginner',
    estimated_hours: estimated_hours || 20,
    topics,
    contest_id: contest_id || null,
  };
  if (typeof is_it_roadmap === 'boolean') {
    updatePayload.is_it_roadmap = is_it_roadmap;
  }

  const { data: roadmap, error: updateError } = await supabase
    .from('roadmaps')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 2. Refresh Assignments
  await supabase.from('roadmap_assignments').delete().eq('roadmap_id', id);

  const assignmentsToInsert: { roadmap_id: string; group_id?: string; user_id?: string; assigned_by: string }[] = [];

  if (target_group_ids && Array.isArray(target_group_ids)) {
    target_group_ids.forEach((gid: string) => {
      assignmentsToInsert.push({
        roadmap_id: id,
        group_id: gid,
        assigned_by: user.id,
      });
    });
  }

  if (target_user_ids && Array.isArray(target_user_ids)) {
    target_user_ids.forEach((uid: string) => {
      assignmentsToInsert.push({
        roadmap_id: id,
        user_id: uid,
        assigned_by: user.id,
      });
    });
  }

  if (assignmentsToInsert.length > 0) {
    await supabase.from('roadmap_assignments').insert(assignmentsToInsert);
  }

  return NextResponse.json(roadmap);
}

// DELETE /api/admin/roadmaps/[id] — Delete a roadmap
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  await supabase.from('roadmap_assignments').delete().eq('roadmap_id', id);
  await supabase.from('user_roadmap_progress').delete().eq('roadmap_id', id);
  const { error } = await supabase.from('roadmaps').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
