import assert from "node:assert/strict";
import { isPendingFor, resourceInitialState, type ResourceState } from "./resource";

function state<T>(patch: Partial<ResourceState<T>>): ResourceState<T> {
  return { ...resourceInitialState<T>(), ...patch };
}

// Idle after typing: no request started yet, so the term is still pending
assert.equal(isPendingFor(state<string[]>({ status: "idle" }), "naruto"), true);

// In flight for another term is pending too, stale payload or not
assert.equal(isPendingFor(state<string[]>({ status: "loading", key: "bleach" }), "naruto"), true);

// Settled payload for this term is not pending
assert.equal(
  isPendingFor(state<string[]>({ status: "success", key: "naruto", dataKey: "naruto", data: [] }), "naruto"),
  false,
);

// Same term while refreshing keeps the settled payload on screen
assert.equal(
  isPendingFor(state<string[]>({ status: "loading", key: "naruto", dataKey: "naruto", data: [] }), "naruto"),
  false,
);

// A failure for this term belongs to the error state, not to the loader
assert.equal(
  isPendingFor(state<string[]>({ status: "error", key: "naruto", error: null }), "naruto"),
  false,
);

// A failure for the previous term does not block the new one
assert.equal(isPendingFor(state<string[]>({ status: "error", key: "bleach" }), "naruto"), true);

console.log("resource.check.ts OK");
