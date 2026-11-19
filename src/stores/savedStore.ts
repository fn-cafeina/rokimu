import { create } from "zustand";
import type { Anime } from "@/types";
import { persistWithRollback } from "@/utils/persist";
import { storage } from "@/utils/storage";
import { forgetAnimeSnapshot } from "@/utils/animeSnapshot";
import { hasDownloadFor } from "@/utils/downloadQueue";
import { useDownloadsStore } from "./downloadsStore";

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

    // Out of the library with nothing downloaded: the saved detail has no
    // reason to stay and would only sit against the storage cap. A download,
    // finished or still running, keeps its episode list reachable offline.
    if (existing) {
      const hasDownloads = hasDownloadFor(Object.values(useDownloadsStore.getState().entries), anime.url);
      if (!hasDownloads) void forgetAnimeSnapshot(anime.url);
    }
  },
}));
