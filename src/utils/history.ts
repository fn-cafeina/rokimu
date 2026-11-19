import type { HistoryItem } from "@/types";

export function makeHistoryEntry(params: {
  title: string; image: string; url: string; number: string;
  progress?: number | null; duration?: number | null;
}): HistoryItem {
  return {
    title: params.title, image: params.image, url: params.url,
    number: params.number, progress: params.progress ?? undefined,
    duration: params.duration ?? undefined, timestamp: Date.now(),
  };
}

export function addToHistorySafe(
  addToHistoryFn: (item: HistoryItem) => Promise<void>,
  item: HistoryItem,
): void {
  void addToHistoryFn(item).catch(() => {});
}

export function findHistoryEntry(lastViewed: HistoryItem[], url: string, number: string): HistoryItem | undefined {
  return lastViewed.find((h) => h.url === url && h.number === number);
}
