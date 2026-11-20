import { create } from "zustand";
import { storage } from "@/utils/storage";
import { logger } from "@/utils/logger";

export const EPISODE_ORDER_KEY = "episode_order";
export const PREFERRED_SERVER_KEY = "preferred_server";

export type PreferredServer = "Delta" | "Epsilon" | null;

interface SettingsState {
  episodeOrder: "asc" | "desc";
  preferredServer: PreferredServer;
  cacheInvalidationTimestamp: number;
  initialize: (order: "asc" | "desc", preferredServer?: PreferredServer) => void;
  setEpisodeOrder: (order: "asc" | "desc") => Promise<void>;
  setPreferredServer: (server: PreferredServer) => Promise<void>;
  invalidateCache: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  episodeOrder: "asc",
  preferredServer: null,
  cacheInvalidationTimestamp: 0,

  initialize: (order, preferredServer) =>
    set({
      episodeOrder: order === "asc" || order === "desc" ? order : "asc",
      preferredServer: preferredServer === "Delta" || preferredServer === "Epsilon" ? preferredServer : null,
    }),

  setEpisodeOrder: async (order: "asc" | "desc") => {
    const previous = get().episodeOrder;
    set({ episodeOrder: order });
    try {
      await storage.set(EPISODE_ORDER_KEY, order);
    } catch (error) {
      set({ episodeOrder: previous });
      logger.error("settingsStore", "Failed to persist order", error);
    }
  },

  setPreferredServer: async (server) => {
    const previous = get().preferredServer;
    set({ preferredServer: server });
    try {
      await storage.set(PREFERRED_SERVER_KEY, server);
    } catch (error) {
      set({ preferredServer: previous });
      logger.error("settingsStore", "Failed to persist preferred server", error);
    }
  },

  invalidateCache: () => set({ cacheInvalidationTimestamp: Date.now() }),
}));
