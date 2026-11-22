import type { Anime } from "@/types";

/**
 * Browse pages shift between requests: a series published today pushes the
 * previous page's last card into the next one. Appending by slug keeps a card
 * from showing twice, and `added` is the only proof another page exists.
 */
export function appendPage(current: Anime[], incoming: Anime[]): { items: Anime[]; added: number } {
  if (incoming.length === 0) return { items: current, added: 0 };
  const seen = new Set(current.map((item) => item.url));
  const fresh: Anime[] = [];
  for (const item of incoming) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    fresh.push(item);
  }
  if (fresh.length === 0) return { items: current, added: 0 };
  return { items: [...current, ...fresh], added: fresh.length };
}
