/**
 * Pure rules shared by the download store and its self-check: no React, no
 * platform imports, so the queue logic runs without a device.
 */
export type DownloadStatus = "queued" | "downloading" | "done" | "error";

export interface QueuedEntry {
  slug: string;
  number: string;
  title: string;
  image: string;
  language: string | null;
  status: DownloadStatus;
}

export interface DownloadTarget {
  slug: string;
  number: string;
  title: string;
  image: string;
  language: string | null;
}

/**
 * One episode can keep several languages, so the language is part of the key.
 * Every caller must build the key the same way: a key derived from a different
 * language points at an entry that does not exist.
 */
export function downloadKey(slug: string, number: string, language: string | null): string {
  return `${slug}_${number}_${language ?? "default"}`;
}

/**
 * Entries an interrupted launch must pick up again. The language travels with
 * the target: without it the worker computes another key, skips the entry and
 * leaves it queued forever.
 */
export function resumeTargets(entries: QueuedEntry[]): DownloadTarget[] {
  return entries
    .filter((entry) => entry.status === "queued")
    .map((entry) => ({
      slug: entry.slug,
      number: entry.number,
      title: entry.title,
      image: entry.image,
      language: entry.language,
    }));
}

/** True when this anime has any copy on the device, finished or still running. */
export function hasDownloadFor(entries: QueuedEntry[], slug: string): boolean {
  return entries.some((entry) => entry.slug === slug);
}

/** A worker only starts an entry that is still waiting for one. */
export function isWaiting(entries: Record<string, QueuedEntry>, key: string): boolean {
  return entries[key]?.status === "queued";
}
