import assert from "node:assert/strict";
import { buildHeaders, isSourceUrl } from "./requestHeaders";

const BASE = "https://www.example.com";
const SESSION = { cookies: "cf_clearance=abc; other=1", userAgent: "Rokimu-Test" };

const source = buildHeaders({ url: `${BASE}/anime/x`, baseUrl: BASE, session: SESSION });
const bridge = buildHeaders({ url: "https://bridge.host/page", baseUrl: BASE, session: SESSION });
const video = buildHeaders({ url: "https://cdn.video.host/master.m3u8", baseUrl: BASE, session: SESSION });

// The origin check is a prefix test on the configured base URL
assert.equal(isSourceUrl(`${BASE}/directorio`, BASE), true);
assert.equal(isSourceUrl(BASE, BASE), true);
assert.equal(isSourceUrl("https://bridge.host/page", BASE), false);
assert.equal(isSourceUrl("https://www.example.com.evil.host/x", BASE), false);

// The source request carries the jar and the navigation hints
assert.equal(source.Cookie, SESSION.cookies);
assert.equal(source.Referer, `${BASE}/`);
assert.equal(source["Sec-Fetch-Site"], "same-origin");
assert.equal(source["User-Agent"], SESSION.userAgent);

// A foreign host gets none of it, not even an empty cookie header
for (const foreign of [bridge, video]) {
  assert.equal("Cookie" in foreign, false);
  assert.equal("Referer" in foreign, false);
  assert.equal("Sec-Fetch-Site" in foreign, false);
  assert.equal("Upgrade-Insecure-Requests" in foreign, false);
  // The user agent is not a secret and the video hosts need it
  assert.equal(foreign["User-Agent"], SESSION.userAgent);
  assert.equal(foreign.Accept != null, true);
}

// Without a session there is still no cookie key on a foreign host
assert.equal("Cookie" in buildHeaders({ url: "https://cdn.video.host/x", baseUrl: BASE, session: null }), false);
assert.equal(buildHeaders({ url: `${BASE}/x`, baseUrl: BASE, session: null }).Cookie, "");

// Caller headers survive, but cannot sneak a cookie to a foreign host by name
const withExtra = buildHeaders({
  url: "https://bridge.host/page",
  baseUrl: BASE,
  session: SESSION,
  extra: { "X-Test": "1" },
});
assert.equal(withExtra["X-Test"], "1");

console.log("request headers ok");