import type { VideoServer } from "@/types";

function sameTitle(title: string, name: string | null): boolean {
  if (name == null) return false;
  // The site owns these names: a stray space or case change must not silently
  // disable the user's preference
  return title.trim().toLowerCase() === name.trim().toLowerCase();
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
