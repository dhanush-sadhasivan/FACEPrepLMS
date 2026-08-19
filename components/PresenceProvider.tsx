'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PresenceUser {
  user_id: string;
  full_name: string;
  role: string;
  online_at: string;
}

interface PresenceContextType {
  onlineUserIds: Set<string>;
  isOnline: (userId: string) => boolean;
  onlineCount: number;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineUserIds: new Set<string>(),
  isOnline: () => false,
  onlineCount: 0,
});

interface PresenceProviderProps {
  currentUser?: {
    id: string;
    full_name?: string;
    role?: string;
  } | null;
  children: React.ReactNode;
}

export function PresenceProvider({ currentUser, children }: PresenceProviderProps) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!currentUser?.id) return;

    const supabase = createClient();
    const channelName = 'internal-training-presence';
    const normalizedUserId = currentUser.id.toLowerCase().trim();

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: normalizedUserId,
        },
      },
    });
    channelRef.current = channel;

    const updatePresenceState = () => {
      const state = channel.presenceState();
      const ids = new Set<string>();

      Object.keys(state).forEach((key) => {
        const cleanKey = key.toLowerCase().trim();
        ids.add(cleanKey);

        const presences = state[key] as any[];
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p.user_id) {
              ids.add(String(p.user_id).toLowerCase().trim());
            }
          });
        }
      });

      console.log('[Presence] Synced active online user IDs:', Array.from(ids));
      setOnlineUserIds(ids);
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        updatePresenceState();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Presence] User joined:', key, newPresences);
        updatePresenceState();
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Presence] User left:', key, leftPresences);
        updatePresenceState();
      })
      .subscribe(async (status) => {
        console.log('[Presence] Subscription status:', status, 'for user:', currentUser.full_name || currentUser.id);
        if (status === 'SUBSCRIBED') {
          const trackStatus = await channel.track({
            user_id: normalizedUserId,
            full_name: currentUser.full_name || 'User',
            role: currentUser.role || 'trainer',
            online_at: new Date().toISOString(),
          });
          console.log('[Presence] Track response:', trackStatus);
          updatePresenceState();
        }
      });

    // Window focus refresh
    const handleFocus = () => {
      if (channel && channel.state === 'joined') {
        updatePresenceState();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.full_name, currentUser?.role]);

  const isOnline = useMemo(() => {
    return (userId: string) => {
      if (!userId) return false;
      return onlineUserIds.has(userId.toLowerCase().trim());
    };
  }, [onlineUserIds]);

  const value = useMemo(
    () => ({
      onlineUserIds,
      isOnline,
      onlineCount: onlineUserIds.size,
    }),
    [onlineUserIds, isOnline]
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function useGlobalPresence() {
  return useContext(PresenceContext);
}
