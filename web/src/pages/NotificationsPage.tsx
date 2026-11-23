import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications';
import { Notification } from '@hmcs/shared';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState<boolean>(false);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await fetchNotifications(p, 15);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setTotalPages(data.pagination.totalPages);
      setPage(p);
    } catch (err) {
      console.warn('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const handleMarkRead = async (id: string) => {
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

  const filtered = filterUnreadOnly
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const backLink =
    user?.role === 'STUDENT'
      ? '/student'
      : user?.role === 'WARDEN'
      ? '/warden'
      : '/admin';

  return (
    <div className="relative min-h-screen z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[rgba(223,231,224,0.12)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={backLink}
              className="text-xs text-[#9aa5a0] hover:text-[#f5a524] transition-colors"
            >
              ← Back to Portal
            </Link>
          </div>
          <h1 className="text-2xl font-light tracking-tight text-[#dfe7e0]">
            Notifications Center
          </h1>
          <p className="text-xs text-[#9aa5a0]">
            Real-time updates regarding your complaints, votes, escalations, and confirmations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="small"
            onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
          >
            {filterUnreadOnly ? 'Show All' : 'Unread Only'}
          </Button>

          {unreadCount > 0 && (
            <Button variant="primary" size="small" onClick={handleMarkAllRead}>
              Mark All as Read ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Content list */}
      <Card padded={false} className="divide-y divide-[rgba(223,231,224,0.08)]">
        {loading ? (
          <div className="p-6 flex flex-col gap-4">
            <Skeleton height="60px" />
            <Skeleton height="60px" />
            <Skeleton height="60px" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={filterUnreadOnly ? 'No unread notifications' : 'No notifications yet'}
              description="You will receive alerts when your complaints are acknowledged, voted on, or marked resolved."
              action={
                <Link to={backLink}>
                  <Button variant="primary" size="small">
                    Return to Portal
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-5 flex flex-col sm:flex-row items-start justify-between gap-4 transition-colors ${
                item.isRead ? 'bg-transparent' : 'bg-[#f5a524]/5 border-l-2 border-[#f5a524]'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[#dfe7e0]">
                    {item.title}
                  </span>
                  {!item.isRead && (
                    <span className="px-1.5 py-0.5 rounded-sm bg-[#ff5a5f]/20 text-[#ff5a5f] text-[10px] font-mono">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9aa5a0] mt-1 leading-relaxed">
                  {item.body}
                </p>
                <span className="text-[11px] text-[#9aa5a0]/60 font-mono mt-2 block">
                  {new Date(item.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              {!item.isRead && (
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => handleMarkRead(item.id)}
                >
                  Mark Read
                </Button>
              )}
            </div>
          ))
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-xs text-[#9aa5a0]">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="small"
              disabled={page <= 1}
              onClick={() => loadPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="small"
              disabled={page >= totalPages}
              onClick={() => loadPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
