'use client';

import { useGlobalPresence, PresenceUser, PresenceProvider } from '@/components/PresenceProvider';

export type { PresenceUser };
export { PresenceProvider, useGlobalPresence };

/**
 * Custom React hook for Supabase Realtime Presence.
 * Consumes the global PresenceProvider state to return a Set of active online user IDs across the LMS.
 */
export function usePresence(_currentUser?: { id: string; full_name?: string; role?: string } | null) {
  const { onlineUserIds } = useGlobalPresence();
  return onlineUserIds;
}

