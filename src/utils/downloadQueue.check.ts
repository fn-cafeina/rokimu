import assert from "node:assert/strict";
import {
  downloadKey,
  hasDownloadFor,
  isWaiting,
  resumeTargets,
  type QueuedEntry,
} from "./downloadQueue";

const entry = (overrides: Partial<QueuedEntry> = {}): QueuedEntry => ({
  slug: "one-piece",
  number: "1",
  title: "One Piece",
  image: "",
  language: "Latino",
  status: "queued",
  ...overrides,
});

// The language is part of the key, and the default keeps its own slot
assert.equal(downloadKey("one-piece", "1", "Latino"), "one-piece_1_Latino");
assert.equal(downloadKey("one-piece", "1", null), "one-piece_1_default");
assert.notEqual(downloadKey("one-piece", "1", "Latino"), downloadKey("one-piece", "1", null));

// Only queued work resumes
assert.deepEqual(resumeTargets([entry({ status: "done" }), entry({ status: "downloading" })]), []);
assert.deepEqual(resumeTargets([entry({ status: "error" })]), []);

// A resumed target keeps its language, so the worker finds the same entry
const [resumed] = resumeTargets([entry()]);
assert.equal(resumed?.language, "Latino");
assert.equal(downloadKey(resumed!.slug, resumed!.number, resumed!.language), downloadKey("one-piece", "1", "Latino"));
assert.equal(resumed?.title, "One Piece");

// A default-language entry resumes under the default key
const [plain] = resumeTargets([entry({ language: null })]);
assert.equal(downloadKey(plain!.slug, plain!.number, plain!.language), "one-piece_1_default");

// Any status means the anime is on the device
assert.equal(hasDownloadFor([entry({ status: "queued" })], "one-piece"), true);
assert.equal(hasDownloadFor([entry({ status: "downloading" })], "one-piece"), true);
assert.equal(hasDownloadFor([entry({ status: "done" })], "one-piece"), true);
assert.equal(hasDownloadFor([entry({ status: "error" })], "one-piece"), true);
assert.equal(hasDownloadFor([entry()], "other-anime"), false);
assert.equal(hasDownloadFor([], "one-piece"), false);

// Only a waiting entry may start
const key = downloadKey("one-piece", "1", "Latino");
assert.equal(isWaiting({ [key]: entry() }, key), true);
assert.equal(isWaiting({ [key]: entry({ status: "downloading" }) }, key), false);
assert.equal(isWaiting({}, key), false);

console.log("download queue ok");
