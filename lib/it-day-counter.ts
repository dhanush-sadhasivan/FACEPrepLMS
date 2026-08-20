import { getAdminClient } from '@/lib/supabase/admin';
import { formatISODate } from '@/lib/it-calendar';

export interface ITAttendanceResult {
  success: boolean;
  newCount: number;
  alreadyCountedToday: boolean;
  today: string;
}

/**
 * Records or updates IT attendance for a trainer on a given date (defaults to today).
 * If already counted for today and didIT is true, does not double-count.
 */
export async function recordITAttendance(
  userId: string,
  didIT: boolean
): Promise<ITAttendanceResult> {
  const supabase = getAdminClient();
  const today = formatISODate(new Date());

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('Trainer profile not found');
  }

  // Fetch auth user data to get user_metadata as source of truth
  const { data: authUserData } = await supabase.auth.admin.getUserById(userId);
  const metadata = authUserData?.user?.user_metadata || {};

  const lastCheckedDate = profile.last_it_check_date || metadata.last_it_check_date || null;
  const currentCount = Math.max(profile.it_days_count || 0, metadata.it_days_count || 0);
  const alreadyCountedToday = lastCheckedDate === today;

  let newCount = currentCount;
  if (didIT) {
    if (!alreadyCountedToday) {
      newCount = currentCount + 1;
    }
  }

  // Update auth metadata
  try {
    if (authUserData?.user) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...metadata,
          it_days_count: newCount,
          last_it_check_date: today,
        },
      });
    }
  } catch (err) {
    console.error('Error updating auth metadata for it_days_count:', err);
  }

  // Try updating users table if column exists
  try {
    await supabase
      .from('users')
      .update({
        it_days_count: newCount,
        last_it_check_date: today,
      })
      .eq('id', userId);
  } catch (err) {
    // silently catch if columns are not present on users table
  }

  return {
    success: true,
    newCount,
    alreadyCountedToday,
    today,
  };
}

