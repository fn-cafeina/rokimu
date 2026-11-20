import { gcm } from "@noble/ciphers/aes.js";
import { utf8ToBytes } from "@noble/ciphers/utils.js";
import { decrypt, selectKeyParts, unpackPacked } from "./extractors";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, want ${e}`);
}

function didThrow(fn: () => unknown, message: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(message);
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// 30 key parts, 16 bytes each: any picked pair is a valid 256-bit GCM key
const partBytes = (i: number) => new Uint8Array(Array.from({ length: 16 }, (_, j) => i * 2 + j));
const parts = Array.from({ length: 30 }, (_, i) => b64url(partBytes(i)));

// selectKeyParts: version n picks parts n and 31-n (1-indexed)
assertEqual(
  selectKeyParts({ algorithm: "gcm", iv: "", payload: "", key_parts: parts, version: "5" }),
  [parts[4], parts[25]],
  "version 5 picks parts 5 and 26",
);
assertEqual(
  selectKeyParts({ algorithm: "gcm", iv: "", payload: "", key_parts: parts, version: "1" }),
  [parts[0], parts[29]],
  "version 1 picks parts 1 and 30",
);

// Out-of-range or garbage versions fall back to all parts
assertEqual(
  selectKeyParts({ algorithm: "gcm", iv: "", payload: "", key_parts: parts, version: "21" }),
  parts,
  "version 21 falls back to all parts",
);
assertEqual(
  selectKeyParts({ algorithm: "gcm", iv: "", payload: "", key_parts: parts, version: "abc" }),
  parts,
  "a garbage version falls back to all parts",
);

// GCM roundtrip: encrypt with the picked key, decrypt with decrypt()
const version = "12";
const keyBytes = new Uint8Array([...partBytes(11), ...partBytes(18)]);
const iv = new Uint8Array(12).fill(7);
const plainText = "https://cdn.example/videos/480p/index.m3u8";
const plain = utf8ToBytes(plainText);
const sealed = gcm(keyBytes, iv).encrypt(plain); // ct || tag
const data = {
  algorithm: "gcm",
  iv: b64url(iv),
  payload: b64url(sealed),
  key_parts: parts,
  version,
};
assertEqual(decrypt(data), plainText, "decrypts a Byse payload");

// A wrong version picks a wrong key and the GCM auth fails
didThrow(() => decrypt({ ...data, version: "13" }), "a wrong key fails GCM auth");

// unpackPacked reverses a Dean Edwards packer payload and yields the jwplayer
// sources line, the way the real LuluStream page hides its master playlist
function packSample(code: string, tokens: string[]): string {
  let packedCode = code;
  tokens.forEach((token, n) => {
    packedCode = packedCode.split(token).join(n.toString(36));
  });
  const escaped = packedCode.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `eval(function(p,a,c,k,e,d){while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+c.toString(a)+'\\\\b','g'),k[c]);return p}('${escaped}',36,${tokens.length},'${tokens.join("|")}'.split('|'),0,{}))`;
}

const packedPage = packSample(
  `jwplayer("vplayer").setup({sources:[{file:"https://cdn.example/hls/master.m3u8"}]});`,
  ["https://cdn.example/hls/master.m3u8", "jwplayer", "sources", "file"],
);
assertEqual(
  unpackPacked(`<script>${packedPage}</script>`).match(/sources:\s*\[\s*\{\s*file:\s*"([^"]+)"/)?.[1],
  "https://cdn.example/hls/master.m3u8",
  "unpacks a packed LuluStream player",
);
assertEqual(unpackPacked("<p>no packer here</p>"), "", "a page without a packer unpacks to empty");

console.log("extractors ok");
