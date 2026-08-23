import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import ReportsHubClient from './ReportsHubClient';
import TrainerPersonalReportView from './TrainerPersonalReportView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const dbAdmin = getAdminClient();

  const { data: profile } = await dbAdmin
    .from('users')
    .select('id, full_name, emp_id, email, team, manager, hackerrank_id, role, it_days_count, last_it_check_date')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  const role = profile.role || 'trainer';
  const isAdminOrManager = role === 'admin' || role === 'manager';

  if (!isAdminOrManager) {
    // Fetch personal scorecard data for Trainer
    const [
      progressRes,
      contestsRes,
      questionsRes,
      roadmapsRes,
      userRoadmapRes,
      coursesRes,
      todosRes,
    ] = await Promise.all([
      dbAdmin.from('progress').select('*').eq('user_id', user.id),
      dbAdmin.from('contests').select('*'),
      dbAdmin.from('questions').select('*'),
      dbAdmin.from('roadmaps').select('*'),
      dbAdmin.from('user_roadmap_progress').select('*').eq('user_id', user.id),
      dbAdmin.from('course_assignments').select('*, course:courses(*)').eq('user_id', user.id),
      dbAdmin.from('trainer_todos').select('*').eq('user_id', user.id),
    ]);

    const progress = progressRes.data || [];
    const contests = contestsRes.data || [];
    const questions = questionsRes.data || [];
    const roadmaps = roadmapsRes.data || [];
    const userRoadmaps = userRoadmapRes.data || [];
    const courses = coursesRes.data || [];
    const todos = todosRes.data || [];

    const contestBreakdown = contests.map((c: any) => {
      const cQs = questions.filter((q: any) => q.contest_id === c.id);
      const userQs = progress.filter((p: any) => p.contest_id === c.id);
      const solved = userQs.filter((p: any) => p.status === 'solved' || p.score > 0).length;
      const score = userQs.reduce((acc: number, p: any) => acc + (p.score || 0), 0);
      const maxScore = cQs.reduce((acc: number, q: any) => acc + (q.max_score || 10), 0);

      return {
        contestId: c.id,
        title: c.title,
        hackerrankSlug: c.hackerrank_slug,
        solvedCount: solved,
        totalQuestions: cQs.length,
        completionPct: cQs.length > 0 ? Math.round((solved / cQs.length) * 100) : 0,
        score,
        maxScore,
      };
    }).filter((c: any) => c.score > 0 || c.solvedCount > 0);

    const roadmapBreakdown = roadmaps.map((r: any) => {
      const rp = userRoadmaps.find((up: any) => up.roadmap_id === r.id);
      const completedTopics = (rp?.completed_topic_ids || []).length;
      const totalTopics = (r.topics || []).length;

      return {
        roadmapId: r.id,
        title: r.title,
        domain: r.domain,
        level: r.level,
        completedTopics,
        totalTopics,
        completionPct: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
        status: rp?.status || 'not_started',
      };
    });

    const totalScore = progress.reduce((acc: number, p: any) => acc + (p.score || 0), 0);
    const totalSolved = progress.filter((p: any) => p.status === 'solved' || p.score > 0).length;
    const itDays = profile.it_days_count || 0;
    const completedRoadmaps = roadmapBreakdown.filter((r: any) => r.status === 'completed').length;
    const completedTodos = todos.filter((t: any) => t.is_completed).length;

    const personalData = {
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        empId: profile.emp_id,
        email: profile.email,
        team: profile.team,
        manager: profile.manager,
        hackerrankId: profile.hackerrank_id,
        itDaysCount: itDays,
        lastItCheckDate: profile.last_it_check_date,
      },
      summary: {
        totalScore,
        totalSolved,
        itDaysCount: itDays,
        contestsMastered: contestBreakdown.filter((c: any) => c.completionPct >= 100).length,
        roadmapsCompleted: completedRoadmaps,
        todosCompleted: completedTodos,
        totalTodos: todos.length,
      },
      contests: contestBreakdown,
      roadmaps: roadmapBreakdown,
      courses: courses.map((ca: any) => ({
        courseId: ca.course?.id,
        title: ca.course?.title,
        category: ca.course?.category,
        level: ca.course?.level,
        dueDate: ca.due_date,
      })),
    };

    return <TrainerPersonalReportView data={personalData} />;
  }

  return <ReportsHubClient userRole={role} />;
}
