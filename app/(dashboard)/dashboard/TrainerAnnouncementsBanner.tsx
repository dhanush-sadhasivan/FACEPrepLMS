'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Notification } from '@/lib/types';
import { useToast } from '@/components/Toast';

interface TrainerAnnouncementsBannerProps {
  initialAnnouncements: Notification[];
  userRole: string;
}

export default function TrainerAnnouncementsBanner({
  initialAnnouncements,
  userRole,
}: TrainerAnnouncementsBannerProps) {
  const [announcements, setAnnouncements] = useState<Notification[]>(initialAnnouncements);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const { showToast } = useToast();

  const unreadAnnouncements = announcements.filter((a) => !a.is_read);

  // Listen for real-time announcements
  useEffect(() => {
    const handleNewNotif = (e: any) => {
      const notif = e.detail;
      if (notif && (notif.type === 'announcement' || notif.title?.includes('📢'))) {
        setAnnouncements((prev) => [notif, ...prev.filter((item) => item.id !== notif.id)]);
        setActiveIndex(0);
      }
    };

    window.addEventListener('notification-received', handleNewNotif);
    return () => window.removeEventListener('notification-received', handleNewNotif);
  }, []);

  if (announcements.length === 0) {
    return null;
  }

  // Active announcement to display (prioritize unread, else latest)
  const currentList = unreadAnnouncements.length > 0 ? unreadAnnouncements : announcements.slice(0, 1);
  const currentAnnouncement = currentList[Math.min(activeIndex, currentList.length - 1)];

  if (!currentAnnouncement) return null;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic update
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notification-updated'));
    }

    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to mark as read');
      showToast('Announcement acknowledged', 'success');
    } catch (err) {
      console.error('Error marking announcement as read:', err);
      // Revert optimistic update
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: false } : a))
      );
    }
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const isUnread = !currentAnnouncement.is_read;

  return (
    <div
      className="announcement-banner-card"
      style={{
        background: isUnread
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(240, 82, 55, 0.08) 100%)'
          : 'var(--surface-2, #1e293b)',
        borderTop: `1px solid ${isUnread ? 'rgba(99, 102, 241, 0.4)' : 'var(--border, #334155)'}`,
        borderRight: `1px solid ${isUnread ? 'rgba(99, 102, 241, 0.4)' : 'var(--border, #334155)'}`,
        borderBottom: `1px solid ${isUnread ? 'rgba(99, 102, 241, 0.4)' : 'var(--border, #334155)'}`,
        borderLeft: '5px solid var(--accent, #6366f1)',
        borderRadius: '12px',
        padding: '0.85rem 1.15rem',
        marginBottom: '1rem',
        boxShadow: isUnread ? '0 4px 20px rgba(99, 102, 241, 0.1)' : 'none',
        position: 'relative',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Left: Badge + Title + Message */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                background: isUnread ? 'var(--accent, #6366f1)' : 'var(--surface-3, #334155)',
                color: '#ffffff',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <span>📢</span> {isUnread ? 'New Announcement' : 'Announcement'}
            </span>

            {unreadAnnouncements.length > 1 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  padding: '0.12rem 0.45rem',
                  borderRadius: '999px',
                }}
              >
                {activeIndex + 1} of {currentList.length}
              </span>
            )}

            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {timeAgo(currentAnnouncement.created_at)}
            </span>
          </div>

          <h3
            style={{
              margin: '0 0 0.25rem 0',
              fontSize: '0.98rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}
          >
            {currentAnnouncement.title.replace('📢', '').trim()}
          </h3>

          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              maxHeight: isExpanded ? 'none' : '2.8rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: isExpanded ? 'block' : '-webkit-box',
              WebkitLineClamp: isExpanded ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {currentAnnouncement.message}
          </p>

          {currentAnnouncement.message.length > 120 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent, #6366f1)',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '0.2rem 0',
                marginTop: '0.2rem',
              }}
            >
              {isExpanded ? 'Show less ▲' : 'Read full announcement ▼'}
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginTop: '0.2rem' }}>
          {currentList.length > 1 && (
            <div style={{ display: 'flex', gap: '0.25rem', marginRight: '0.25rem' }}>
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => {
                  setActiveIndex((prev) => Math.max(0, prev - 1));
                  setIsExpanded(false);
                }}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                title="Previous Announcement"
              >
                ◀
              </button>
              <button
                type="button"
                disabled={activeIndex >= currentList.length - 1}
                onClick={() => {
                  setActiveIndex((prev) => Math.min(currentList.length - 1, prev + 1));
                  setIsExpanded(false);
                }}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                title="Next Announcement"
              >
                ▶
              </button>
            </div>
          )}

          {isUnread && (
            <button
              type="button"
              onClick={(e) => handleMarkAsRead(currentAnnouncement.id, e)}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--success, #10b981)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              ✓ Acknowledge
            </button>
          )}

          <Link
            href="/notifications"
            className="btn btn-primary btn-sm"
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              textDecoration: 'none',
            }}
          >
            All Announcements →
          </Link>
        </div>
      </div>
    </div>
  );
}
