import { create } from "zustand";
import { storage } from "@/utils/storage";
import { persistWithRollback } from "@/utils/persist";

export const EPISODE_ORDER_KEY = "episode_order";
export const EPISODE_ORDER_BY_SLUG_KEY = "episode_order_by_slug";
export const PREFERRED_SERVER_KEY = "preferred_server";

type PreferredServer = "Delta" | "Epsilon" | null;
type EpisodeOrder = "asc" | "desc";

interface SettingsState {
  /** Last order picked anywhere: a new series starts with it */
  episodeOrder: EpisodeOrder;
  /** Order per series, so flipping one never touches the others */
  episodeOrderBySlug: Record<string, EpisodeOrder>;
  preferredServer: PreferredServer;
  initialize: (
    order: EpisodeOrder,
    preferredServer?: PreferredServer,
    bySlug?: Record<string, EpisodeOrder>,
  ) => void;
  setEpisodeOrder: (slug: string, order: EpisodeOrder) => Promise<void>;
  setPreferredServer: (server: PreferredServer) => Promise<void>;
}

function isOrder(value: unknown): value is EpisodeOrder {
  return value === "asc" || value === "desc";
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  episodeOrder: "asc",
  episodeOrderBySlug: {},
  preferredServer: null,

  initialize: (order, preferredServer, bySlug) =>
    set({
      episodeOrder: isOrder(order) ? order : "asc",
      episodeOrderBySlug: bySlug ?? {},
      preferredServer: preferredServer === "Delta" || preferredServer === "Epsilon" ? preferredServer : null,
    }),

  setEpisodeOrder: async (slug, order) => {
    const previous = get().episodeOrderBySlug;
    const previousOrder = get().episodeOrder;
    const bySlug = { ...previous, [slug]: order };
    set({ episodeOrderBySlug: bySlug, episodeOrder: order });
    // One write for both: the map is the memory, the single value is the default
    await persistWithRollback(
      () =>
        Promise.all([
          storage.set(EPISODE_ORDER_BY_SLUG_KEY, bySlug),
          storage.set(EPISODE_ORDER_KEY, order),
        ]).then(() => undefined),
      () => set({ episodeOrderBySlug: previous, episodeOrder: previousOrder }),
      "settings",
    );
  },

  setPreferredServer: async (server) => {
    const previous = get().preferredServer;
    set({ preferredServer: server });
    await persistWithRollback(
      () => storage.set(PREFERRED_SERVER_KEY, server),
      () => set({ preferredServer: previous }),
      "settings",
    );
  },
}));
