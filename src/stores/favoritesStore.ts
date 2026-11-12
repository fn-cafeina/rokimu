import { create } from "zustand";
import type { Favorite } from "../types";
import { persistWithRollback } from "../utils/history";
import { storage } from "../utils/storage";

export const FAVORITES_KEY = "favorites";
// Generous cap: a favorites list is user-curated, not a rolling log
const MAX_FAVORITES = 200;

interface FavoritesState {
  favorites: Favorite[];
  initialize: (data: Favorite[]) => void;
  toggle: (url: string, title: string, image: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],

  initialize: (data) => {
    set({ favorites: data });
  },

  toggle: async (url, title, image) => {
    const previous = get().favorites;
    const existing = previous.find((f) => f.url === url);
    const updated = existing
      ? previous.filter((f) => f.url !== url)
      : [{ title, image, url, addedAt: Date.now() }, ...previous].slice(0, MAX_FAVORITES);

    set({ favorites: updated });
    await persistWithRollback(
      () => storage.set(FAVORITES_KEY, updated),
      () => set({ favorites: previous }),
      "favoritesStore",
    );
  },
}));
