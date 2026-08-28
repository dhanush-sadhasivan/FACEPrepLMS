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

  // 1.5 Handle LeetCode platform contests via native LeetCode sync engine
  if (contest.platform === 'leetcode') {
    console.log(`[scrape/trigger] Contest "${contest.title}" is a LeetCode contest. Routing to LeetCode sync engine...`);
    try {
      const { syncLeetCodeContest } = await import('@/lib/leetcode-sync');
      const result = await syncLeetCodeContest(contestId);
      return NextResponse.json({
        status: 'completed',
        platform: 'leetcode',
        syncedCount: result.syncedCount,
        totalNewlySolved: result.totalNewlySolved,
        message: result.message,
      });
    } catch (lcErr: any) {
      console.error(`[scrape/trigger] LeetCode sync error:`, lcErr);
      return NextResponse.json({ error: lcErr.message || 'LeetCode sync failed' }, { status: 500 });
    }
  }

  // 2. Fetch enabled questions
  let questionsData: any[] | null = null;
  const { data: filteredQs, error: qErr } = await supabase
    .from('questions')
    .select('id, slug, title, max_score, domain, is_enabled')
    .eq('contest_id', contestId)
    .neq('is_enabled', false);

  if (qErr || !filteredQs) {
    // Fallback if is_enabled column does not exist in DB schema yet
    const { data: allQs } = await supabase
      .from('questions')
      .select('id, slug, title, max_score, domain')
      .eq('contest_id', contestId);
    questionsData = allQs || [];
  } else {
    questionsData = filteredQs;
  }

  const questions = questionsData;

  const questionCount = questions?.length ?? 0;
  console.log(`[scrape/trigger] Found ${questionCount} questions for contest "${contest.title}"`);

  if (questionCount === 0) {
    return NextResponse.json(
      { error: 'This contest has no questions in DB. Create or re-scrape the contest first.' },
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

  // 4. Collect user IDs from assigned groups/teams only
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

  console.log(`[scrape/trigger] Total assigned user IDs to scrape: ${userIds.size}`);

  if (userIds.size === 0) {
    return NextResponse.json(
      { error: 'No trainers found in the groups or teams assigned to this contest.' },
      { status: 400 }
    );
  }

  // 5. Fetch hackerrank_ids for assigned users (excluding admin accounts)
  const { data: users } = await supabase
    .from('users')
    .select('id, hackerrank_id, role')
    .in('id', Array.from(userIds))
    .neq('role', 'admin')
    .not('hackerrank_id', 'is', null);

  const validUsers = (users || []).filter(u => u.hackerrank_id && u.hackerrank_id.trim() !== '');

  if (validUsers.length === 0) {
    return NextResponse.json(
      { error: 'None of the trainers assigned to this contest have a valid HackerRank ID configured. Update user profiles first.' },
      { status: 400 }
    );
  }

  console.log(`[scrape/trigger] Sending ${validUsers.length} assigned user(s) to scraper for contest "${contest.hackerrank_slug}"`);

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

    const scraperQuestions = (questions || []).map((q: any) => ({
      slug: q.slug,
      questionName: q.title,
      maxScore: q.max_score || 10,
    }));

    const scrapePayload = {
      contestId,
      contestSlug: contest.hackerrank_slug,
      questions: scraperQuestions,
      users: validUsers.map((u: { id: string; hackerrank_id: string }) => ({
        user_id: u.id,
        hackerrank_id: u.hackerrank_id,
      })),
    };

    let res = await fetch(`${cleanScraperUrl}/scrape/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.RAILWAY_API_KEY || '',
      },
      body: JSON.stringify(scrapePayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[scrape/trigger] Scraper returned ${res.status}: ${errorText}`);

      // Auto-healing fallback: If contest not registered in scraper DB, register it via /scrape/challenges first
      if (errorText.includes('not found in database') || errorText.includes('Create it first')) {
        console.log(`[scrape/trigger] Auto-registering contest "${contest.hackerrank_slug}" with scraper...`);
        const registerRes = await fetch(`${cleanScraperUrl}/scrape/challenges`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.RAILWAY_API_KEY || '',
          },
          body: JSON.stringify({ slug: contest.hackerrank_slug, contestId }),
        });

        if (registerRes.ok) {
          console.log(`[scrape/trigger] Successfully registered contest "${contest.hackerrank_slug}". Retrying progress scrape...`);
          res = await fetch(`${cleanScraperUrl}/scrape/progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.RAILWAY_API_KEY || '',
            },
            body: JSON.stringify(scrapePayload),
          });
        }
      }

      if (!res.ok) {
        let errorMessage = `Scraper service returned HTTP ${res.status}`;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.error) errorMessage = errJson.error;
        } catch {}
        return NextResponse.json({ error: `Scraper error: ${errorMessage}` }, { status: res.status });
      }
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
