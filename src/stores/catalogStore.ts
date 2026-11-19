import { create } from "zustand";
import { source } from "@/services/source";
import { loadCached } from "@/utils/cache";
import { withAuthRetry } from "@/utils/retry";
import { ResourceRunner, resourceInitialState, type ResourceState } from "@/utils/resource";
import { CACHE_PREFIXES, CACHE_TTL } from "@/config/cache";
import type { HomeData } from "@/types";

export const CATALOG_KEY = "home";

interface CatalogState {
  resource: ResourceState<HomeData>;
  fetchCatalog: (force?: boolean) => Promise<void>;
}

export const useCatalogStore = create<CatalogState>((set, get) => {
  const runner = new ResourceRunner<HomeData>({
    tag: "home",
    get: () => get().resource,
    set: (resource) => set({ resource }),
  });

  return {
    resource: resourceInitialState<HomeData>(),

    fetchCatalog: async (force = false) => {
      await runner.load(CATALOG_KEY, (signal) =>
        withAuthRetry(
          (attempt) =>
            loadCached(
              CACHE_PREFIXES.HOME,
              (sig) => source.getHomeData({ signal: sig }),
              {
                ttl: CACHE_TTL.HOME,
                signal,
                force: attempt > 0 ? true : force,
                isValid: (d) => d.recent.length > 0,
              },
            ),
          {
            signal,
            maxRetries: 2,
            tag: "home",
          },
        ),
      );
    },
  };
});
