import { NextResponse } from 'next/server';
import { parseLeetcodeUsername, fetchProfileStats } from '@/lib/leetcode';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  const excludeUserId = searchParams.get('excludeUserId');

  if (!username || username.trim() === '') {
    return NextResponse.json({ valid: true });
  }

  const clean = parseLeetcodeUsername(username);
  if (!clean || ['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(clean.toLowerCase())) {
    return NextResponse.json({ valid: true });
  }

  try {
    // 1. Uniqueness check against other users in LMS database
    const dbAdmin = getAdminClient();
    let duplicateQuery = dbAdmin
      .from('users')
      .select('id, full_name, email, leetcode_id')
      .ilike('leetcode_id', clean);

    if (excludeUserId) {
      duplicateQuery = duplicateQuery.neq('id', excludeUserId);
    }

    const { data: existingUsers, error: dupErr } = await duplicateQuery;
    if (!dupErr && existingUsers && existingUsers.length > 0) {
      const match = existingUsers[0];
      return NextResponse.json({
        valid: false,
        isDuplicate: true,
        error: `LeetCode ID "${clean}" is already linked to user "${match.full_name}" (${match.email}). Each user must have a unique LeetCode account.`,
      });
    }

    // 2. Fetch and verify profile on LeetCode
    const profile = await fetchProfileStats(clean);
    if (!profile.found) {
      return NextResponse.json({
        valid: false,
        error: `LeetCode profile "${clean}" does not exist on LeetCode. Please check the spelling.`,
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
    return NextResponse.json({
      valid: true,
      username: clean,
      warning: 'Could not verify with LeetCode API at this moment.',
    });
  }
}
