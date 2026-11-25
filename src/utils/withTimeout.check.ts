import assert from "node:assert/strict";
import { withTimeout } from "./withTimeout";
import { SourceError, isCancelled } from "./errors";

const never = (signal: AbortSignal) =>
  new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });

// A deadline with no answer settles as a real timeout, not as a cancellation
{
  const error = await withTimeout(undefined, 10, never).catch((e: unknown) => e);
  assert.ok(error instanceof SourceError);
  assert.equal(error.type, "TIMEOUT");
  assert.equal(isCancelled(error), false);
}

// The caller's own abort keeps its meaning: no timeout error is invented
{
  const caller = new AbortController();
  caller.abort();
  const error = await withTimeout(caller.signal, 5_000, never).catch((e: unknown) => e);
  assert.equal(isCancelled(error), true);
}

// A request that answers in time returns its value and leaves the signal alone
{
  const caller = new AbortController();
  const value = await withTimeout(caller.signal, 5_000, async () => "ok");
  assert.equal(value, "ok");
  assert.equal(caller.signal.aborted, false);
}

// The wrapped error wins over the deadline when the request failed on its own
{
  const error = await withTimeout(undefined, 5_000, async () => {
    throw new SourceError("HTTP 404", "VIDEO_ERROR");
  }).catch((e: unknown) => e);
  assert.ok(error instanceof SourceError);
  assert.equal(error.type, "VIDEO_ERROR");
}

console.log("with timeout ok");
