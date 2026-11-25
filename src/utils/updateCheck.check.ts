import assert from "node:assert/strict";
import {
  CHECK_INTERVAL_MS,
  EMPTY_CHECK,
  dataFromStored,
  isNewer,
  parseStoredCheck,
  shouldCheck,
} from "./updateCheck";

const now = 1_000_000_000;

// A launch with nothing stored always checks
assert.equal(shouldCheck(EMPTY_CHECK.checkedAt, now), true);
assert.equal(shouldCheck(0, now), true);

// Inside the window the anchor holds, so no request is spent
assert.equal(shouldCheck(now - 1000, now), false);
assert.equal(shouldCheck(now - CHECK_INTERVAL_MS + 1, now), false);

// The window lapsing re-arms the check
assert.equal(shouldCheck(now - CHECK_INTERVAL_MS, now), true);

// A clock that jumped backwards does not lock the throttle forever
assert.equal(shouldCheck(now + 5000, now - 1), false);
assert.equal(shouldCheck(-1, now), true);

const valid = { checkedAt: now, etag: "W/\"abc\"", tag: "1.1.2", apkUrl: "https://x/rokimu.apk" };
assert.deepEqual(parseStoredCheck(valid), valid, "a full blob round trips");
assert.deepEqual(
  parseStoredCheck({ checkedAt: 0, etag: null, tag: null, apkUrl: null }),
  EMPTY_CHECK,
  "an empty blob round trips",
);
assert.equal(parseStoredCheck(null), null);
assert.equal(parseStoredCheck("1.1.2"), null);
assert.equal(parseStoredCheck({}), null, "no anchor is not a blob");
assert.equal(parseStoredCheck({ ...valid, checkedAt: Number.NaN }), null, "a broken anchor is dropped");
assert.equal(parseStoredCheck({ ...valid, etag: 5 }), null, "a non-string etag is dropped");
assert.equal(parseStoredCheck({ ...valid, tag: undefined }), null, "a missing tag is dropped");

// Version compare: numeric per component, missing parts are zero
assert.equal(isNewer("1.1.2", "1.1.1"), true);
assert.equal(isNewer("1.2", "1.1.9"), true);
assert.equal(isNewer("1.1.1", "1.1.1"), false);
assert.equal(isNewer("1.1.1", "1.2"), false);
assert.equal(isNewer("2", "1.9.9"), true);

// What the stored answer may offer: only a newer, non-prerelease with an APK
assert.deepEqual(dataFromStored(valid, "1.1.1"), {
  updateAvailable: "1.1.2",
  apkUrl: valid.apkUrl,
});
assert.equal(dataFromStored(valid, "1.1.2"), null, "the installed version offers nothing");
assert.equal(dataFromStored(valid, "1.1.3"), null, "a downgrade offers nothing");
assert.equal(dataFromStored({ ...valid, tag: "1.1.3-beta.1" }, "1.1.2"), null, "a prerelease offers nothing");
assert.equal(dataFromStored({ ...valid, apkUrl: null }, "1.1.1"), null, "a release without an APK offers nothing");
assert.equal(dataFromStored(EMPTY_CHECK, "1.1.1"), null, "an empty blob offers nothing");

console.log("update check ok");
