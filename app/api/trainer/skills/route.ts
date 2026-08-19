import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();

  // 1. Fetch user profile
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, full_name, team, role')
    .eq('id', user.id)
    .single();

  // 2. Fetch user's question progress
  const { data: progressData } = await supabase
    .from('progress')
    .select('question_id, status, score')
    .eq('user_id', user.id);

  const solvedQuestionIds = new Set<string>();
  (progressData || []).forEach(p => {
    if (p.status === 'solved' || (p.score && p.score > 0)) {
      solvedQuestionIds.add(p.question_id);
    }
  });

  // 3. Fetch all questions grouped by domain
  const { data: allQuestions } = await supabase
    .from('questions')
    .select('id, contest_id, domain, title');

  const domainMap: Record<string, { title: string; total: number; solved: number; questionIds: Set<string> }> = {};

  (allQuestions || []).forEach(q => {
    const rawDomain = (q.domain || 'General').trim();
    if (!domainMap[rawDomain]) {
      domainMap[rawDomain] = { title: rawDomain, total: 0, solved: 0, questionIds: new Set() };
    }
    if (!domainMap[rawDomain].questionIds.has(q.id)) {
      domainMap[rawDomain].questionIds.add(q.id);
      domainMap[rawDomain].total += 1;
      if (solvedQuestionIds.has(q.id)) {
        domainMap[rawDomain].solved += 1;
      }
    }
  });

  // 4. Also incorporate roadmap topics
  const { data: roadmaps } = await supabase.from('roadmaps').select('*');
  (roadmaps || []).forEach(rm => {
    const topics = rm.topics || [];
    topics.forEach((t: any) => {
      const topicName = (t.title || t.name || t.domain || 'General Topic').trim();
      if (!domainMap[topicName]) {
        domainMap[topicName] = { title: topicName, total: 0, solved: 0, questionIds: new Set() };
      }
      const questions = t.questions || [];
      if (Array.isArray(questions) && questions.length > 0) {
        questions.forEach((q: any) => {
          const qId = q.question_id || q.id;
          if (qId && !domainMap[topicName].questionIds.has(qId)) {
            domainMap[topicName].questionIds.add(qId);
            domainMap[topicName].total += 1;
            if (solvedQuestionIds.has(qId)) {
              domainMap[topicName].solved += 1;
            }
          }
        });
      }
    });
  });

  // 5. Fetch Contests and assigned questions for Contest Champion badges
  const { data: contests } = await supabase
    .from('contests')
    .select('id, title, hackerrank_slug, created_at');

  const contestBadgesRaw = (contests || []).map(c => {
    const contestQuestions = (allQuestions || []).filter(q => q.contest_id === c.id);
    const total = contestQuestions.length;
    let solved = 0;
    contestQuestions.forEach(q => {
      if (solvedQuestionIds.has(q.id)) solved++;
    });

    const isCompleted = total > 0 && solved >= total;
    return {
      id: `contest_${c.id}`,
      title: c.title,
      type: 'contest' as const,
      total,
      solved,
      pct: total > 0 ? Math.round((solved / total) * 100) : 0,
      isCompleted,
      badgeName: `👑 Contest Champion: ${c.title}`,
      badgeIcon: '👑',
      badgeCategory: 'Contest Mastery',
    };
  });

  const topicBadgesRaw = Object.values(domainMap).map(t => {
    const isCompleted = t.total > 0 && t.solved >= t.total;
    const pct = t.total > 0 ? Math.round((t.solved / t.total) * 100) : 0;

    let badgeIcon = '🏆';
    const lower = t.title.toLowerCase();
    if (lower.includes('linked list') || lower.includes('linkedlist')) badgeIcon = '🔗';
    else if (lower.includes('array') || lower.includes('matrix')) badgeIcon = '⚡';
    else if (lower.includes('tree') || lower.includes('graph')) badgeIcon = '🌳';
    else if (lower.includes('recursion') || lower.includes('backtrack')) badgeIcon = '🔄';
    else if (lower.includes('string')) badgeIcon = '🔤';
    else if (lower.includes('stack') || lower.includes('queue')) badgeIcon = '📚';
    else if (lower.includes('dynamic') || lower.includes('dp')) badgeIcon = '🧠';
    else if (lower.includes('loop') || lower.includes('flow')) badgeIcon = '🔥';
    else if (lower.includes('sort') || lower.includes('search')) badgeIcon = '🔍';
    else if (lower.includes('math')) badgeIcon = '🔢';
    else if (lower.includes('bit')) badgeIcon = '⚙️';

    return {
      id: `topic_${t.title.replace(/\s+/g, '_')}`,
      title: t.title,
      type: 'topic' as const,
      total: t.total,
      solved: t.solved,
      pct,
      isCompleted,
      badgeName: `${badgeIcon} ${t.title} Master`,
      badgeIcon,
      badgeCategory: 'Topic Skill',
    };
  });

  // ONLY topics/contests where 100% of problems are solved are returned as EARNED BADGES!
  const earnedTopicBadges = topicBadgesRaw.filter(b => b.isCompleted);
  const earnedContestBadges = contestBadgesRaw.filter(b => b.isCompleted);

  // In-progress topics for training goals
  const inProgressTopics = topicBadgesRaw.filter(b => !b.isCompleted && b.solved > 0);
  const lockedTopics = topicBadgesRaw.filter(b => b.solved === 0);

  const allBadgesCombined = [
    ...topicBadgesRaw,
    ...contestBadgesRaw,
  ];

  return NextResponse.json({
    user: userProfile,
    totalSolved: solvedQuestionIds.size,
    totalQuestions: allQuestions?.length || 0,
    topicBadges: earnedTopicBadges,
    contestBadges: earnedContestBadges,
    inProgressTopics,
    lockedTopics,
    allBadges: allBadgesCombined,
    allTopicsCount: topicBadgesRaw.length,
  });
}
