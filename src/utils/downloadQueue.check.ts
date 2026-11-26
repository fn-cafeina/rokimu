import assert from "node:assert/strict";
import {
  classifyFolders,
  downloadKey,
  drainStartable,
  hasDownloadFor,
  hydrateQueue,
  isWaiting,
  ownsKey,
  resumeTargets,
  type FolderRecord,
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

// Boot hydration: done entries without files are dropped, interrupted ones
// become queued again, and the resume list carries the same key
const onDisk = (e: QueuedEntry) => e.status !== "done" || e.number !== "2";
const hydrated = hydrateQueue(
  [
    entry({ number: "1", status: "done" }),
    entry({ number: "2", status: "done" }),
    entry({ number: "3", status: "downloading" }),
    entry({ number: "4", status: "error" }),
  ],
  (e) => downloadKey(e.slug, e.number, e.language),
  onDisk,
);
assert.deepEqual(hydrated.dropped.map((e) => e.number), ["2"]);
assert.equal(hydrated.kept[downloadKey("one-piece", "1", "Latino")]?.status, "done");
assert.equal(hydrated.kept[downloadKey("one-piece", "3", "Latino")]?.status, "queued");
assert.equal(hydrated.kept[downloadKey("one-piece", "4", "Latino")]?.status, "error");
assert.deepEqual(hydrated.resume.map((t) => t.number), ["3"]);
assert.equal(hydrated.resume[0]?.language, "Latino");

// A done entry with files on disk stays done and never resumes
const intact = hydrateQueue([entry({ status: "done" })], (e) => downloadKey(e.slug, e.number, e.language), () => true);
assert.deepEqual(intact.dropped, []);
assert.deepEqual(intact.resume, []);
assert.equal(intact.kept[downloadKey("one-piece", "1", "Latino")]?.status, "done");

// A free worker starts only entries that still wait, in queue order, and drops
// the ones that stopped waiting while they sat there
const waiting = new Set(["a", "c"]);
const stillWaits = (key: string) => waiting.has(key);
assert.deepEqual(drainStartable(["a", "b", "c"], (k) => k, stillWaits, 1), {
  start: ["a"],
  rest: ["c"],
});

// No free slot starts nothing and never reorders
assert.deepEqual(drainStartable(["a", "b", "c"], (k) => k, stillWaits, 0), {
  start: [],
  rest: ["a", "c"],
});

// Enough slots start every waiting entry
assert.deepEqual(drainStartable(["a", "b", "c"], (k) => k, stillWaits, 5), {
  start: ["a", "c"],
  rest: [],
});

// An empty queue is not a start
assert.deepEqual(drainStartable([], (k) => k, stillWaits, 3), { start: [], rest: [] });

// Boot reconciliation of the folders on disk. A folder the index lost comes
// back; one without a record or a playlist is dropped; one the index knows is
// left to the index
const record = (overrides: Partial<FolderRecord> = {}): FolderRecord => ({
  slug: "one-piece",
  number: "1",
  title: "One Piece",
  image: "",
  language: "Latino",
  createdAt: 1,
  ...overrides,
});
const keyOfRecord = (r: FolderRecord) => downloadKey(r.slug, r.number, r.language);

const lostIndex = classifyFolders(
  new Set(),
  [
    { record: record(), hasPlaylist: true },
    { record: record({ number: "2" }), hasPlaylist: true },
    { record: record({ number: "3" }), hasPlaylist: false },
    { record: null, hasPlaylist: true },
  ],
  keyOfRecord,
);
assert.deepEqual(lostIndex.adopt, [0, 1]);
assert.deepEqual(lostIndex.drop, [2, 3]);

// An entry the index still holds owns its folder, which is never deleted
const tracked = classifyFolders(
  new Set([downloadKey("one-piece", "1", "Latino")]),
  [{ record: record(), hasPlaylist: true }],
  keyOfRecord,
);
assert.deepEqual(tracked, { adopt: [], drop: [] });

// The same episode in two languages is two folders and two entries
const languages = classifyFolders(
  new Set([downloadKey("one-piece", "1", "Latino")]),
  [{ record: record({ language: null }), hasPlaylist: true }],
  keyOfRecord,
);
assert.deepEqual(languages.adopt, [0]);

// Two folders claiming the same key adopt one and leave the other unseen
const duplicated = classifyFolders(
  new Set(),
  [
    { record: record(), hasPlaylist: true },
    { record: record(), hasPlaylist: true },
  ],
  keyOfRecord,
);
assert.deepEqual(duplicated.adopt, [0]);
assert.deepEqual(duplicated.drop, []);

// A worker cleans up only while it still owns the key: cancel followed by a new
// download of the same episode keeps the new abort handle and its folder
const owned = new Map<string, string>([[key, "worker-2"]]);
assert.equal(ownsKey(owned, key, "worker-2"), true);
assert.equal(ownsKey(owned, key, "worker-1"), false);
owned.delete(key);
assert.equal(ownsKey(owned, key, "worker-2"), false);
assert.equal(ownsKey(owned, "other", "worker-2"), false);

console.log("download queue ok");
