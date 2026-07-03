import { apiClient } from '../api/client';
import { useOfflineStore } from '../stores/offlineStore';

const MAX_RETRIES = 3;

export async function syncQueue(): Promise<void> {
  const store = useOfflineStore.getState();
  if (store.isSyncing) return;

  const pending = store.queue.filter((i) => i.status === 'pending');
  if (!pending.length) return;

  store.setSyncing(true);

  for (const item of pending) {
    try {
      await store.updateItem(item.id, { status: 'syncing' });
      await apiClient.request({
        method: item.method,
        url:    item.endpoint,
        data:   item.body,
      });
      await store.removeItem(item.id);
    } catch (err: unknown) {
      const retries = item.retries + 1;
      const errMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        'Unknown error';

      if (retries >= MAX_RETRIES) {
        await store.updateItem(item.id, { status: 'failed', retries, lastError: errMsg });
      } else {
        await store.updateItem(item.id, { status: 'pending', retries, lastError: errMsg });
      }
    }
  }

  store.setSyncing(false);
}
