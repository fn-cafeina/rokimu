import { findServer, orderServers, segmentConcurrencyFor } from "./serverOrder";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, want ${e}`);
}

const servers = [
  { id: "1", title: "Delta", url: "a", language: "Subtitulado" },
  { id: "2", title: "Epsilon", url: "b", language: "Subtitulado" },
  { id: "3", title: "Delta", url: "c", language: "Latino" },
];

// No preference keeps the site order
assertEqual(orderServers(servers, null), servers, "no preference keeps site order");

// The preferred server jumps the queue, every copy of it first
assertEqual(
  orderServers(servers, "Epsilon").map((s) => s.id),
  ["2", "1", "3"],
  "Epsilon first",
);
assertEqual(
  orderServers(servers, "Delta").map((s) => s.id),
  ["1", "3", "2"],
  "both Delta copies first, site order inside",
);

// A preference the episode does not offer changes nothing
assertEqual(orderServers(servers, "Gamma"), servers, "unknown preference keeps site order");

// Site-side noise in the name must not disable the preference
assertEqual(orderServers(servers, "  epsilon ").map((s) => s.id), ["2", "1", "3"], "case and spaces ignored");
assertEqual(
  orderServers([{ id: "4", title: "Epsilon 2", url: "d", language: "Latino" }, servers[0]!], "Epsilon").map((s) => s.id),
  ["4", "1"],
  "a suffix after the name keeps the preference"
);
assertEqual(
  orderServers([{ id: "5", title: "Deltanime", url: "e", language: "Latino" }, servers[0]!], "Delta").map((s) => s.id),
  ["1", "5"],
  "a different name sharing the prefix is not the preference"
);

// A refreshed list resolves the same server, never a substitute
assertEqual(findServer(servers, { id: "9", title: "Delta", url: "z", language: "Latino" }), servers[2], "id miss falls to name and language");
assertEqual(findServer(servers, { id: "2", title: "Epsilon", url: "moved", language: "Subtitulado" }), servers[1], "id hit wins");
assertEqual(findServer(servers, { id: "9", title: "Gamma", url: "z", language: "Latino" }), null, "a server that disappeared resolves to nothing");

// Epsilon's CDN 429s above four requests; the rest take the client's five
assertEqual(segmentConcurrencyFor("Epsilon"), 4, "Epsilon keeps a smaller pool");
assertEqual(segmentConcurrencyFor("Epsilon 2"), 4, "the suffix does not lift the limit");
assertEqual(segmentConcurrencyFor("Jade"), 5, "another name gets the full pool");
assertEqual(segmentConcurrencyFor("Delta"), 5, "Delta takes everything the client runs");
assertEqual(segmentConcurrencyFor(""), 5, "an unnamed server falls back to the full pool");

console.log("server order ok");
