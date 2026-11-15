import { mergeCookies } from "./cookies";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, want ${e}`);
}

// A fresh jar from scratch
assertEqual(mergeCookies("", ["cf_clearance=abc123; Path=/; HttpOnly"]), "cf_clearance=abc123", "sets a new cookie");

// Existing values are updated in place
assertEqual(mergeCookies("a=1; b=2", ["b=3; Path=/"]), "a=1; b=3", "updates an existing value");

// New cookies are appended after the old ones
assertEqual(mergeCookies("a=1", ["b=2", "c=3"]), "a=1; b=2; c=3", "appends new cookies");

// Deletion-shaped cookies (empty value, past expiry, max-age=0) must not
// wipe a live jar when servers expire their own cookies
assertEqual(
  mergeCookies("cf_clearance=good", ["cf_clearance=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]),
  "cf_clearance=good",
  "an empty value keeps the old cookie",
);
assertEqual(
  mergeCookies("cf_clearance=good", ["cf_clearance=dead; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]),
  "cf_clearance=good",
  "a past expiry keeps the old cookie",
);
assertEqual(
  mergeCookies("cf_clearance=good", ["cf_clearance=dead; Path=/; Max-Age=0"]),
  "cf_clearance=good",
  "max-age=0 keeps the old cookie",
);

// A genuine update still lands
assertEqual(
  mergeCookies("cf_clearance=old", ["cf_clearance=new; Path=/; HttpOnly; Expires=Fri, 01 Jan 2030 00:00:00 GMT"]),
  "cf_clearance=new",
  "a normal update replaces the value",
);

// A header without attributes
assertEqual(mergeCookies("a=1", ["b=2"]), "a=1; b=2", "bare set-cookie");

console.log("cookies ok");
