import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { QueueItem, QueueStatus } from '../types/api';

const QUEUE_KEY = '@ufcl/offline_queue';

interface OfflineState {
  queue:       QueueItem[];
  isSyncing:   boolean;
  isOnline:    boolean;

  // Actions
  loadQueue:   () => Promise<void>;
  enqueue:     (item: Omit<QueueItem, 'id' | 'createdAt' | 'retries' | 'status'>) => Promise<void>;
  updateItem:  (id: string, patch: Partial<QueueItem>) => Promise<void>;
  removeItem:  (id: string) => Promise<void>;
  clearFailed: () => Promise<void>;
  setOnline:   (online: boolean) => void;
  setSyncing:  (v: boolean) => void;
}

async function persistQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  queue:     [],
  isSyncing: false,
  isOnline:  true,

  loadQueue: async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (raw) set({ queue: JSON.parse(raw) as QueueItem[] });
    } catch {
      try { await AsyncStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    }
  },

  enqueue: async (item) => {
    const newItem: QueueItem = {
      ...item,
      id:        uuidv4(),
      createdAt: new Date().toISOString(),
      retries:   0,
      status:    'pending',
    };
    const queue = [...get().queue, newItem];
    set({ queue });
    await persistQueue(queue);
  },

  updateItem: async (id, patch) => {
    const queue = get().queue.map((i) => (i.id === id ? { ...i, ...patch } : i));
    set({ queue });
    await persistQueue(queue);
  },

  removeItem: async (id) => {
    const queue = get().queue.filter((i) => i.id !== id);
    set({ queue });
    await persistQueue(queue);
  },

  clearFailed: async () => {
    const queue = get().queue.filter((i) => (i.status as QueueStatus) !== 'failed');
    set({ queue });
    await persistQueue(queue);
  },

  setOnline:  (online) => set({ isOnline: online }),
  setSyncing: (v)      => set({ isSyncing: v }),
}));
