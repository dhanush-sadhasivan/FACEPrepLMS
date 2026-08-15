import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: 'Forbidden: Only managers and admins can trigger question scraping.' }, { status: 403 });
    }
    // Accept either { slug } or { slug, contestId }
    // If contestId is provided, it's passed to the scraper so it can write
    // questions directly to Supabase without doing its own lookup.
    const { slug, contestId } = await request.json();

    if (!slug) {
      return NextResponse.json({ error: 'Contest slug is required' }, { status: 400 });
    }

    // If contestId was not provided, look it up by slug so we can pass it to the scraper.
    let resolvedContestId = contestId;
    if (!resolvedContestId) {
      const supabase = getAdminClient();
      const { data: contest } = await supabase
        .from('contests')
        .select('id')
        .eq('hackerrank_slug', slug)
        .maybeSingle();
      resolvedContestId = contest?.id ?? null;
    }

    const scraperUrl = process.env.RAILWAY_SCRAPER_URL;
    if (!scraperUrl) {
      return NextResponse.json(
        { error: 'RAILWAY_SCRAPER_URL is not configured. Set it in .env.local (e.g. http://localhost:3001)' },
        { status: 500 }
      );
    }

    console.log(`[scrape/challenges] Requesting scraper: ${scraperUrl}/scrape/challenges with slug="${slug}", contestId="${resolvedContestId}"`);

    const res = await fetch(`${scraperUrl}/scrape/challenges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.RAILWAY_API_KEY || '',
      },
      // Pass contestId so the scraper writes directly to Supabase
      body: JSON.stringify({ slug, contestId: resolvedContestId }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[scrape/challenges] Scraper returned ${res.status}: ${errorText}`);
      return NextResponse.json(
        { error: `Scraper failed (HTTP ${res.status}): ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Log response shape for debugging
    const qCount = data.questions?.length ?? 0;
    console.log(`[scrape/challenges] Scraper returned ${qCount} question(s). Keys: ${Object.keys(data).join(', ')}`);
    if (qCount > 0) {
      const sample = data.questions?.[0];
      console.log(`[scrape/challenges] Sample question fields: ${Object.keys(sample).join(', ')}`);
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[scrape/challenges] Exception: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
