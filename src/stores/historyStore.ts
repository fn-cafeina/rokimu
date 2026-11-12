import { create } from "zustand";
import type { HistoryItem } from "../types";
import { persistWithRollback } from "../utils/history";
import { storage } from "../utils/storage";

export const HISTORY_KEY = "last_viewed";

interface HistoryState {
  lastViewed: HistoryItem[];
  initialize: (data: HistoryItem[]) => void;
  addToHistory: (item: HistoryItem) => Promise<void>;

}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  lastViewed: [],

  initialize: (data) => {
    set({ lastViewed: data });
  },

  addToHistory: async (item) => {
    const newItem = { ...item, timestamp: Date.now() };
    const previous = get().lastViewed;
    const updated = [newItem, ...previous.filter(
      (i) => i.url !== newItem.url || i.number !== newItem.number,
    )].slice(0, 50);

    set({ lastViewed: updated });
    await persistWithRollback(
      () => storage.set(HISTORY_KEY, updated),
      () => set({ lastViewed: previous }),
      "historyStore",
    );
  },


}));
