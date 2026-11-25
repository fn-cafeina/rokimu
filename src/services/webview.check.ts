import assert from "node:assert/strict";
import { WebViewBridge } from "./webview";

const bridge = new WebViewBridge();

// Without a registered page there is nothing to navigate or reload
const navigated: string[] = [];
let reloads = 0;
assert.equal(bridge.canNavigate(), false);
bridge.navigateTo("https://example.com/");
bridge.reload();
assert.equal(navigated.length, 0);
assert.equal(reloads, 0);

bridge.registerNavigation((uri) => { navigated.push(uri); });
bridge.registerReloader(() => { reloads += 1; });
assert.equal(bridge.canNavigate(), true);
bridge.navigateTo("https://example.com/ver/x/1");
bridge.reload();
assert.deepEqual([...navigated], ["https://example.com/ver/x/1"]);
assert.equal(reloads, 1);

// A report from the page is parsed, anything else is dropped
assert.deepEqual(
  bridge.handleMessage(JSON.stringify({ type: "SESSION_UPDATE", data: { cookies: "cf_clearance=1" } })),
  { type: "SESSION_UPDATE", data: { cookies: "cf_clearance=1" } },
);
assert.equal(bridge.handleMessage("not json"), null);

console.log("webview bridge ok");
