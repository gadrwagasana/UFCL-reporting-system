import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';

export interface Notification {
  id:             number;
  type:           string;
  title:          string;
  body:           string;
  related_module: string | null;
  related_id:     number | null;
  category:       'security' | 'approval' | 'system';
  time:           string;
  read:           boolean;
  direct:         boolean;
}

export interface NotificationsResponse {
  ok:      boolean;
  rows:    Notification[];
  total:   number;
  page:    number;
  hasMore: boolean;
  unread:  number;
}

interface Filters {
  category?: string | null;
  search?:   string | null;
}

export function useNotifications(filters: Filters = {}) {
  return useQuery<NotificationsResponse>({
    queryKey:       ['notifications', filters],
    queryFn:        () => get<NotificationsResponse>(EP.NOTIFICATIONS_LIST, {
      category: filters.category ?? undefined,
      search:   filters.search   ?? undefined,
    }),
    staleTime:      30_000,
    refetchInterval: 30_000, // poll every 30s — matches desktop behaviour
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();

  const markRead = useCallback(async (id: number) => {
    await post(EP.NOTIFICATIONS_MARK_READ(id), {});
    await qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  const markAllRead = useCallback(async () => {
    await post(EP.NOTIFICATIONS_MARK_ALL, {});
    await qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  return { markRead, markAllRead };
}
