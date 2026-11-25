import assert from "node:assert/strict";
import { failurePlan, timeoutPlan } from "./fetchRules";

const source = { isSourceOrigin: true, challengeBody: false };
const foreign = { isSourceOrigin: false, challengeBody: false };

// The source refusing means the session, not the network
assert.equal(failurePlan({ status: 403, ...source, hasMoreAttempts: true }), "wash");
assert.equal(failurePlan({ status: 401, ...source, hasMoreAttempts: true }), "wash");
// The same refusal from another host is that host's verdict
assert.equal(failurePlan({ status: 403, ...foreign, hasMoreAttempts: true }), "rejected");
assert.equal(failurePlan({ status: 401, ...foreign, hasMoreAttempts: true }), "rejected");

// A transient status is worth another try while attempts remain, and is handed
// to the caller on the last one
assert.equal(failurePlan({ status: 500, ...source, hasMoreAttempts: true }), "retry");
assert.equal(failurePlan({ status: 503, ...foreign, hasMoreAttempts: true }), "retry");
assert.equal(failurePlan({ status: 429, ...source, hasMoreAttempts: true }), "retry");
assert.equal(failurePlan({ status: 500, ...source, hasMoreAttempts: false }), "final");
assert.equal(failurePlan({ status: 429, ...source, hasMoreAttempts: false }), "final");

// A 4xx that is not auth is final on the first attempt
assert.equal(failurePlan({ status: 404, ...source, hasMoreAttempts: true }), "final");
assert.equal(failurePlan({ status: 400, ...foreign, hasMoreAttempts: true }), "final");

// A challenge page answered with a non-ok status is the session ladder, but only
// for the origin that owns the session
assert.equal(
  failurePlan({ status: 503, ...source, challengeBody: true, hasMoreAttempts: true }),
  "retry",
);
assert.equal(
  failurePlan({ status: 503, ...source, challengeBody: true, hasMoreAttempts: false }),
  "wash",
);
assert.equal(
  failurePlan({ status: 503, ...foreign, challengeBody: true, hasMoreAttempts: false }),
  "final",
);

// A timeout is retried once, not twice: the host is silent, not busy
assert.equal(timeoutPlan(0, 2), "retry");
assert.equal(timeoutPlan(1, 2), "final");
// One attempt configured reuses the same rule
assert.equal(timeoutPlan(0, 1), "final");

console.log("fetch rules ok");
