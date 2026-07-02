import { create } from "zustand";

interface LoadingState {
  count: number;
  message: string;
  start: (message: string) => void;
  stop: () => void;
  isActive: () => boolean;
}

export const useLoadingStore = create<LoadingState>((set, get) => ({
  count: 0,
  message: "",

  start: (message) =>
    set((state) => ({
      count: state.count + 1,
      message: message || state.message,
    })),

  stop: () =>
    set((state) => {
      const next = Math.max(0, state.count - 1);
      return {
        count: next,
        message: next === 0 ? "" : state.message,
      };
    }),

  isActive: () => get().count > 0,
}));

export async function runWithLoading<T>(
  message: string,
  fn: () => Promise<T>,
): Promise<T> {
  const { start, stop } = useLoadingStore.getState();
  start(message);
  try {
    return await fn();
  } finally {
    stop();
  }
}
