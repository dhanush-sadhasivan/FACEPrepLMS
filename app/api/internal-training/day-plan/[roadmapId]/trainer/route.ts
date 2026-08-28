import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { recordITAttendance } from '@/lib/it-day-counter';
import {
  formatISODate,
  attachDatesToDayPlans,
} from '@/lib/it-calendar';

// GET /api/internal-training/day-plan/[roadmapId]/trainer
// Returns trainer-specific day plan with per-roadmap attendance-driven day progression
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
  const today = formatISODate(new Date());

  // 1. Fetch user profile, roadmap, config, day plans
  const [profileRes, roadmapRes, configRes, dayPlansRes] = await Promise.all([
    dbAdmin.from('users').select('*').eq('id', user.id).single(),
    dbAdmin.from('roadmaps').select('*').eq('id', roadmapId).single(),
    dbAdmin.from('it_roadmap_config').select('*').eq('roadmap_id', roadmapId).maybeSingle(),
    dbAdmin.from('it_day_plans').select('*').eq('roadmap_id', roadmapId).order('day_number', { ascending: true }),
  ]);

  if (roadmapRes.error || !roadmapRes.data) {
    return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
  }

  const profile = profileRes.data;
  const roadmap = roadmapRes.data;
  const config = configRes.data || {
    roadmap_id: roadmapId,
    start_date_mode: 'first_login',
    working_days: [1, 2, 3, 4, 5],
    default_extension_days: 3,
  };
  const workingDays: number[] = config.working_days || [1, 2, 3, 4, 5];

  const rawDayPlans = dayPlansRes.data || [];
  const dayPlanIds = rawDayPlans.map((dp: any) => dp.id);

  let rawQuestions: any[] = [];
  if (dayPlanIds.length > 0) {
    const { data: qData } = await dbAdmin
      .from('it_day_questions')
      .select('*')
      .in('day_plan_id', dayPlanIds)
      .order('order_index', { ascending: true });
    rawQuestions = qData || [];
  }

  // 2. Fetch or initialize per-roadmap trainer progress
  const { data: existingProgress } = await dbAdmin
    .from('it_trainer_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('roadmap_id', roadmapId)
    .maybeSingle();

  let progress = existingProgress;
  let startedAt = progress?.started_at;

  if (!progress) {
    // First time trainer accesses this roadmap
    const { data: newProg, error: progErr } = await dbAdmin
      .from('it_trainer_progress')
      .insert({
        user_id: user.id,
        roadmap_id: roadmapId,
        started_at: today,
        current_day: 0,
        it_days_logged: 0,
        last_check_in_date: null,
        extended_days: 0,
        extension_count: 0,
      })
      .select()
      .single();

    if (!progErr && newProg) {
      progress = newProg;
      startedAt = today;
    }
  }

  if (!startedAt) {
    startedAt = today;
  }

  const totalPlannedDays = rawDayPlans.length;
  let extendedDays = progress?.extended_days || 0;
  let extensionCount = progress?.extension_count || 0;

  // ── Per-Roadmap Attendance-Driven Day Calculation ───────────
  const itDaysLogged = progress?.it_days_logged || 0;
  const lastCheckInDate = progress?.last_check_in_date || null;
  const isCheckedInToday = lastCheckInDate === today;
  const needsCheckInToday = !isCheckedInToday;

  // currentDay = number of IT days logged for THIS roadmap
  const currentDay = Math.min(itDaysLogged, totalPlannedDays || 1);
  const nextDayToUnlock = Math.min(itDaysLogged + 1, totalPlannedDays || 1);

  // Global IT days (for display in header badge)
  const globalItDays = Math.max(profile?.it_days_count || 0);

  // 3. Fetch completion records for this user
  const [completionsRes, hrProgressRes] = await Promise.all([
    dbAdmin.from('it_question_completions').select('*').eq('user_id', user.id),
    dbAdmin.from('progress').select('question_id, status, score').eq('user_id', user.id),
  ]);

  const completionMap = new Map<string, any>();
  (completionsRes.data || []).forEach((c: any) => {
    completionMap.set(c.day_question_id, c);
  });

  const hrProgressMap = new Map<string, any>();
  (hrProgressRes.data || []).forEach((p: any) => {
    if (p.question_id) hrProgressMap.set(p.question_id, p);
  });

  // Attach completion and click info to questions
  let totalQuestionsCount = 0;
  let completedQuestionsCount = 0;

  const questionsWithState = rawQuestions.map((q: any) => {
    totalQuestionsCount++;
    const comp = completionMap.get(q.id);
    const hr = q.question_id ? hrProgressMap.get(q.question_id) : null;

    const hasClickedFromPortal = Boolean(comp?.clicked_at);
    const isHackerRankSolved = hr?.status === 'solved';
    const isManuallyCompleted = Boolean(comp?.is_completed);

    // Completed = clicked from portal AND (solved on HR OR manually marked)
    const isCompleted = hasClickedFromPortal && (isHackerRankSolved || isManuallyCompleted);
    if (isCompleted) completedQuestionsCount++;

    return {
      ...q,
      clicked_at: comp?.clicked_at || null,
      is_completed: isCompleted,
      hr_solved: isHackerRankSolved,
      needs_portal_click: isHackerRankSolved && !hasClickedFromPortal,
      completed_at: comp?.completed_at || (isCompleted && isHackerRankSolved ? hr?.last_submission_at : null),
      score: hr?.score || 0,
    };
  });

  // Auto-extension check
  if (currentDay >= totalPlannedDays && completedQuestionsCount < totalQuestionsCount && totalPlannedDays > 0) {
    const extraToAdd = config.default_extension_days || 3;
    if (extendedDays === 0) {
      extendedDays += extraToAdd;
      extensionCount += 1;

      await dbAdmin
        .from('it_trainer_progress')
        .update({
          extended_days: extendedDays,
          extension_count: extensionCount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('roadmap_id', roadmapId);

      try {
        await dbAdmin.from('notifications').insert({
          user_id: user.id,
          type: 'system',
          title: 'Plan Auto-Extended ⏳',
          message: `Your IT roadmap "${roadmap.title}" has been granted +${extraToAdd} extra days to complete remaining questions.`,
          related_id: roadmapId,
        });
      } catch (e) {
        console.error('Error inserting extension notification:', e);
      }
    }
  }

  // 4. Structure all day plans with questions and calculated dates
  const dayPlansWithDates = attachDatesToDayPlans(
    rawDayPlans.map((dp: any) => ({
      ...dp,
      questions: questionsWithState.filter((q: any) => q.day_plan_id === dp.id),
      is_unlocked: dp.day_number <= currentDay,
    })),
    startedAt,
    workingDays
  );

  // 5. Partition into Today's Plan and Pending Questions
  const todayPlan = isCheckedInToday
    ? (dayPlansWithDates.find((dp) => dp.day_number === currentDay) || null)
    : null;
  const nextPlanPreview = needsCheckInToday
    ? (dayPlansWithDates.find((dp) => dp.day_number === nextDayToUnlock) || null)
    : null;

  // Pending: unlocked days with uncompleted questions
  const unlockedDays = dayPlansWithDates.filter((dp) =>
    dp.day_number <= (isCheckedInToday ? currentDay - 1 : currentDay)
  );
  const pendingByDay = unlockedDays
    .map((dp) => ({
      ...dp,
      questions: dp.questions.filter((q: any) => !q.is_completed),
    }))
    .filter((dp) => dp.questions.length > 0);

  const pendingQuestionsCount = pendingByDay.reduce((acc, dp) => acc + dp.questions.length, 0);

  // Check for any pending IT dispute for today or current roadmap
  let pendingDispute = null;
  try {
    const { data: disputeData } = await dbAdmin
      .from('it_attendance_disputes')
      .select('*')
      .eq('user_id', user.id)
      .eq('roadmap_id', roadmapId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    pendingDispute = disputeData || null;
  } catch (dispErr) {
    // Graceful fallback if table is not yet created
    console.warn('[trainer-plan] Could not query it_attendance_disputes:', dispErr);
  }

  return NextResponse.json({
    roadmap,
    config,
    progress: {
      user_id: user.id,
      roadmap_id: roadmapId,
      started_at: startedAt,
      current_day: currentDay,
      it_days_logged: itDaysLogged,
      next_day_to_unlock: nextDayToUnlock,
      total_days: totalPlannedDays,
      extended_days: extendedDays,
      extension_count: extensionCount,
      completed_questions_count: completedQuestionsCount,
      total_questions_count: totalQuestionsCount,
      pending_questions_count: pendingQuestionsCount,
      needs_check_in_today: needsCheckInToday,
      location: progress?.location || null,
    },
    todayPlan,
    nextPlanPreview,
    pendingByDay,
    allDays: dayPlansWithDates,
    itDaysLogged,
    globalItDays,
    isCheckedInToday,
    needsCheckInToday,
    nextDayToUnlock,
    location: progress?.location || null,
    pendingDispute,
    today,
  });
}

// POST /api/internal-training/day-plan/[roadmapId]/trainer
// Roadmap-specific IT check-in: increments it_days_logged for this roadmap only
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

  try {
    const body = await request.json().catch(() => ({}));
    const location = body?.location || null;

    const result = await recordITAttendance(user.id, roadmapId, location);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to check in for IT' },
      { status: 500 }
    );
  }
}

