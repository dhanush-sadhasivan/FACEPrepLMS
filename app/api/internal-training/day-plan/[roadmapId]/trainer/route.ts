import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import {
  formatISODate,
  computeCurrentDayNumber,
  attachDatesToDayPlans,
} from '@/lib/it-calendar';

// GET /api/internal-training/day-plan/[roadmapId]/trainer
// Returns trainer-specific day plan, today's topic, pending questions, and auto-initiates progress on first visit
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

  // 2. Fetch auth user data for attendance status
  const { data: authUserData } = await dbAdmin.auth.admin.getUserById(user.id);
  const metadata = authUserData?.user?.user_metadata || {};

  const itDaysCount = Math.max(profile?.it_days_count || 0, metadata?.it_days_count || 0);
  const lastItCheckDate = profile?.last_it_check_date || metadata?.last_it_check_date || null;
  const isITCountedToday = lastItCheckDate === today;
  const needsCheckInToday = !isITCountedToday;

  // 3. Fetch or initialize trainer progress
  const { data: existingProgress } = await dbAdmin
    .from('it_trainer_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('roadmap_id', roadmapId)
    .maybeSingle();

  let progress = existingProgress;
  let startedAt = progress?.started_at;

  if (!progress) {
    // First time trainer accesses this day plan
    const { data: newProg, error: progErr } = await dbAdmin
      .from('it_trainer_progress')
      .insert({
        user_id: user.id,
        roadmap_id: roadmapId,
        started_at: today,
        current_day: isITCountedToday ? Math.max(1, itDaysCount) : 1,
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

  // ── Attendance-Driven Day Calculation (1:1 Unlock Model) ───────────
  // Unlocked day corresponds strictly to logged IT days
  const unlockedDayNumber = isITCountedToday ? Math.max(1, itDaysCount) : itDaysCount;
  const currentDay = Math.min(Math.max(1, unlockedDayNumber), totalPlannedDays || 1);
  const nextDayToUnlock = Math.min(itDaysCount + 1, totalPlannedDays || 1);

  // 4. Fetch completion records for this user
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

    const isHackerRankSolved = hr?.status === 'solved';
    const isCompleted = Boolean(comp?.is_completed || isHackerRankSolved);
    if (isCompleted) completedQuestionsCount++;

    return {
      ...q,
      clicked_at: comp?.clicked_at || null,
      is_completed: isCompleted,
      completed_at: comp?.completed_at || (isHackerRankSolved ? hr?.last_submission_at : null),
      score: hr?.score || 0,
    };
  });

  // Auto-extension check if trainer reaches end of planned days with remaining questions
  const allowedTotalDays = totalPlannedDays + extendedDays;
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
          current_day: currentDay,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('roadmap_id', roadmapId);

      // Send auto-extension notification
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
  } else if (progress && progress.current_day !== currentDay) {
    await dbAdmin
      .from('it_trainer_progress')
      .update({
        current_day: currentDay,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('roadmap_id', roadmapId);
  }

  // 5. Structure all day plans with questions and calculated dates
  const dayPlansWithDates = attachDatesToDayPlans(
    rawDayPlans.map((dp: any) => ({
      ...dp,
      questions: questionsWithState.filter((q: any) => q.day_plan_id === dp.id),
      is_unlocked: dp.day_number <= unlockedDayNumber,
    })),
    startedAt,
    workingDays
  );

  // 6. Partition into Today's Plan and Pending Questions
  // If checked in today -> todayPlan is currentDay's plan
  // If not checked in today -> todayPlan is null (gate rendered in UI), pendingByDay contains uncompleted questions from days 1..unlockedDayNumber
  const todayPlan = isITCountedToday ? (dayPlansWithDates.find((dp) => dp.day_number === currentDay) || null) : null;
  const nextPlanPreview = needsCheckInToday ? (dayPlansWithDates.find((dp) => dp.day_number === nextDayToUnlock) || null) : null;

  // Previous unlocked days with uncompleted questions
  const unlockedDays = dayPlansWithDates.filter((dp) => dp.day_number <= (isITCountedToday ? currentDay - 1 : unlockedDayNumber));
  const pendingByDay = unlockedDays
    .map((dp) => ({
      ...dp,
      questions: dp.questions.filter((q: any) => !q.is_completed),
    }))
    .filter((dp) => dp.questions.length > 0);

  const pendingQuestionsCount = pendingByDay.reduce((acc, dp) => acc + dp.questions.length, 0);

  return NextResponse.json({
    roadmap,
    config,
    progress: {
      user_id: user.id,
      roadmap_id: roadmapId,
      started_at: startedAt,
      current_day: currentDay,
      unlocked_day_number: unlockedDayNumber,
      next_day_to_unlock: nextDayToUnlock,
      total_days: totalPlannedDays,
      extended_days: extendedDays,
      extension_count: extensionCount,
      completed_questions_count: completedQuestionsCount,
      total_questions_count: totalQuestionsCount,
      pending_questions_count: pendingQuestionsCount,
      needs_check_in_today: needsCheckInToday,
    },
    todayPlan,
    nextPlanPreview,
    pendingByDay,
    allDays: dayPlansWithDates,
    itDaysCount,
    isITCountedToday,
    needsCheckInToday,
    nextDayToUnlock,
    today,
  });
}
