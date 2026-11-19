import { useEffect, useMemo, useState } from "react";
import { useDownloadsStore } from "../stores/downloadsStore";
import { useSavedStore } from "../stores/savedStore";
import type { AnimeDetail } from "../types";
import { loadAnimeSnapshot, saveAnimeSnapshot } from "../utils/animeSnapshot";
import { logger } from "../utils/logger";

/** A library anime, or one with a downloaded episode, is worth having offline. */
export function isWorthKeepingOffline(slug: string): boolean {
  const saved = useSavedStore.getState().saved.some((item) => item.url === slug);
  if (saved) return true;
  return Object.values(useDownloadsStore.getState().entries).some(
    (entry) => entry.slug === slug && entry.status === "done",
  );
}

/**
 * The detail as saved on the device. Read before the network answers, so an
 * open with no connection shows the episode list instead of a skeleton and a
 * timeout, and rewritten on every successful load.
 */
export function useAnimeSnapshot(slug: string, detail: AnimeDetail | null): AnimeDetail | null {
  const saved = useSavedStore((s) => s.saved);
  const entries = useDownloadsStore((s) => s.entries);
  const keep = useMemo(
    () =>
      saved.some((item) => item.url === slug) ||
      Object.values(entries).some((entry) => entry.slug === slug && entry.status === "done"),
    [saved, entries, slug],
  );
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
