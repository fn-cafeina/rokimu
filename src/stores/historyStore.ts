import { create } from "zustand";
import type { HistoryItem } from "@/types";
import { logger } from "@/utils/logger";
import { storage } from "@/utils/storage";

export const HISTORY_KEY = "last_viewed";

interface HistoryState {
  lastViewed: HistoryItem[];
  initialize: (data: HistoryItem[]) => void;
  addToHistory: (item: HistoryItem) => Promise<void>;

}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  lastViewed: [],

  initialize: (data: HistoryItem[]) => {
    set({ lastViewed: data });
  },

  addToHistory: async (item: HistoryItem) => {
    const newItem = { ...item, timestamp: Date.now() };
    const updated = [newItem, ...get().lastViewed.filter(
      (i) => i.url !== newItem.url || i.number !== newItem.number,
    )].slice(0, 50);

    set({ lastViewed: updated });
    try {
      await storage.set(HISTORY_KEY, updated);
    } catch (error) {
      // Progress is written every ten seconds and on every exit, so two calls
      // can overlap. Reverting to the list captured before this one would drop
      // an entry the other call already saved; memory keeps the newest value
      // and the next successful write persists it.
      logger.error("historyStore", "Failed to persist", error);
    }
  },


}));
