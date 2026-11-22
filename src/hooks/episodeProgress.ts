import type { Episode, HistoryItem } from "@/types";
import { calcProgress } from "@/utils/math";
import { findHistoryEntry } from "@/utils/history";

/** Share of an episode that counts as watched, matching the row strike. */
export const WATCHED_THRESHOLD = 0.9;

interface EpisodeProgress {
  episode: Episode;
  /** Position in the ordered list, so the CTA can move in reading order. */
  index: number;
  /** Watched share, 0 to 1. */
  ratio: number;
  /** Last time the episode was played. */
  timestamp: number;
}

/** Progress of every listed episode that was actually played. */
export function collectEpisodeProgress(
  ordered: Episode[],
  lastViewed: HistoryItem[],
  slug: string,
): EpisodeProgress[] {
  const out: EpisodeProgress[] = [];
  ordered.forEach((episode, index) => {
    const entry = findHistoryEntry(lastViewed, slug, episode.number);
    const ratio = calcProgress(entry?.progress, entry?.duration);
    if (entry == null || ratio <= 0) return;
    out.push({ episode, index, ratio, timestamp: entry.timestamp });
  });
  return out;
}

export function isWatched(progress: EpisodeProgress): boolean {
  return progress.ratio >= WATCHED_THRESHOLD;
}

/**
 * Episode the detail CTA opens. An episode in progress keeps the CTA; a
 * finished one hands it to the first unwatched episode after it, in reading
 * order. Null means there is nothing to continue with: every episode watched,
 * or the last played episode is no longer in the list. The screen turns null
 * into a rewatch CTA instead of hiding the button.
 */
export function pickCtaEpisode(
  ordered: Episode[],
  progress: EpisodeProgress[],
): { episode: Episode; continuing: boolean } | null {
  if (progress.length === 0) return null;

  const latest = progress.reduce((best, current) =>
    current.timestamp > best.timestamp ? current : best,
  );

  if (!isWatched(latest)) return { episode: latest.episode, continuing: true };

  const watched = new Set(progress.filter(isWatched).map((item) => item.index));
  for (let index = latest.index + 1; index < ordered.length; index += 1) {
    if (!watched.has(index)) {
      const next = ordered[index];
      if (next != null) return { episode: next, continuing: true };
    }
  }
  return null;
}
