import { useEffect, useMemo } from "react";
import type { Anime } from "../types";
import { HOME_KEY, useHomeStore } from "../stores/homeStore";
import { deriveView, errorFor, isLoadingFor, type ResourceView } from "../utils/resource";
import { useSettingsStore } from "../stores/settingsStore";
import { useUserInitializationStore } from "../stores/userIndex";

export type ExploreSection =
  | { type: "SECTION"; label: string; items: Anime[] };

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

  const sections = useMemo((): ExploreSection[] => {
    if (homeData != null && homeData.recent.length > 0) {
      return [{ type: "SECTION", label: "Recién agregados", items: homeData.recent }];
    }
    return [];
  }, [homeData]);

  const view: ResourceView = deriveView(resource, HOME_KEY);
  const hasContent = isInitialized && view === "content";

  return {
    sections,
    isLoading: isLoadingFor(resource, HOME_KEY) || !isInitialized,
    error: errorFor(resource, HOME_KEY),
    view,
    fetchHome,
    hasContent,
  };
}
