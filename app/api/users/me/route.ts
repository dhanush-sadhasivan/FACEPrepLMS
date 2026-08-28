import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { parseHackerrankUsername, sanitizeField } from '@/lib/utils';
import { parseLeetcodeUsername } from '@/lib/leetcode';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({
      error: 'Direct profile edits are disabled for account integrity. Please submit a Profile Change Request via the Support Ticket button on your Profile page.',
    }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { full_name, emp_email, hackerrank_id, leetcode_id } = body;

    const cleanName = sanitizeField(full_name);
    const cleanEmpEmail = sanitizeField(emp_email);
    const cleanHr = parseHackerrankUsername(hackerrank_id);
    const cleanLc = parseLeetcodeUsername(leetcode_id);

    if (!cleanName) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // Check LeetCode ID uniqueness if setting a handle
    if (cleanLc) {
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .ilike('leetcode_id', cleanLc)
        .neq('id', user.id);

      if (existing && existing.length > 0) {
        const match = existing[0];
        return NextResponse.json({
          error: `LeetCode ID "${cleanLc}" is already linked to user "${match.full_name}" (${match.email}). Each user must have a unique LeetCode account.`,
        }, { status: 409 });
      }
    }

    const updatePayload: Record<string, any> = {
      full_name: cleanName,
      emp_email: cleanEmpEmail,
      hackerrank_id: cleanHr,
      leetcode_id: cleanLc,
    };

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .single();
      
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Refresh CDN cache & purge page caches in background so changes reflect across LMS
    try {
      generateAndUploadCdnSnapshots().catch(() => {});
      revalidateTag('leaderboard', 'max');
      revalidateTag('global-stats', 'max');
      revalidatePath('/profile');
      revalidatePath('/dashboard');
      revalidatePath('/contests');
      revalidatePath('/admin/users');
    } catch {}

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update profile' }, { status: 500 });
  }
}
