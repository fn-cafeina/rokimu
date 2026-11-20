import { orderServers } from "./serverOrder";

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

console.log("server order ok");
