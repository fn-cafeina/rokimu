import { SourceError } from "./errors";

/**
 * Runs one request under a deadline. A timeout and the caller walking away are
 * different outcomes and must not be confused: a timeout is a real failure the
 * UI reports and the ladder may retry, a cancellation is the caller's abort and
 * stays one. Hand-rolling this per service got that wrong in more than one place.
 */
export async function withTimeout<T>(
  signal: AbortSignal | undefined,
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMessage = "Request timed out",
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  // Already cancelled: never start the request, and never wait on a signal
  // whose abort event has already fired
  if (signal?.aborted) {
    const cancelled = new Error("Request cancelled");
    cancelled.name = "AbortError";
    throw cancelled;
  }
  signal?.addEventListener("abort", onAbort, { once: true });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);

  try {
    return await fn(controller.signal);
  } catch (error) {
    // Our own deadline, not the caller's: the caller signal stays untouched
    if (timedOut && signal?.aborted !== true) {
      throw new SourceError(timeoutMessage, "TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
