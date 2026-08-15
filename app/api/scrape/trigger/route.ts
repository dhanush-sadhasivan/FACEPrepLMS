import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
  }

  const { data: profile } = await supabaseServer
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden: Only managers and admins can trigger progress scraping.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const contestId = searchParams.get('contestId');

  if (!contestId) {
    return NextResponse.json({ error: 'contestId query parameter is required' }, { status: 400 });
  }

  console.log(`[scrape/trigger] Triggering progress scrape for contest: ${contestId}`);

  // Use Admin Client to ensure queries work smoothly without RLS / cookie blocks
  const supabase = getAdminClient();

  // 1. Fetch contest
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .single();

  if (contestError || !contest) {
    console.error(`[scrape/trigger] Contest not found: ${contestError?.message}`);
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
  }

  // 2. Fetch questions
  const { data: questions } = await supabase
    .from('questions')
    .select('id, slug, title, max_score, domain')
    .eq('contest_id', contestId);

  const questionCount = questions?.length ?? 0;
  console.log(`[scrape/trigger] Found ${questionCount} questions for contest "${contest.title}"`);

  if (questionCount === 0) {
    return NextResponse.json(
      { error: 'This contest has no questions. Create or re-scrape the contest first.' },
      { status: 400 }
    );
  }

  // 3. Fetch assignments (group_id or team text)
  const { data: assignments } = await supabase
    .from('contest_assignments')
    .select('group_id, team')
    .eq('contest_id', contestId);

  const groupIds: string[] = [];
  const teams: string[] = [];

  (assignments || []).forEach((a: { group_id: string | null; team: string | null }) => {
    if (a.group_id) groupIds.push(a.group_id);
    if (a.team) teams.push(a.team);
  });

  console.log(`[scrape/trigger] Assignments: ${groupIds.length} groups, ${teams.length} teams`);

  if (groupIds.length === 0 && teams.length === 0) {
    return NextResponse.json(
      { error: 'No groups or teams are assigned to this contest. Edit the contest to assign groups/teams first.' },
      { status: 400 }
    );
  }

  // 4. Collect user IDs from assigned groups/teams AND all users with HackerRank IDs
  const userIds = new Set<string>();

  if (groupIds.length > 0) {
    const { data: groupMembers } = await supabase
      .from('group_members')
      .select('user_id')
      .in('group_id', groupIds);
    (groupMembers || []).forEach((gm: { user_id: string }) => userIds.add(gm.user_id));
  }

  if (teams.length > 0) {
    const { data: teamUsers } = await supabase
      .from('users')
      .select('id')
      .in('team', teams);
    (teamUsers || []).forEach((u: { id: string }) => userIds.add(u.id));
  }

  // Also include all users with configured hackerrank_id so every trainer gets updated
  const { data: allHkUsers } = await supabase
    .from('users')
    .select('id')
    .neq('role', 'admin')
    .not('hackerrank_id', 'is', null);

  (allHkUsers || []).forEach((u: { id: string }) => userIds.add(u.id));

  console.log(`[scrape/trigger] Total target user IDs to scrape: ${userIds.size}`);

  if (userIds.size === 0) {
    return NextResponse.json(
      { error: 'No users with a HackerRank ID configured found in the database.' },
      { status: 400 }
    );
  }

  // 5. Fetch hackerrank_ids for collected users
  const { data: users } = await supabase
    .from('users')
    .select('id, hackerrank_id')
    .in('id', Array.from(userIds))
    .not('hackerrank_id', 'is', null);

  const validUsers = (users || []).filter(u => u.hackerrank_id && u.hackerrank_id.trim() !== '');

  if (validUsers.length === 0) {
    return NextResponse.json(
      { error: 'None of the target users have a valid HackerRank ID configured. Update user profiles first.' },
      { status: 400 }
    );
  }

  console.log(`[scrape/trigger] Sending ${validUsers.length} user(s) to scraper for contest "${contest.hackerrank_slug}"`);

  // 6. Trigger Railway scraper
  const scraperUrl = process.env.RAILWAY_SCRAPER_URL;
  if (!scraperUrl) {
    console.error('[scrape/trigger] RAILWAY_SCRAPER_URL not configured');
    return NextResponse.json(
      { error: 'Scraper service URL is not configured in Vercel environment variables (RAILWAY_SCRAPER_URL).' },
      { status: 500 }
    );
  }

  try {
    const cleanScraperUrl = scraperUrl.trim().replace(/\/$/, '');

    // Map questions to the format the scraper expects
    const scraperQuestions = (questions || []).map((q: any) => ({
      slug: q.slug,
      questionName: q.title,
      maxScore: q.max_score || 10,
    }));

    const res = await fetch(`${cleanScraperUrl}/scrape/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.RAILWAY_API_KEY || '',
      },
      body: JSON.stringify({
        contestId,
        contestSlug: contest.hackerrank_slug,
        questions: scraperQuestions,
        users: validUsers.map((u: { id: string; hackerrank_id: string }) => ({
          user_id: u.id,
          hackerrank_id: u.hackerrank_id,
        })),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[scrape/trigger] Scraper returned ${res.status}: ${errorText}`);
      let errorMessage = `Scraper service returned HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.error) errorMessage = errJson.error;
      } catch {}
      return NextResponse.json({ error: `Scraper error: ${errorMessage}` }, { status: res.status });
    }

    const result = await res.json();
    console.log(`[scrape/trigger] Scrape started successfully:`, result);

    // Update last_scraped_at timestamp
    await supabase
      .from('contests')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', contestId);

    return NextResponse.json({
      status: 'scraping_started',
      jobId: result.jobId || null,
      userCount: validUsers.length,
      questionCount,
      message: `Progress scrape started for ${validUsers.length} user(s) across ${questionCount} question(s). Results will appear shortly.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[scrape/trigger] Error: ${message}`);
    return NextResponse.json({ error: `Failed to start progress scrape: ${message}` }, { status: 500 });
  }
}
