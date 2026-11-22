import type { VideoServer } from "@/types";

// OkHttp, behind expo-file-system's downloads, allows 5 requests per host
const SEGMENT_CONCURRENCY = 5;
const EPSILON_SEGMENT_CONCURRENCY = 4;

/**
 * The first word of a title: the site appends suffixes ("Delta 2", "Epsilon HD")
 * and a rename there must not silently disable the user's preference.
 */
function family(value: string): string {
  return value.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0] ?? "";
}

function sameTitle(title: string, name: string | null): boolean {
  if (name == null) return false;
  // The site owns these names: a stray space or case change must not silently
  // disable the user's preference
  return family(title) === family(name);
}

/**
 * The preferred server jumps the queue; the rest keep the site's order. A
 * preference the episode does not offer changes nothing, so the fallback
 * ladder still runs in site order.
 */
export function orderServers(servers: VideoServer[], preferred: string | null): VideoServer[] {
  if (preferred == null) return servers;
  const first = servers.filter((s) => sameTitle(s.title, preferred));
  if (first.length === 0) return servers;
  return [...first, ...servers.filter((s) => !sameTitle(s.title, preferred))];
}

/**
 * Segments to keep in flight for a server. Epsilon's CDN answers 429 above
 * four requests; Delta takes all five the HTTP client runs per host.
 */
export function segmentConcurrencyFor(title: string): number {
  return family(title) === "epsilon" ? EPSILON_SEGMENT_CONCURRENCY : SEGMENT_CONCURRENCY;
}

/**
 * The same server in a freshly fetched list: id first, then name and language.
 * Never a substitute — playback plays what the user chose or fails.
 */
export function findServer(servers: VideoServer[], chosen: VideoServer): VideoServer | null {
  return (
    servers.find((s) => s.id === chosen.id) ??
    servers.find((s) => sameTitle(s.title, chosen.title) && s.language === chosen.language) ??
    null
  );
}
