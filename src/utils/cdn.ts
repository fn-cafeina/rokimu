/**
 * Download tuning that depends on who answers. Pure: no platform imports, so
 * the self-check runs without a device.
 */

/**
 * expo-file-system downloads through a shared OkHttpClient that hands the call
 * to the Dispatcher, whose default ceiling is 5 requests per host: anything
 * above that waits in its queue instead of opening a connection, so a bigger
 * pool only adds idle JS workers. Raising this needs a different client.
 */
const DEFAULT_SEGMENT_CONCURRENCY = 5;
const THROTTLED_SEGMENT_CONCURRENCY = 4;
const THROTTLED_HOSTS = ["tnmr.org", "cdn-tnmr.org"];

function hostOf(uri: string): string {
  try {
    return new URL(uri).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * How many segments to keep in flight for these URIs. One server's rate limit
 * must not slow the others down, so the pool is decided by the host that
 * actually serves the bytes.
 */
export function segmentConcurrency(uris: string[]): number {
  const throttled = uris.some((uri) => {
    const host = hostOf(uri);
    return THROTTLED_HOSTS.some((name) => host === name || host.endsWith(`.${name}`));
  });
  return throttled ? THROTTLED_SEGMENT_CONCURRENCY : DEFAULT_SEGMENT_CONCURRENCY;
}
