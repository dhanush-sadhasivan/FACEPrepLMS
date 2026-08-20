'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { Notification } from '@/lib/types';
import CreateAnnouncementModal from './CreateAnnouncementModal';

interface NotificationListProps {
  initialNotifications: Notification[];
  sentNotifications?: Notification[];
  userRole: string;
}

export default function NotificationList({ initialNotifications, sentNotifications = [], userRole }: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<'All' | 'Unread' | 'announcement' | 'sent_by_me' | 'access_request' | 'contest_assigned' | 'system'>('All');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const isAdminOrManager = userRole === 'admin' || userRole === 'manager';

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notification-updated'));
    }

    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      router.refresh(); // Refresh layout to update bell
    } catch (error) {
      console.error(error);
      showToast('Failed to mark notification as read', 'error');
      // Revert optimistic update
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: false } : n)
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notification-updated'));
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notification-updated'));
    }

    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
      showToast('All notifications marked as read', 'success');
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast('Failed to mark all as read', 'error');
      // Full refresh on failure to get accurate state
      router.refresh();
    } finally {
      setIsMarkingAll(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notification-updated'));
      }
    }
  };

  const handleAccessRequest = async (notificationId: string, requestId: string, action: 'approved' | 'denied') => {
    try {
      const res = await fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: action }),
      });
      
      if (!res.ok) throw new Error(`Failed to ${action} request`);
      
      showToast(`Access request ${action}`, 'success');
      
      // Mark the notification as read since it was handled
      await handleMarkAsRead(notificationId);
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast(`Failed to ${action} request`, 'error');
    }
  };

  const isAnnouncement = (n: Notification) => {
    return n.type === 'announcement' || (n.title && n.title.includes('📢'));
  };

  const getIcon = (type: string, notification?: Notification) => {
    if (notification && isAnnouncement(notification)) {
      return (
        <span style={{ fontSize: '1.25rem' }}>📢</span>
      );
    }

    switch (type) {
      case 'access_request':
      case 'Access Requests':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      case 'contest_assigned':
      case 'Contest Assignments':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
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

  const displayList = filter === 'sent_by_me' ? sentNotifications : notifications;

  const filteredNotifications = displayList.filter(n => {
    if (filter === 'sent_by_me') return true;
    if (filter === 'All') return true;
    if (filter === 'Unread') return !n.is_read;
    if (filter === 'announcement') return isAnnouncement(n);
    return n.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filterTabs: { id: 'All' | 'Unread' | 'announcement' | 'sent_by_me' | 'access_request' | 'contest_assigned' | 'system'; label: string; count?: number }[] = [
    { id: 'All', label: 'All', count: notifications.length },
    { id: 'Unread', label: 'Unread', count: unreadCount },
    { id: 'announcement', label: '📢 Announcements' },
    ...(isAdminOrManager && sentNotifications.length > 0 ? [{ id: 'sent_by_me' as const, label: `📤 Sent by Me (${sentNotifications.length})` }] : []),
    { id: 'access_request', label: 'Access Requests' },
    { id: 'contest_assigned', label: 'Assignments' },
    { id: 'system', label: 'System Updates' },
  ];

  return (
    <div className="notification-list-container">
      {/* Controls Bar */}
      <div className="notification-controls">
        <div className="notification-filters">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              className={`filter-btn ${filter === tab.id ? 'active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isAdminOrManager && (
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', fontWeight: 800, padding: '0.35rem 0.85rem' }}
              onClick={() => setIsAnnouncementModalOpen(true)}
            >
              📢 Broadcast Announcement
            </button>
          )}

          {unreadCount > 0 && filter !== 'sent_by_me' && (
            <button 
              className="mark-all-read-btn" 
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
            >
              {isMarkingAll ? 'Marking...' : 'Mark all as read'}
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <p>{filter === 'sent_by_me' ? 'No sent announcements yet.' : 'No notifications found.'}</p>
            <span className="empty-subtext">You&apos;re all caught up!</span>
          </div>
        ) : (
          filteredNotifications.map(notification => {
            const isAnn = isAnnouncement(notification);
            const senderName = notification.sender?.full_name;
            const senderRole = notification.sender?.role === 'manager' ? 'Manager' : 'Admin';

            return (
              <div 
                key={notification.id} 
                className={`notification-item ${!notification.is_read && !notification.is_sent_by_me ? 'unread' : ''} ${isAnn ? 'announcement-item' : ''}`}
                style={isAnn ? { borderLeft: '4px solid var(--accent, #6366f1)', background: (!notification.is_read && !notification.is_sent_by_me) ? 'rgba(99, 102, 241, 0.07)' : 'var(--surface)' } : {}}
                onClick={(e) => {
                  if (!notification.is_read && !notification.is_sent_by_me) handleMarkAsRead(notification.id, e);
                }}
              >
                <div className="notification-icon" style={isAnn ? { background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent)' } : {}}>
                  {getIcon(notification.type, notification)}
                </div>
                <div className="notification-content">
                  <div className="notification-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0 }}>{notification.title}</h4>
                      {isAnn && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'var(--accent-muted, rgba(99,102,241,0.15))', color: 'var(--accent, #6366f1)', padding: '0.1rem 0.45rem', borderRadius: '6px', textTransform: 'uppercase' }}>
                          Announcement
                        </span>
                      )}
                    </div>
                    <span className="notification-time">{timeAgo(notification.created_at)}</span>
                  </div>

                  {/* Sender attribution badge */}
                  {senderName && (
                    <div style={{ marginTop: '0.2rem', marginBottom: '0.25rem' }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          background: 'var(--surface-3, #334155)',
                          padding: '0.12rem 0.5rem',
                          borderRadius: '6px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <span>{notification.is_sent_by_me ? '📤' : '👤'}</span>
                        {notification.is_sent_by_me ? (
                          <>Sent by <strong>You</strong> ({senderRole})</>
                        ) : (
                          <>Sent by: <strong style={{ color: 'var(--text-primary)' }}>{senderName}</strong> ({senderRole})</>
                        )}
                      </span>
                    </div>
                  )}

                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: '0.35rem' }}>
                    {notification.message}
                  </p>
                  
                  {notification.type === 'access_request' && notification.related_id && !notification.is_read && isAdminOrManager && (
                    <div className="notification-actions">
                      <button
                        className="btn-approve"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccessRequest(notification.id, notification.related_id!, 'approved');
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-deny"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccessRequest(notification.id, notification.related_id!, 'denied');
                        }}
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
                {!notification.is_read && !notification.is_sent_by_me && (
                  <div className="unread-indicator" title="Mark as read" onClick={(e) => handleMarkAsRead(notification.id, e)}>
                    <div className="indicator-dot"></div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Broadcast Announcement Modal */}
      <CreateAnnouncementModal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}

