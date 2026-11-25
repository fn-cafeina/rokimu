/**
 * The rules the session manager acts on, kept apart from the WebView timing.
 * Pure: the self-check runs them without a worker or a device.
 */

/**
 * The jar is only usable when Cloudflare's clearance cookie is in it: a jar of
 * telemetry cookies alone passes validation but still answers 403 downstream.
 * Coupled to the cookie name; Cloudflare has kept `cf_clearance` for years.
 */
const CLEARANCE_COOKIE = "cf_clearance=";

export function isValidSessionCookies(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return raw.includes(CLEARANCE_COOKIE);
}

/**
 * A wash that just failed must not stack a second 40s wait: the requests behind
 * it hang while Cloudflare is down. The next fetch decides instead.
 */
export const WASH_FAIL_FAST_WINDOW = 15_000;

export function shouldSkipWash(lastFailedAt: number, now: number): boolean {
  return lastFailedAt > 0 && now - lastFailedAt < WASH_FAIL_FAST_WINDOW;
}

export type WashOutcome =
  | { ok: true }
  | { ok: false; reason: "no-report" | "no-clearance" };

/**
 * A wash succeeds only when the worker's cookie report settled and the jar it
 * left carries clearance. The two failures need different follow-ups: no report
 * means the page may be wedged, no clearance means it ran and still failed.
 */
export function washOutcome(
  settled: boolean,
  cookies: string | undefined | null,
): WashOutcome {
  if (!settled) return { ok: false, reason: "no-report" };
  if (!isValidSessionCookies(cookies)) return { ok: false, reason: "no-clearance" };
  return { ok: true };
}
