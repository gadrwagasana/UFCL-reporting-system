import { useOfflineStore } from '../stores/offlineStore';
import { QueueItem } from '../types/api';

interface UseOfflineQueueReturn {
  queue:       QueueItem[];
  pendingCount: number;
  failedCount:  number;
  isSyncing:   boolean;
  enqueue:     (item: Omit<QueueItem, 'id' | 'createdAt' | 'retries' | 'status'>) => Promise<void>;
  clearFailed: () => Promise<void>;
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const queue      = useOfflineStore((s) => s.queue);
  const isSyncing  = useOfflineStore((s) => s.isSyncing);
  const enqueue    = useOfflineStore((s) => s.enqueue);
  const clearFailed = useOfflineStore((s) => s.clearFailed);

  return {
    queue,
    pendingCount: queue.filter((i) => i.status === 'pending').length,
    failedCount:  queue.filter((i) => i.status === 'failed').length,
    isSyncing,
    enqueue,
    clearFailed,
  };
}
