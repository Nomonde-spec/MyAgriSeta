import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';

type NotificationItem = {
  read: boolean;
  canMarkRead: boolean;
};

type NotificationCountContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationCountContext = createContext<NotificationCountContextValue | undefined>(undefined);

export function NotificationCountProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [unreadState, setUnreadState] = useState<{ userId: string; count: number } | null>(null);
  const unreadCount = session && unreadState?.userId === session.user.id ? unreadState.count : 0;
  const userId = session?.user.id;

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return;

    try {
      const payload = await apiFetch<{ notifications: NotificationItem[] }>('/notifications');
      setUnreadState({
        userId,
        count: payload.notifications.filter((item) => item.canMarkRead && !item.read).length,
      });
    } catch {
      // Keep the last known count when the API is temporarily unavailable.
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const initialRefresh = setTimeout(() => void refreshUnreadCount(), 0);
    const timer = setInterval(() => void refreshUnreadCount(), 15000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnreadCount();
    });

    return () => {
      clearTimeout(initialRefresh);
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshUnreadCount, userId]);

  return (
    <NotificationCountContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationCountContext.Provider>
  );
}

export function useNotificationCount() {
  const context = useContext(NotificationCountContext);
  if (!context) {
    throw new Error('useNotificationCount must be used within NotificationCountProvider');
  }
  return context;
}
