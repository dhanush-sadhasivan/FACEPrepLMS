import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseHackerrankUsername, sanitizeField } from '@/lib/utils';
import { parseLeetcodeUsername } from '@/lib/leetcode';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';
import { revalidatePath, revalidateTag } from 'next/cache';

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const { full_name, emp_id, emp_email, email, role, team, manager, hackerrank_id, leetcode_id } = body;

    const cleanName = sanitizeField(full_name);
    const cleanEmpId = sanitizeField(emp_id);
    const cleanEmpEmail = sanitizeField(emp_email);
    const cleanEmail = sanitizeField(email);
    const cleanTeam = sanitizeField(team);
    const cleanManager = sanitizeField(manager);
    const cleanHr = parseHackerrankUsername(hackerrank_id);
    const cleanLc = parseLeetcodeUsername(leetcode_id);

    if (!cleanName || !cleanEmpId) {
      return NextResponse.json({ error: 'Full name and Employee ID are required.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      full_name: cleanName,
      emp_id: cleanEmpId,
      team: cleanTeam,
      manager: cleanManager,
      hackerrank_id: cleanHr,
      leetcode_id: cleanLc,
      updated_by: user.id,
      updated_at: now,
    };

    // Restrict role modification exclusively to Admins
    if (role) {
      if (caller?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Only Admins can modify user roles.' }, { status: 403 });
      }
      if (['admin', 'manager', 'trainer'].includes(role.toLowerCase())) {
        updatePayload.role = role.toLowerCase();
      }
    }

    if (cleanEmpEmail !== undefined) {
      updatePayload.emp_email = cleanEmpEmail;
    }

    const supabaseAdmin = getAdminClient();

    // Verify LeetCode uniqueness across other users
    if (cleanLc) {
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .ilike('leetcode_id', cleanLc)
        .neq('id', id);

      if (existing && existing.length > 0) {
        const match = existing[0];
        return NextResponse.json({
          error: `LeetCode ID "${cleanLc}" is already assigned to user "${match.full_name}" (${match.email}). Each user must have a unique LeetCode account.`,
        }, { status: 409 });
      }
    }

    // If email is provided, also sync email to auth.users and public.users
    if (cleanEmail) {
      updatePayload.email = cleanEmail;
      try {
        await supabaseAdmin.auth.admin.updateUserById(id, { email: cleanEmail });
      } catch (authErr: any) {
        console.warn(`[users/[id]] Auth email update error for ${id}:`, authErr.message);
      }
    }

    let { data, error } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select('*, updater:users!updated_by(id, full_name, role)')
      .single();

    // If update or select failed due to missing updated_at / updated_by columns or updater join
    if (error) {
      if (
        error.message?.includes('updated_at') ||
        error.message?.includes('updated_by') ||
        error.code === 'PGRST204' ||
        error.code === 'PGRST200' ||
        error.code === '42703'
      ) {
        console.warn(`[users/[id]] update failed with audit fields (${error.message}), retrying without audit fields...`);
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.updated_by;
        delete fallbackPayload.updated_at;

        const fallbackRes = await supabaseAdmin
          .from('users')
          .update(fallbackPayload)
          .eq('id', id)
          .select('*')
          .single();

        data = fallbackRes.data;
        error = fallbackRes.error;
      }
    }

    if (error) {
      console.error('[users/[id]-patch] DB Error:', error.message);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 400 });
    }

    // Refresh CDN snapshots in background so updated details reflect across the LMS
    try {
      generateAndUploadCdnSnapshots().catch(() => {});
      revalidateTag('leaderboard', 'max');
      revalidateTag('global-stats', 'max');
      revalidatePath('/admin/users');
      revalidatePath('/profile');
      revalidatePath('/dashboard');
      revalidatePath('/contests');
    } catch {}

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[users/[id]-patch] Internal Error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Restrict user deletion exclusively to Admins
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Only Admins can delete users.' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const supabaseAdmin = getAdminClient();
    const { error: dbError } = await supabaseAdmin.from('users').delete().eq('id', id);
    if (dbError) throw dbError;
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;

    // Refresh CDN snapshots in background
    try {
      generateAndUploadCdnSnapshots().catch(() => {});
      revalidateTag('leaderboard', 'max');
      revalidateTag('global-stats', 'max');
      revalidatePath('/admin/users');
      revalidatePath('/dashboard');
      revalidatePath('/contests');
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[users/[id]-delete] Internal Error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
