import { useEffect, useMemo } from "react";
import type { Anime } from "../types";
import { HOME_KEY, useHomeStore } from "../stores/homeStore";
import { deriveView, errorFor, isLoadingFor, type ResourceView } from "../utils/resource";
import { useSettingsStore } from "../stores/settingsStore";
import { useUserInitializationStore } from "../stores/userIndex";

export function useExploreScreen() {
  const fetchHome = useHomeStore((s) => s.fetchHome);
  const resource = useHomeStore((s) => s.resource);

  const cacheInvalidationTimestamp = useSettingsStore((s) => s.cacheInvalidationTimestamp);
  const isInitialized = useUserInitializationStore((s) => s.isInitialized);

  useEffect(() => {
    if (cacheInvalidationTimestamp > 0) {
      void fetchHome();
    }
  }, [cacheInvalidationTimestamp, fetchHome]);

  const homeData = resource.data != null && resource.dataKey === HOME_KEY ? resource.data : null;

  // The source exposes a single catalogue page, so this is one flat list.
  // There is no second section to label: the grid is the screen.
  const items = useMemo((): Anime[] => homeData?.recent ?? [], [homeData]);

  const view: ResourceView = deriveView(resource, HOME_KEY);
  const hasContent = isInitialized && view === "content";

  return {
    items,
    isLoading: isLoadingFor(resource, HOME_KEY) || !isInitialized,
    error: errorFor(resource, HOME_KEY),
    view,
    fetchHome,
    hasContent,
  };
}
