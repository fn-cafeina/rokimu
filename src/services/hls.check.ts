import assert from "node:assert/strict";
import { cbc } from "@noble/ciphers/aes.js";
import {
  buildLocalPlaylist,
  decryptSegment,
  parseMediaPlaylist,
  sequenceIv,
} from "./hls";

const BASE = "https://cdn.example.com/hls/ep1/index.m3u8";

const plain = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:7
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:9.5,title one
seg-0.ts
#EXTINF:10.0,
seg-1.ts
#EXT-X-ENDLIST
`;

{
  const playlist = parseMediaPlaylist(plain, BASE);
  assert.equal(playlist.targetDuration, 10);
  assert.equal(playlist.mediaSequence, 7);
  assert.equal(playlist.segments.length, 2);
  assert.equal(playlist.segments[0]!.uri, "https://cdn.example.com/hls/ep1/seg-0.ts");
  assert.equal(playlist.segments[0]!.duration, 9.5);
  assert.equal(playlist.segments[0]!.sequence, 7);
  assert.equal(playlist.segments[1]!.sequence, 8);
  assert.equal(playlist.segments[0]!.key, null);
  assert.equal(playlist.initSegment, null);
  assert.equal(playlist.segments[0]!.range, null);
}

// Absolute segment URLs survive resolution untouched
{
  const playlist = parseMediaPlaylist(
    "#EXTM3U\n#EXTINF:4,\nhttps://other.example.net/a.ts\n",
    BASE,
  );
  assert.equal(playlist.segments[0]!.uri, "https://other.example.net/a.ts");
}

// AES-128 with an explicit IV, key URI relative to the playlist
{
  const body = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-KEY:METHOD=AES-128,URI="../keys/k1.bin",IV=0x000102030405060708090a0b0c0d0e0f
#EXTINF:6,
seg-a.ts
#EXT-X-KEY:METHOD=NONE
#EXTINF:6,
seg-b.ts
`;
  const playlist = parseMediaPlaylist(body, BASE);
  const key = playlist.segments[0]!.key;
  assert.ok(key);
  assert.equal(key.uri, "https://cdn.example.com/hls/keys/k1.bin");
  assert.deepEqual([...key.iv!], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.equal(playlist.segments[1]!.key, null);
}

// Key without IV: derived from the media sequence
{
  const body = "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:258\n#EXT-X-KEY:METHOD=AES-128,URI=\"k.bin\"\n#EXTINF:6,\nseg.ts\n";
  const playlist = parseMediaPlaylist(body, BASE);
  assert.equal(playlist.segments[0]!.key!.iv, null);
  const iv = sequenceIv(playlist.segments[0]!.sequence);
  assert.deepEqual([...iv], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2]);
}

// Byte ranges: explicit offset, then implicit continuation
{
  const body = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXTINF:6,
#EXT-X-BYTERANGE:1000@0
seg.ts
#EXTINF:6,
#EXT-X-BYTERANGE:500
seg.ts
`;
  const playlist = parseMediaPlaylist(body, BASE);
  assert.deepEqual(playlist.segments[0]!.range, { length: 1000, offset: 0 });
  assert.deepEqual(playlist.segments[1]!.range, { length: 500, offset: 1000 });
}

// fMP4 init segment, with its own byterange
{
  const body = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-MAP:URI="init.mp4",BYTERANGE="700@0"
#EXTINF:6,
#EXT-X-BYTERANGE:900
seg.m4s
`;
  const playlist = parseMediaPlaylist(body, BASE);
  assert.equal(playlist.initSegment!.uri, "https://cdn.example.com/hls/ep1/init.mp4");
  assert.deepEqual(playlist.initSegment!.range, { length: 700, offset: 0 });
  // The first segment without an offset continues after the init byterange
  assert.deepEqual(playlist.segments[0]!.range, { length: 900, offset: 0 });
  assert.equal(playlist.segments[0]!.map!.uri, "https://cdn.example.com/hls/ep1/init.mp4");
}

// SAMPLE-AES and friends cannot be downloaded, and must say so
{
  assert.throws(
    () => parseMediaPlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="k"\n#EXTINF:6,\nseg.ts\n', BASE),
    /no soportado/,
  );
}

// Decryption round trip with PKCS#7 padding
{
  const key = new Uint8Array(16).fill(7);
  const iv = sequenceIv(3);
  const plaintext = new TextEncoder().encode("segment payload bytes");
  const encrypted = cbc(key, iv).encrypt(plaintext);
  assert.deepEqual([...decryptSegment(encrypted, key, iv)], [...plaintext]);
}

// Local playlist drops keys, keeps durations and points at local files
{
  const text = buildLocalPlaylist({
    targetDuration: 9.4,
    segments: [
      { duration: 9.5, file: "seg_00000.ts" },
      { duration: 10, file: "seg_00001.ts" },
    ],
    initFile: "init.mp4",
  });
  assert.match(text, /^#EXTM3U/);
  assert.match(text, /#EXT-X-TARGETDURATION:10/);
  assert.match(text, /#EXT-X-MAP:URI="init.mp4"/);
  assert.match(text, /#EXTINF:9.5,\nseg_00000\.ts/);
  assert.match(text, /#EXT-X-ENDLIST/);
  assert.doesNotMatch(text, /#EXT-X-KEY|https?:\/\//);
}

console.log("hls.check.ts OK");
