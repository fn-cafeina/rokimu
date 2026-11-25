import assert from "node:assert/strict";
import { isValidSessionCookies, washOutcome } from "./sessionRules";

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

console.log("session rules ok");
