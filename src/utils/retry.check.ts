import assert from "node:assert/strict";
import { withAuthRetry } from "./retry";
import { SourceError } from "./errors";

const authError = () => new SourceError("challenge", "AUTH_ERROR");
const networkError = () => new SourceError("offline", "NETWORK_ERROR");

function counter(): { calls: number; hit: () => void } {
  let calls = 0;
  return { get calls() { return calls; }, hit: () => { calls += 1; } };
}

async function run() {
  // An auth error washes the session once and retries: the ladder's whole job
  {
    const refresh = counter();
    let attempts = 0;
    const result = await withAuthRetry(
      async (attempt) => {
        attempts += 1;
        if (attempt === 0) throw authError();
        return "ok";
      },
      { tag: "check", maxRetries: 1, refresh: async () => { refresh.hit(); } },
    );
    assert.equal(result, "ok");
    assert.equal(attempts, 2);
    assert.equal(refresh.calls, 1);
  }

  // Any other failure is final: no wash, no second request, same error out
  for (const make of [networkError, () => new SourceError("video", "VIDEO_ERROR")]) {
    const refresh = counter();
    let attempts = 0;
    await assert.rejects(
      withAuthRetry(
        async () => {
          attempts += 1;
          throw make();
        },
        { tag: "check", maxRetries: 2, refresh: async () => { refresh.hit(); } },
      ),
      (error: unknown) => error === (error as { type?: string }) && (error as { type: string }).type === make().type,
    );
    assert.equal(attempts, 1);
    assert.equal(refresh.calls, 0);
  }

  // A failed wash never stops the ladder: the retry still runs and its error wins
  {
    const refresh = counter();
    let attempts = 0;
    const failure = await withAuthRetry(
      async () => {
        attempts += 1;
        throw authError();
      },
      {
        tag: "check",
        maxRetries: 1,
        refresh: async () => {
          refresh.hit();
          throw networkError();
        },
      },
    ).catch((error: unknown) => error);
    assert.equal(attempts, 2);
    assert.equal(refresh.calls, 1);
    assert.equal((failure as { type?: string }).type, "AUTH_ERROR");
  }

  // Cancelling before an attempt stops the ladder without touching the network
  {
    const refresh = counter();
    const controller = new AbortController();
    controller.abort();
    let attempts = 0;
    await assert.rejects(
      withAuthRetry(
        async () => {
          attempts += 1;
          return "never";
        },
        { tag: "check", maxRetries: 2, signal: controller.signal, refresh: async () => { refresh.hit(); } },
      ),
      (error: unknown) => (error as { name?: string }).name === "AbortError",
    );
    assert.equal(attempts, 0);
    assert.equal(refresh.calls, 0);
  }

  // maxRetries 0 disables the ladder entirely
  {
    const refresh = counter();
    let attempts = 0;
    await assert.rejects(
      withAuthRetry(
        async () => {
          attempts += 1;
          throw authError();
        },
        { tag: "check", maxRetries: 0, refresh: async () => { refresh.hit(); } },
      ),
      (error: unknown) => (error as { type?: string }).type === "AUTH_ERROR",
    );
    assert.equal(attempts, 1);
    assert.equal(refresh.calls, 0);
  }

  console.log("auth ladder ok");
}

await run();
