import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from './client';
import { Notification } from '@hmcs/shared';

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export async function fetchNotifications(
  page = 1,
  limit = 20
): Promise<NotificationsResponse> {
  return apiRequest<NotificationsResponse>(
    `/api/notifications?page=${page}&limit=${limit}`
  );
}

export async function markNotificationRead(
  id: string
): Promise<{ notification: Notification; unreadCount: number }> {
  return apiRequest(`/api/notifications/${id}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead(): Promise<{
  message: string;
  unreadCount: number;
}> {
  return apiRequest('/api/notifications/read-all', {
    method: 'POST',
  });
}

/**
 * React Hook for real-time Server-Sent Events (SSE) notification streaming
 */
export function useNotificationStream(onNewNotification?: (notification: Notification) => void) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const refreshCount = useCallback(async () => {
    try {
      const data = await fetchNotifications(1, 1);
      setUnreadCount(data.unreadCount);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
        const cleanBase = baseUrl.replace(/\/$/, '');
        const sseUrl = cleanBase ? `${cleanBase}/api/notifications/stream` : '/api/notifications/stream';
        eventSource = new EventSource(sseUrl, {
          withCredentials: true,
        });

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT') {
              setUnreadCount(data.unreadCount);
            } else if (data.type === 'NOTIFICATION') {
              setUnreadCount((prev) => prev + 1);
              if (onNewNotification) {
                onNewNotification(data.notification);
              }
            }
          } catch (err) {
            console.error('SSE Message parse error:', err);
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Exponential backoff reconnect
          reconnectTimer = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.warn('Failed to initiate SSE connection:', err);
      }
    };

    refreshCount();
    connectSSE();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [refreshCount, onNewNotification]);

  return { unreadCount, setUnreadCount, isConnected, refreshCount };
}
