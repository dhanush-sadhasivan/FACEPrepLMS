'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        // 1. Fetch initial unread count
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (!error && count !== null && isMounted) {
          setUnreadCount(count);
        }

        if (!isMounted) return;

        // 2. Create unique channel per component mount to avoid reusing already subscribed channels
        const channelName = `user-notifs-${user.id}-${Math.random().toString(36).substring(2, 9)}`;
        channel = supabase.channel(channelName);

        channel
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            (payload: any) => {
              if (!isMounted) return;

              // Re-fetch accurate count on any change
              supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false)
                .then(({ count: newCount, error: countErr }) => {
                  if (!countErr && newCount !== null && isMounted) {
                    setUnreadCount(newCount);
                  }
                });

              if (payload.eventType === 'INSERT' && payload.new) {
                const notif = payload.new;
                const isAnnouncement =
                  notif.type === 'announcement' ||
                  (notif.title && notif.title.includes('📢'));

                if (isAnnouncement) {
                  showToast(`📢 New Announcement: ${notif.title.replace('📢', '').trim()}`, 'info');
                } else {
                  showToast(`🔔 ${notif.title}`, 'info');
                }

                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('notification-received', { detail: notif }));
                }
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Error initializing notification bell:', err);
      }
    }

    init();

    // Listen for local notifications update events (e.g. mark as read)
    const handleLocalUpdate = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        if (!error && count !== null && isMounted) {
          setUnreadCount(count);
        }
      } catch (err) {
        console.error('Error updating notification count:', err);
      }
    };

    window.addEventListener('notification-updated', handleLocalUpdate);

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('notification-updated', handleLocalUpdate);
    };
  }, [showToast]);

  return (
    <Link
      href="/notifications"
      className="topbar-bell-btn"
      title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications & Announcements'}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '34px',
        height: '34px',
        borderRadius: '999px',
        background: unreadCount > 0 ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-2, #1e293b)',
        border: `1px solid ${unreadCount > 0 ? 'var(--accent, #6366f1)' : 'var(--border, #334155)'}`,
        color: unreadCount > 0 ? 'var(--accent, #6366f1)' : 'var(--text-secondary, #94a3b8)',
        transition: 'all 0.2s ease',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ef4444',
            color: '#ffffff',
            fontSize: '0.65rem',
            fontWeight: 800,
            minWidth: '17px',
            height: '17px',
            padding: '0 4px',
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
            border: '2px solid var(--surface, #0f172a)',
            lineHeight: 1,
            animation: 'pulse 2s infinite',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
