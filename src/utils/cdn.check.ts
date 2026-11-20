import { segmentConcurrency } from "./cdn";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, want ${e}`);
}

// The rate-limited CDN keeps the smaller pool
assertEqual(
  segmentConcurrency(["https://cdn1011.cdn-tnmr.org/hls2/03/seg-0.ts"]),
  4,
  "tnmr subdomain is throttled",
);
assertEqual(
  segmentConcurrency(["https://cdn1011.cdn-tnmr.org/hls2/03/seg-0.ts"]),
  4,
  "cdn-tnmr subdomain is throttled",
);
assertEqual(
  segmentConcurrency(["https://tnmr.org/hls2/03/seg-0.ts"]),
  4,
  "the bare domain is throttled too",
);

// Any other host gets the full burst
assertEqual(
  segmentConcurrency(["https://cdn.example.com/hls/seg-0.ts"]),
  8,
  "unknown host gets the full pool",
);

// One throttled host anywhere in the playlist caps the whole episode
assertEqual(
  segmentConcurrency([
    "https://cdn.example.com/hls/seg-0.ts",
    "https://xw4gfk3qemh1.tnmr.org/hls2/seg-1.ts",
  ]),
  4,
  "a single throttled segment host caps the pool",
);

// A host that merely ends with the letters of the domain is not the domain
assertEqual(
  segmentConcurrency(["https://nottnmr.org/seg-0.ts"]),
  8,
  "similar names are not the throttled host",
);

// Garbage URIs must not crash the download
assertEqual(segmentConcurrency(["not a url"]), 8, "unparseable URI falls back to the full pool");

console.log("cdn rules ok");
