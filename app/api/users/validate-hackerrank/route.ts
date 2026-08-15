import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');

  if (!username || username.trim() === '') {
    return NextResponse.json({ valid: true });
  }

  const clean = username.trim();
  if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(clean.toLowerCase())) {
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
        error: `HackerRank username "${clean}" was not found on HackerRank. Please verify the handle.`
      });
    }

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.model?.username || data?.model?.id) {
        return NextResponse.json({ valid: true, username: data.model.username });
      }
      if (data?.status === false || !data?.model) {
        return NextResponse.json({
          valid: false,
          error: `HackerRank username "${clean}" does not exist on HackerRank.`
        });
      }
    }
  } catch (err: any) {
    console.warn(`[validate-hackerrank] Check failed for ${clean}:`, err.message);
  }

  return NextResponse.json({ valid: true });
}
