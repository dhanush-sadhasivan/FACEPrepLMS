import { NextResponse } from 'next/server';
import { parseLeetcodeUsername, fetchProfileStats } from '@/lib/leetcode';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');

  if (!username || username.trim() === '') {
    return NextResponse.json({ valid: true });
  }

  const clean = parseLeetcodeUsername(username);
  if (!clean || ['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(clean.toLowerCase())) {
    return NextResponse.json({ valid: true });
  }

  try {
    const profile = await fetchProfileStats(clean);
    if (!profile.found) {
      return NextResponse.json({
        valid: false,
        error: `LeetCode profile "${clean}" does not exist or is private.`,
      });
    }

    return NextResponse.json({
      valid: true,
      username: profile.username,
      ranking: profile.ranking,
      solvedTotal: profile.solved.total,
      avatar: profile.avatar,
    });
  } catch (err: any) {
    console.warn(`[validate-leetcode] Check error for ${clean}:`, err.message);
    // If rate-limited or transient network failure, don't completely block user save
    return NextResponse.json({ valid: true, warning: 'Could not verify at this moment.' });
  }
}
