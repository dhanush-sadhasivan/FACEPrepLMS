'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { Notification } from '@/lib/types';

interface NotificationListProps {
  initialNotifications: Notification[];
  userRole: string;
}

export default function NotificationList({ initialNotifications, userRole }: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<'All' | 'Unread' | 'access_request' | 'contest_assigned' | 'system'>('All');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );

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
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

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
      await handleMarkAsRead(notificationId, { stopPropagation: () => {} } as React.MouseEvent);
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast(`Failed to ${action} request`, 'error');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Access Requests':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
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

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'All') return true;
    if (filter === 'Unread') return !n.is_read;
    return n.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="notification-list-container">
      <div className="notification-controls">
        <div className="notification-filters">
          {(['All', 'Unread', 'access_request', 'contest_assigned', 'system'] as const).map(f => {
            const label: Record<string, string> = { All: 'All', Unread: 'Unread', access_request: 'Access Requests', contest_assigned: 'Assignments', system: 'System' };
            return (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {label[f] ?? f}
              </button>
            );
          })}
        </div>
        {unreadCount > 0 && (
          <button 
            className="mark-all-read-btn" 
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <p>No notifications found.</p>
            <span className="empty-subtext">You're all caught up!</span>
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div 
              key={notification.id} 
              className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
              onClick={(e) => {
                 if (!notification.is_read) handleMarkAsRead(notification.id, e);
              }}
            >
              <div className="notification-icon">
                {getIcon(notification.type)}
              </div>
              <div className="notification-content">
                <div className="notification-header">
                  <h4>{notification.title}</h4>
                  <span className="notification-time">{timeAgo(notification.created_at)}</span>
                </div>
                <p>{notification.message}</p>
                
                {notification.type === 'access_request' && notification.related_id && !notification.is_read && (userRole === 'admin' || userRole === 'manager') && (
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
              {!notification.is_read && (
                <div className="unread-indicator" title="Mark as read" onClick={(e) => handleMarkAsRead(notification.id, e)}>
                  <div className="indicator-dot"></div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
