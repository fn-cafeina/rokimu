import { create } from "zustand";
import type { Anime } from "../types";
import { persistWithRollback } from "../utils/history";
import { storage } from "../utils/storage";

export const SAVED_KEY = "saved_animes";

interface SavedState {
  saved: Anime[];
  initialize: (data: Anime[]) => void;
  toggleSaved: (anime: Anime) => Promise<void>;
  isSaved: (url: string) => boolean;
}

export const useSavedStore = create<SavedState>((set, get) => ({
  saved: [],

  initialize: (data: Anime[]) => set({ saved: data }),

  isSaved: (url: string) => get().saved.some((item) => item.url === url),

  toggleSaved: async (anime: Anime) => {
    const previous = get().saved;
    const existing = previous.some((item) => item.url === anime.url);
    const updated = existing
      ? previous.filter((item) => item.url !== anime.url)
      : [anime, ...previous];

    set({ saved: updated });
    await persistWithRollback(
      () => storage.set(SAVED_KEY, updated),
      () => set({ saved: previous }),
      "savedStore",
    );
  },
}));
