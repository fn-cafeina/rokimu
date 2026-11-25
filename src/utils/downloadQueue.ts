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

interface DownloadTarget {
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

interface HydratedQueue<T extends QueuedEntry> {
  /** Entries that survive the boot, keyed as the store keys them */
  kept: Record<string, T>;
  /** Done entries whose files vanished: dropped, never offered as playable */
  dropped: T[];
  /** Interrupted work to queue again, language included */
  resume: DownloadTarget[];
}

/**
 * Boot hydration of the download index: a done entry without its files on disk
 * is dropped, an interrupted one becomes queued again, and the resume list
 * carries the language so the worker rebuilds the same key.
 */
export function hydrateQueue<T extends QueuedEntry>(
  entries: T[],
  keyOf: (entry: T) => string,
  isOnDisk: (entry: T) => boolean,
): HydratedQueue<T> {
  const kept: Record<string, T> = {};
  const dropped: T[] = [];
  for (const entry of entries) {
    if (entry.status === "done" && !isOnDisk(entry)) {
      dropped.push(entry);
      continue;
    }
    kept[keyOf(entry)] =
      entry.status === "downloading" ? ({ ...entry, status: "queued" } as T) : entry;
  }
  return { kept, dropped, resume: resumeTargets(Object.values(kept)) };
}

/** What a finished download leaves next to its files, so the folder explains itself. */
export interface FolderRecord {
  slug: string;
  number: string;
  title: string;
  image: string;
  language: string | null;
  createdAt: number;
}

/** A folder found under `downloads/`, with whatever it could say about itself. */
export interface DownloadedFolder {
  dirUri: string;
  playlistUri: string | null;
  hasPlaylist: boolean;
  /** null for a folder written before the record existed, or a cut-short write */
  record: FolderRecord | null;
}

/**
 * Boot reconciliation of the folders on disk against the index. A folder the
 * index lost is adopted (its playlist still plays); one that cannot say what it
 * holds, or lost its playlist, is dropped instead of sitting there unseen.
 * Returns indexes, so the caller keeps the folder list and the file access.
 */
export function classifyFolders(
  keptKeys: ReadonlySet<string>,
  folders: Pick<DownloadedFolder, "record" | "hasPlaylist">[],
  keyOf: (record: FolderRecord) => string,
): { adopt: number[]; drop: number[] } {
  const adopt: number[] = [];
  const drop: number[] = [];
  const claimed = new Set(keptKeys);
  folders.forEach((folder, index) => {
    if (!folder.hasPlaylist || folder.record == null) {
      drop.push(index);
      return;
    }
    const key = keyOf(folder.record);
    if (claimed.has(key)) return;
    claimed.add(key);
    adopt.push(index);
  });
  return { adopt, drop };
}

/**
 * What a free worker may start now, in queue order. An item whose entry stopped
 * waiting (removed, finished, mismatched) leaves the queue for good; everything
 * past the free slots stays queued, in order.
 */
export function drainStartable<T>(
  queue: T[],
  keyOf: (item: T) => string,
  isWaiting: (key: string) => boolean,
  freeSlots: number,
): { start: T[]; rest: T[] } {
  const start: T[] = [];
  const rest: T[] = [];
  for (const item of queue) {
    const key = keyOf(item);
    if (!isWaiting(key)) continue;
    if (start.length < freeSlots) start.push(item);
    else rest.push(item);
  }
  return { start, rest };
}
