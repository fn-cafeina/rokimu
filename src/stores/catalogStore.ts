import { create } from "zustand";
import { source } from "@/services/source";
import { BROWSE } from "@/config/browse";
import { loadCached } from "@/utils/cache";
import { appendPage } from "@/utils/paging";
import { withAuthRetry } from "@/utils/retry";
import { ResourceRunner, resourceInitialState, type ResourceState } from "@/utils/resource";
import { CACHE_PREFIXES, CACHE_TTL } from "@/config/cache";
import { logger } from "@/utils/logger";
import type { Anime } from "@/types";

export interface BrowseFilter {
  genre: string | null;
  year: number | null;
}

export const EMPTY_FILTER: BrowseFilter = { genre: null, year: null };

/**
 * The site ignores genre and year as query params, so a filter picks one path:
 * combined filters have no URL that honors both.
 */
export function browsePath(filter: BrowseFilter): string {
  if (filter.genre != null) return BROWSE.genre(filter.genre);
  if (filter.year != null) return BROWSE.year(filter.year);
  return BROWSE.home;
}

/** Page 1 is cached per path; later pages are cheap enough to re-request */
function cacheKeyFor(path: string): string {
  if (path === BROWSE.home) return CACHE_PREFIXES.HOME;
  return `${CACHE_PREFIXES.HOME}_${path.replace(/[^a-z0-9]+/gi, "-")}`;
}

interface CatalogState {
  filter: BrowseFilter;
  /** Browse path for the current filter; also the resource key of page 1 */
  path: string;
  resource: ResourceState<Anime[]>;
  /** Page 1 plus every page loaded since, deduplicated by slug */
  items: Anime[];
  page: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  fetchCatalog: (force?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilter: (filter: BrowseFilter) => void;
}

export const useCatalogStore = create<CatalogState>((set, get) => {
  const runner = new ResourceRunner<Anime[]>({
    tag: "home",
    get: () => get().resource,
    set: (resource) => set({ resource }),
  });

  return {
    filter: EMPTY_FILTER,
    path: BROWSE.home,
    resource: resourceInitialState<Anime[]>(),
    items: [],
    page: 1,
    hasMore: true,
    isLoadingMore: false,

    fetchCatalog: async (force = false) => {
      const path = get().path;
      const outcome = await runner.load(path, (signal) =>
        withAuthRetry(
          (attempt) =>
            loadCached(
              cacheKeyFor(path),
              (sig) => source.getBrowsePage(path, 1, { signal: sig }),
              {
                ttl: CACHE_TTL.HOME,
                signal,
                force: attempt > 0 ? true : force,
                isValid: (cards) => cards.length > 0,
              },
            ),
          {
            signal,
            maxRetries: 2,
            tag: "home",
          },
        ),
      );
      // A filter change during the request already reset the grid for its path
      if (outcome.status !== "success" || get().path !== path) return;
      set({ items: outcome.data, page: 1, hasMore: outcome.data.length > 0, isLoadingMore: false });
    },

    loadMore: async () => {
      const { hasMore, isLoadingMore, path, page } = get();
      if (!hasMore || isLoadingMore) return;
      set({ isLoadingMore: true });
      try {
        const next = await withAuthRetry(() => source.getBrowsePage(path, page + 1), {
          maxRetries: 2,
          tag: "home",
        });
        // A refresh that landed mid-flight already replaced the list for page 1
        if (get().path !== path || get().page !== page) return;
        const merged = appendPage(get().items, next);
        set({ items: merged.items, page: page + 1, hasMore: merged.added > 0, isLoadingMore: false });
      } catch (error) {
        if (get().path !== path) return;
        // Stop the scroll instead of hammering a failing page; a refresh retries
        logger.warn("home", `Page ${page + 1} failed for ${path}`, error);
        set({ isLoadingMore: false, hasMore: false });
      }
    },

    setFilter: (filter) => {
      const path = browsePath(filter);
      if (path === get().path) return;
      set({ filter, path, items: [], page: 1, hasMore: true, isLoadingMore: false });
      void get().fetchCatalog();
    },
  };
});
