import assert from "node:assert/strict";
import { canResumeFolder, markerFor } from "./downloadResume";

const first = markerFor({ id: "17" });
const second = markerFor({ id: "42" });

// Same server, same format: the segments on disk are reused
assert.equal(canResumeFolder(true, first, markerFor({ id: "17" })), true);
assert.equal(canResumeFolder(true, `${first}\r\n`, markerFor({ id: "17" })), true);

// Another server wrote the folder: every byte is suspect, start over
assert.equal(canResumeFolder(true, second, first), false);

// A fresh download never reuses a folder, marker or not
assert.equal(canResumeFolder(false, first, first), false);

// Folders from before the marker existed are wiped
assert.equal(canResumeFolder(true, null, first), false);
assert.equal(canResumeFolder(true, "", first), false);

// The marker carries the format version too, so a format bump invalidates it
assert.equal(first.startsWith("aes-key-v1:"), true);

console.log("download resume ok");
