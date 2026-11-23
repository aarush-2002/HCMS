import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotificationStream, fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../../api/notifications';
import { Notification } from '@hmcs/shared';
import { useToast } from '../ui/Toast';

export const NotificationBell: React.FC = () => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleNewNotification = (notification: Notification) => {
    showToast(`${notification.title}: ${notification.body}`, 'info');
    setNotifications((prev) => [notification, ...prev.slice(0, 9)]);
  };

  const { unreadCount, setUnreadCount, isConnected } = useNotificationStream(handleNewNotification);

  const loadRecent = async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications(1, 10);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.warn('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      loadRecent();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.warn('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read', err);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        aria-label={`Notifications (${unreadCount} unread)${isConnected ? ' - live connected' : ''}`}
        aria-expanded={isOpen}
        className="relative min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-[#dfe7e0] hover:text-[#f5a524] rounded-sm hover:bg-[rgba(223,231,224,0.06)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524]"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold bg-[#ff5a5f] text-black rounded-full shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[rgba(10,14,18,0.96)] border border-[rgba(223,231,224,0.16)] rounded-sm shadow-2xl backdrop-blur-md z-50 text-xs text-[#dfe7e0] flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between p-3.5 border-b border-[rgba(223,231,224,0.1)]">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-[#dfe7e0]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-sm bg-[#ff5a5f]/20 text-[#ff5a5f] text-[10px] font-mono">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-[#f5a524] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[rgba(223,231,224,0.06)]">
            {loading ? (
              <div className="p-6 text-center text-[#9aa5a0]">Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-[#9aa5a0]">
                No notifications right now
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 flex flex-col gap-1 transition-colors ${
                    n.isRead ? 'bg-transparent opacity-75' : 'bg-[#f5a524]/5 border-l-2 border-[#f5a524]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-[#dfe7e0] leading-snug">{n.title}</span>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="text-[10px] text-[#9aa5a0] hover:text-[#f5a524] shrink-0"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  <p className="text-[#9aa5a0] leading-relaxed">{n.body}</p>
                  <span className="text-[10px] text-[#9aa5a0]/60 font-mono mt-0.5">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-[rgba(223,231,224,0.1)] text-center bg-[rgba(5,7,10,0.5)]">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs text-[#f5a524] hover:underline block py-1 font-medium"
            >
              View Full Notifications Center →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
