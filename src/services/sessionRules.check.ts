import assert from "node:assert/strict";
import { isValidSessionCookies, shouldSkipWash, washOutcome, WASH_FAIL_FAST_WINDOW } from "./sessionRules";

// A jar without clearance passes no gate, even when it is full of cookies
assert.equal(isValidSessionCookies(""), false);
assert.equal(isValidSessionCookies(undefined), false);
assert.equal(isValidSessionCookies(null), false);
assert.equal(isValidSessionCookies("_ga=1; _fbp=2"), false);
assert.equal(isValidSessionCookies("_ga=1; cf_clearance=abc123"), true);

// No report: the page never answered, whatever the stored jar says
assert.deepEqual(washOutcome(false, "cf_clearance=abc"), { ok: false, reason: "no-report" });

// A settled report with no clearance: the page ran and the challenge survived
assert.deepEqual(washOutcome(true, "_ga=1"), { ok: false, reason: "no-clearance" });
assert.deepEqual(washOutcome(true, undefined), { ok: false, reason: "no-clearance" });

// A settled report that left clearance is the only success
assert.deepEqual(washOutcome(true, "_ga=1; cf_clearance=abc"), { ok: true });

// A wash that failed moments ago is skipped, so stacked requests do not queue
// four 40s waits; the window expires and the next wash runs
assert.equal(shouldSkipWash(0, 1_000_000), false);
assert.equal(shouldSkipWash(1_000_000, 1_000_001), true);
assert.equal(shouldSkipWash(1_000_000, 1_000_000 + WASH_FAIL_FAST_WINDOW - 1), true);
assert.equal(shouldSkipWash(1_000_000, 1_000_000 + WASH_FAIL_FAST_WINDOW), false);

console.log("session rules ok");
