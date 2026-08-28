import { create } from 'zustand';

// Phase 1 audit found no success-feedback mechanism anywhere on mobile —
// create/update actions across every screen (not just Procurement) silently
// call navigation.goBack() with nothing shown. This store backs one shared
// <Toast /> host mounted once at the app root (see App.tsx), reused
// everywhere rather than duplicated per screen.
// Phase 3 — warning/info added alongside success/error, matching desktop's
// 4-severity showToast()/alertHtml() language.
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  message: string | null;
  type:    ToastType;
  show:    (message: string, type?: ToastType) => void;
  hide:    () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type:    'success',
  show:    (message, type = 'success') => set({ message, type }),
  hide:    () => set({ message: null }),
}));

export function showToast(message: string, type: ToastType = 'success') {
  useToastStore.getState().show(message, type);
}
