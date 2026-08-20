import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/scrape/status?jobId=...
 * Proxies to the Railway scraper's job status endpoint.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId query parameter is required' }, { status: 400 });
  }

  const scraperUrl = process.env.RAILWAY_SCRAPER_URL;
  if (!scraperUrl) {
    return NextResponse.json(
      { error: 'RAILWAY_SCRAPER_URL is not configured' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${scraperUrl}/scrape/status/${jobId}`, {
      headers: {
        'x-api-key': process.env.RAILWAY_API_KEY || '',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `Scraper status check failed (HTTP ${res.status}): ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to check scrape status: ${message}` },
      { status: 500 }
    );
  }
}
