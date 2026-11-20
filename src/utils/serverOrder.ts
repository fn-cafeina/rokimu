import type { VideoServer } from "@/types";

/**
 * The preferred server jumps the queue; the rest keep the site's order. A
 * preference the episode does not offer changes nothing, so the fallback
 * ladder still runs in site order.
 */
export function orderServers(servers: VideoServer[], preferred: string | null): VideoServer[] {
  if (preferred == null) return servers;
  const first = servers.filter((s) => s.title === preferred);
  if (first.length === 0) return servers;
  return [...first, ...servers.filter((s) => s.title !== preferred)];
}
