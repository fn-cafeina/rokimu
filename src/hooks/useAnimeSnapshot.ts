import { useEffect, useState } from "react";
import { useDownloadsStore } from "@/stores/downloadsStore";
import { useSavedStore } from "@/stores/savedStore";
import type { AnimeDetail } from "@/types";
import { loadAnimeSnapshot, saveAnimeSnapshot } from "@/utils/animeSnapshot";
import { hasDownloadFor } from "@/utils/downloadQueue";
import { logger } from "@/utils/logger";

/** A library anime, or one with a downloaded episode, is worth having offline. */
export function isWorthKeepingOffline(slug: string): boolean {
  const saved = useSavedStore.getState().saved.some((item) => item.url === slug);
  if (saved) return true;
  return hasDownloadFor(Object.values(useDownloadsStore.getState().entries), slug);
}

/**
 * The detail as saved on the device. Read before the network answers, so an
 * open with no connection shows the episode list instead of a skeleton and a
 * timeout, and rewritten on every successful load.
 */
export function useAnimeSnapshot(slug: string, detail: AnimeDetail | null): AnimeDetail | null {
  // Booleans, not the lists: a segment tick replaces the entries object and
  // would repaint every screen that renders this hook
  const saved = useSavedStore((s) => s.saved.some((item) => item.url === slug));
  const downloaded = useDownloadsStore((s) => hasDownloadFor(Object.values(s.entries), slug));
  const keep = saved || downloaded;
  // The slug travels with the payload so a copy for another anime is never shown
  const [loaded, setLoaded] = useState<{ slug: string; detail: AnimeDetail } | null>(null);

  useEffect(() => {
    let active = true;
    void loadAnimeSnapshot(slug).then((snapshot) => {
      if (!active || snapshot == null) return;
      logger.debug("snapshot", `Serving the saved detail of ${slug} (${snapshot.episodes.length} episodes)`);
      setLoaded({ slug, detail: snapshot });
    });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (detail == null || !keep) return;
    void saveAnimeSnapshot(slug, detail);
  }, [detail, keep, slug]);

  return loaded != null && loaded.slug === slug ? loaded.detail : null;
}
