/**
 * Native network failures arrive as exception names, not typed errors, and the
 * generic downloader hides the status inside its message. Pure: the self-check
 * runs without a device or a network.
 */

/** The native downloader reports the HTTP status only inside its error message. */
export function statusOf(error: unknown): number | null {
  const message = error instanceof Error ? error.message : "";
  const match = /status: (\d{3})/.exec(message);
  return match?.[1] != null ? parseInt(match[1], 10) : null;
}

// A connection that never opened or reset itself is worth another attempt. A
// refused certificate is not: no retry makes a TLS error go away.
const TRANSIENT =
  /SocketTimeoutException|ConnectException|UnknownHostException|failed to connect|Unable to resolve host|Connection reset|connection abort|stream was reset/i;

export function isTransient(error: unknown): boolean {
  return TRANSIENT.test(error instanceof Error ? error.message : "");
}

/**
 * Whether a second request could answer differently: the CDN refuses bursts
 * with 429, drops one socket under load with 5xx, and a dead host resets.
 */
export function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  return status === 429 || (status != null && status >= 500) || isTransient(error);
}
