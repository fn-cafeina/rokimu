import assert from "node:assert/strict";
import { commitFor } from "./catalogStore";
import { resourceInitialState, type ResourceState } from "@/utils/resource";
import type { BrowsePage } from "@/services/source";

const page = (slugs: string[], lastPage: number): BrowsePage => ({
  items: slugs.map((url) => ({ title: url, image: "", url, status: "" })),
  pagination: { page: 1, lastPage },
});

function state(patch: Partial<ResourceState<BrowsePage>>): ResourceState<BrowsePage> {
  return { ...resourceInitialState<BrowsePage>(), ...patch };
}

const settled = state({ status: "success", key: "q1", dataKey: "q1", data: page(["a", "b"], 3) });

// The payload brings its own grid: never a commit with data and no items
const commit = commitFor(settled, "q1");
assert.deepEqual(commit.items, settled.data?.items, "items commit with the payload");
assert.equal(commit.lastPage, 3, "last page comes from the payload");
assert.equal(commit.hasMore, true, "more pages when lastPage is past 1");

// A payload for a query the store has already left does not touch the grid
assert.deepEqual(commitFor(settled, "q2"), { resource: settled }, "stale payload keeps the grid alone");

// Single page means no extra requests
assert.equal(commitFor(state({ status: "success", key: "q1", dataKey: "q1", data: page(["a"], 1) }), "q1").hasMore, false);

// Loading and error states only carry the resource
const loading = state({ status: "loading", key: "q1" });
assert.deepEqual(commitFor(loading, "q1"), { resource: loading }, "loading keeps the grid untouched");

console.log("catalogStore.check.ts OK");
