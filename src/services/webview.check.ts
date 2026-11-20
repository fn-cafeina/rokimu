import assert from "node:assert/strict";
import { WebViewBridge } from "./webview";

const injected: string[] = [];
const bridge = new WebViewBridge();
bridge.registerInjector((js) => { injected.push(js); });

// No page, no injected JS: the caller gets a failure instead of a hang
const notLoaded = await bridge.fetchInPage("https://example.com/ver/x/1", 10);
assert.deepEqual(notLoaded, { ok: false, error: "worker not ready" });
assert.equal(injected.length, 0);

bridge.setLoaded(true);

const okRequest = bridge.fetchInPage("https://example.com/ver/x/1", 50);
assert.equal(injected.length, 1);
// The script carries the request id the answer comes back with
assert.match(injected[0]!, /id: 1/);
assert.match(injected[0]!, /https:\/\/example\.com\/ver\/x\/1/);
assert.match(injected[0]!, /credentials: "include"/);

// Ids are matched, not assumed in order: a stray answer never resolves a waiter
assert.equal(bridge.handleHttp({ id: 99, status: 200, body: "nope" }), false);
assert.equal(bridge.handleHttp({ id: 1, status: 200, body: "<html>players</html>" }), true);
assert.deepEqual(await okRequest, { ok: true, status: 200, body: "<html>players</html>" });
// One answer per request
assert.equal(bridge.handleHttp({ id: 1, status: 200, body: "again" }), false);

// A page-level failure (CORS, aborted fetch) resolves as a failure, not a throw
const failing = bridge.fetchInPage("https://example.com/ver/x/2", 50);
bridge.handleHttp({ id: 2, error: "NetworkError: Failed to fetch" });
assert.deepEqual(await failing, { ok: false, error: "NetworkError: Failed to fetch" });

// A request that never answers settles as timeout, and its late answer is dropped
const slow = bridge.fetchInPage("https://example.com/ver/x/3", 10);
assert.deepEqual(await slow, { ok: false, error: "timeout" });
assert.equal(bridge.handleHttp({ id: 3, status: 200, body: "late" }), false);

// While a navigation loads, requests fail fast rather than race the page swap
bridge.setLoaded(false);
assert.deepEqual(await bridge.fetchInPage("https://example.com/ver/x/4", 10), { ok: false, error: "worker not ready" });

console.log("webview bridge ok");
