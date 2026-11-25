import { useCallback, useEffect, useState } from "react";
import { storage } from "@/utils/storage";
import { logger } from "@/utils/logger";

/** One remembered episode range per anime, pruned at boot like saved detail. */
const RANGE_KEY_PREFIX = "range_";

const rangeKey = (slug: string) => `${RANGE_KEY_PREFIX}${slug}`;

/** Boot sweep: a range for an anime nobody keeps only counts against the cap. */
export function prunePersistedRanges(keep: (slug: string) => boolean): Promise<void> {
  return storage.prunePrefix(RANGE_KEY_PREFIX, keep);
}

export function usePersistedRange(slug: string | undefined) {
  const [activeRangeIdx, setActiveRangeIdx] = useState(0);
  const [isRestoring, setIsRestoring] = useState(slug != null);
  // Reset during render on slug change so a stale range is never shown
  const [prevSlug, setPrevSlug] = useState<string | undefined>(slug);

  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setActiveRangeIdx(0);
    setIsRestoring(slug != null);
  }

  useEffect(() => {
    if (slug == null) return;
    storage
      .get<number>(rangeKey(slug))
      .then((idx) => {
        setActiveRangeIdx(idx ?? 0);
        setIsRestoring(false);
      })
      .catch((error) => {
        logger.error("detail", "Failed to load persisted range", error);
        setActiveRangeIdx(0);
        setIsRestoring(false);
      });
  }, [slug]);

  const setAndPersist = useCallback(
    (idx: number) => {
      setActiveRangeIdx(idx);
      if (slug != null) {
        storage.set(rangeKey(slug), idx).catch((error) => {
          logger.error("detail", "Failed to persist range", error);
        });
      }
    },
    [slug],
  );

  return [activeRangeIdx, setAndPersist, isRestoring] as const;
}

