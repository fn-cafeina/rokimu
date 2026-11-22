import { create } from "zustand";
import { source, type BrowsePage } from "@/services/source";
import { browseQuery, EMPTY_FILTER, type BrowseFilter } from "@/config/browse";
import { loadCached } from "@/utils/cache";
import { appendPage } from "@/utils/paging";
import { withAuthRetry } from "@/utils/retry";
import { ResourceRunner, resourceInitialState, type ResourceState } from "@/utils/resource";
import { CACHE_PREFIXES, CACHE_TTL } from "@/config/cache";
import { logger } from "@/utils/logger";
import type { Anime } from "@/types";

const HOME_QUERY = browseQuery(EMPTY_FILTER, 1);

/** Page 1 is cached per filter combination; later pages are re-requested */
function cacheKeyFor(query: string): string {
  if (query === HOME_QUERY) return CACHE_PREFIXES.HOME;
  return `${CACHE_PREFIXES.HOME}_${query.replace(/[^a-z0-9]+/gi, "-")}`;
}

interface CatalogState {
  filter: BrowseFilter;
  /** Browse URL of the current filter, page 1; it is also the resource key */
  query: string;
  resource: ResourceState<BrowsePage>;
  /** Page 1 plus every page loaded since, deduplicated by slug */
  items: Anime[];
  page: number;
  lastPage: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  /** The filter sheet lives at the root so it draws above the floating tab bar */
  sheetOpen: boolean;
  fetchCatalog: (force?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilter: (filter: BrowseFilter) => void;
  openSheet: () => void;
  closeSheet: () => void;
}

export const useCatalogStore = create<CatalogState>((set, get) => {
  const runner = new ResourceRunner<BrowsePage>({
    tag: "home",
    get: () => get().resource,
    set: (resource) => set({ resource }),
  });

  return {
    filter: EMPTY_FILTER,
    query: HOME_QUERY,
    resource: resourceInitialState<BrowsePage>(),
    items: [],
    page: 1,
    lastPage: 1,
    hasMore: true,
    isLoadingMore: false,
    sheetOpen: false,

    fetchCatalog: async (force = false) => {
      const query = get().query;
      const outcome = await runner.load(query, (signal) =>
        withAuthRetry(
          (attempt) =>
            loadCached(
              cacheKeyFor(query),
              (sig) => source.getBrowsePage(query, { signal: sig }),
              {
                ttl: CACHE_TTL.HOME,
                signal,
                force: attempt > 0 ? true : force,
                isValid: (page) => Array.isArray(page.items),
              },
            ),
          {
            signal,
            maxRetries: 2,
            tag: "home",
          },
        ),
      );
      // A filter change during the request already reset the grid for its query
      if (outcome.status !== "success" || get().query !== query) return;
      const { items, pagination } = outcome.data;
      set({
        items,
        page: 1,
        lastPage: pagination.lastPage,
        hasMore: pagination.lastPage > 1,
        isLoadingMore: false,
      });
    },

    loadMore: async () => {
      const { hasMore, isLoadingMore, query, page, filter } = get();
      if (!hasMore || isLoadingMore) return;
      set({ isLoadingMore: true });
      try {
        const next = await withAuthRetry(() => source.getBrowsePage(browseQuery(filter, page + 1)), {
          maxRetries: 2,
          tag: "home",
        });
        // A refresh or filter change that landed mid-flight owns the list now
        if (get().query !== query || get().page !== page) return;
        const merged = appendPage(get().items, next.items);
        const reached = page + 1;
        set({
          items: merged.items,
          page: reached,
          lastPage: next.pagination.lastPage,
          // A page that adds no new cards (the feed shifted under us) must not
          // stop the walk: dedup already hides the repeats
          hasMore: reached < next.pagination.lastPage,
          isLoadingMore: false,
        });
      } catch (error) {
        if (get().query !== query) return;
        // Keep the list loadable: the next scroll retries instead of dying here
        logger.warn("home", `Page ${page + 1} failed for ${query}`, error);
        set({ isLoadingMore: false });
      }
    },

    setFilter: (filter) => {
      const query = browseQuery(filter, 1);
      if (query === get().query) return;
      set({ filter, query, items: [], page: 1, lastPage: 1, hasMore: true, isLoadingMore: false });
      void get().fetchCatalog();
    },

    openSheet: () => set({ sheetOpen: true }),
    closeSheet: () => set({ sheetOpen: false }),
  };
});
