import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/internal-training/day-plan/[roadmapId]
// Returns config, day plans, and questions for a roadmap (manager editor & view)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  const { roadmapId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbAdmin = getAdminClient();

  // Fetch roadmap, config, day plans, questions
  const [roadmapRes, configRes, dayPlansRes] = await Promise.all([
    dbAdmin.from('roadmaps').select('*').eq('id', roadmapId).single(),
    dbAdmin.from('it_roadmap_config').select('*').eq('roadmap_id', roadmapId).maybeSingle(),
    dbAdmin.from('it_day_plans').select('*').eq('roadmap_id', roadmapId).order('day_number', { ascending: true }),
  ]);

  if (roadmapRes.error || !roadmapRes.data) {
    return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
  }

  const roadmap = roadmapRes.data;
  const config = configRes.data || {
    roadmap_id: roadmapId,
    start_date_mode: 'first_login',
    working_days: [1, 2, 3, 4, 5],
    default_extension_days: 3,
  };

  const dayPlans = dayPlansRes.data || [];
  const dayPlanIds = dayPlans.map((dp: any) => dp.id);

  let questions: any[] = [];
  if (dayPlanIds.length > 0) {
    const { data: qData } = await dbAdmin
      .from('it_day_questions')
      .select('*')
      .in('day_plan_id', dayPlanIds)
      .order('order_index', { ascending: true });
    questions = qData || [];
  }

  // Nest questions under day plans
  const dayPlansWithQuestions = dayPlans.map((dp: any) => ({
    ...dp,
    questions: questions.filter((q: any) => q.day_plan_id === dp.id),
  }));

  return NextResponse.json({
    roadmap,
    config,
    dayPlans: dayPlansWithQuestions,
  });
}

// POST /api/internal-training/day-plan/[roadmapId]
// Saves or updates the entire day plan, questions, and configuration for an IT roadmap
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  const { roadmapId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { config, dayPlans } = body;

  const dbAdmin = getAdminClient();

  // 1. Ensure roadmap has is_it_roadmap = true
  await dbAdmin
    .from('roadmaps')
    .update({ is_it_roadmap: true })
    .eq('id', roadmapId);

  // 2. Upsert config
  if (config) {
    await dbAdmin
      .from('it_roadmap_config')
      .upsert({
        roadmap_id: roadmapId,
        start_date_mode: config.start_date_mode || 'first_login',
        working_days: config.working_days || [1, 2, 3, 4, 5],
        default_extension_days: config.default_extension_days ?? 3,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'roadmap_id' });
  }

  // 3. Sync day plans and questions
  // Fetch existing day plans to clean up deleted ones
  const { data: existingDays } = await dbAdmin
    .from('it_day_plans')
    .select('id')
    .eq('roadmap_id', roadmapId);

  const existingDayIds = (existingDays || []).map((d: any) => d.id);
  const incomingDayIds = (dayPlans || []).map((d: any) => d.id).filter((id: string) => id && !id.startsWith('temp_'));
  const daysToDelete = existingDayIds.filter((id: string) => !incomingDayIds.includes(id));

  if (daysToDelete.length > 0) {
    await dbAdmin.from('it_day_plans').delete().in('id', daysToDelete);
  }

  // Upsert each day plan
  for (let i = 0; i < (dayPlans || []).length; i++) {
    const dp = dayPlans[i];
    const isNew = !dp.id || dp.id.startsWith('temp_');

    let dayPlanId = dp.id;
    if (isNew) {
      const { data: newDp, error: dpErr } = await dbAdmin
        .from('it_day_plans')
        .insert({
          roadmap_id: roadmapId,
          day_number: i + 1,
          topic_title: dp.topic_title || `Day ${i + 1}`,
          description: dp.description || null,
          resources: dp.resources || [],
          created_by: user.id,
        })
        .select()
        .single();

      if (dpErr || !newDp) {
        console.error('Error creating day plan:', dpErr);
        continue;
      }
      dayPlanId = newDp.id;
    } else {
      await dbAdmin
        .from('it_day_plans')
        .update({
          day_number: i + 1,
          topic_title: dp.topic_title || `Day ${i + 1}`,
          description: dp.description || null,
          resources: dp.resources || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', dayPlanId);
    }

    // Sync questions for this day plan
    const { data: existingQs } = await dbAdmin
      .from('it_day_questions')
      .select('id')
      .eq('day_plan_id', dayPlanId);

    const existingQIds = (existingQs || []).map((q: any) => q.id);
    const incomingQIds = (dp.questions || []).map((q: any) => q.id).filter((id: string) => id && !id.startsWith('temp_'));
    const qsToDelete = existingQIds.filter((id: string) => !incomingQIds.includes(id));

    if (qsToDelete.length > 0) {
      await dbAdmin.from('it_day_questions').delete().in('id', qsToDelete);
    }

    for (let qIdx = 0; qIdx < (dp.questions || []).length; qIdx++) {
      const q = dp.questions[qIdx];
      const isNewQ = !q.id || q.id.startsWith('temp_');

      if (isNewQ) {
        await dbAdmin.from('it_day_questions').insert({
          day_plan_id: dayPlanId,
          question_type: q.question_type || 'hackerrank',
          question_id: q.question_id || null,
          title: q.title || 'Untitled Question',
          description: q.description || null,
          url: q.url || '',
          order_index: qIdx,
        });
      } else {
        await dbAdmin.from('it_day_questions').update({
          question_type: q.question_type || 'hackerrank',
          question_id: q.question_id || null,
          title: q.title || 'Untitled Question',
          description: q.description || null,
          url: q.url || '',
          order_index: qIdx,
        }).eq('id', q.id);
      }
    }
  }

  // 4. Send bell notifications to assigned trainers
  try {
    const { data: assignments } = await dbAdmin
      .from('roadmap_assignments')
      .select('user_id, group_id')
      .eq('roadmap_id', roadmapId);

    const targetUserIds = new Set<string>();
    const groupIds: string[] = [];

    (assignments || []).forEach((a: any) => {
      if (a.user_id) targetUserIds.add(a.user_id);
      if (a.group_id) groupIds.push(a.group_id);
    });

    if (groupIds.length > 0) {
      const { data: members } = await dbAdmin
        .from('group_members')
        .select('user_id')
        .in('group_id', groupIds);
      (members || []).forEach((m: any) => targetUserIds.add(m.user_id));
    }

    const { data: rmData } = await dbAdmin
      .from('roadmaps')
      .select('title')
      .eq('id', roadmapId)
      .single();

    const rmTitle = rmData?.title || 'Internal Training';

    const notifications = Array.from(targetUserIds).map((uid) => ({
      user_id: uid,
      type: 'system' as const,
      title: 'IT Day Plan Updated 📅',
      message: `The day-wise plan for "${rmTitle}" has been updated by your manager. Check your Internal Training Dashboard!`,
      related_id: roadmapId,
    }));

    if (notifications.length > 0) {
      await dbAdmin.from('notifications').insert(notifications);
    }
  } catch (notifErr) {
    console.error('Error dispatching notifications:', notifErr);
  }

  return NextResponse.json({ success: true });
}
