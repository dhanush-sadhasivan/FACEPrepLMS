import { NextResponse } from 'next/server';
import { parseHackerrankUsername } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ valid: true });
  }

  const clean = parseHackerrankUsername(username);
  if (!clean) {
    return NextResponse.json({ valid: true });
  }

  try {
    const res = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(clean)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.status === 404) {
      return NextResponse.json({
        valid: false,
        error: `HackerRank username "${clean}" was not found on HackerRank. Please verify the handle.`,
      });
    }

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.model?.username || data?.model?.id) {
        return NextResponse.json({ valid: true, username: data.model.username || clean });
      }
      if (data?.status === false && data?.message) {
        return NextResponse.json({
          valid: false,
          error: `HackerRank username "${clean}" does not exist on HackerRank.`,
        });
      }
    }
  } catch (err: any) {
    console.warn(`[validate-hackerrank] Check failed for ${clean}:`, err.message);
  }

  // Graceful fallback for rate limits or anti-bot responses
  return NextResponse.json({ valid: true, username: clean, warning: 'HackerRank handle saved.' });
}
