import { HtmlParser, cleanTitle, extractJson, isChallengeHtml, parsePagination } from "./parsers";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${message}: got ${a}, want ${e}`);
}

const parser = new HtmlParser();

// --- parseCards ---
const homeHtml = [
  '<html><body>',
  '<a class="group block" href="/anime/one-piece"><img src="/p/one.jpg" alt="One Piece" /></a>',
  '<a class="group block" href="/anime/one-piece"><img src="/p/one-2.jpg" alt="One Piece duplicado" /></a>',
  '<a class="group block" href="/anime/naruto"><img data-src="/p/naruto.jpg" alt="Naruto" /></a>',
  '<a class="other" href="/anime/not-a-card"><img src="/p/x.jpg" alt="Ignorado" /></a>',
  '</body></html>',
].join("\n");

const cards = parser.parseCards(homeHtml);
assertEqual(cards.length, 2, "parseCards: duplicate slug and non-card link are skipped");
assertEqual(cards.map((c) => c.url), ["one-piece", "naruto"], "parseCards: urls");
assertEqual(cards[0]?.title, "One Piece", "parseCards: title");

// --- cleanTitle ---
assertEqual(cleanTitle("Ver One Piece Sub Español"), "One Piece", "cleanTitle strips Ver prefix and Sub suffix");
assertEqual(cleanTitle("Naruto"), "Naruto", "cleanTitle leaves plain titles alone");

// --- extractJson (depth-aware bracket matching) ---
assertEqual(
  extractJson('x "players": [{"id": "a", "tags": ["1", [2]]}] y', '"players":', "[", "]"),
  '[{"id": "a", "tags": ["1", [2]]}]',
  "extractJson balances nested brackets",
);
assertEqual(extractJson("no key here", '"players":', "[", "]"), "", "extractJson returns empty for a missing key");

// A bracket inside a string is text: counting it either ends the scan early or
// never ends it, and both turn a valid payload into an empty list
assertEqual(
  extractJson('x "episodes": [{"title": "[A"}, {"id": 2}] y', '"episodes":', "[", "]"),
  '[{"title": "[A"}, {"id": 2}]',
  "extractJson ignores an unbalanced bracket inside a string",
);
assertEqual(
  extractJson('x "episodes": [{"title": "A]"}, {"id": 2}] y', '"episodes":', "[", "]"),
  '[{"title": "A]"}, {"id": 2}]',
  "extractJson ignores an unbalanced closing bracket inside a string",
);
assertEqual(
  extractJson('x "episodes": [{"title": "a\\"b"}] y', '"episodes":', "[", "]"),
  '[{"title": "a\\"b"}]',
  "extractJson keeps an escaped quote inside the string",
);

// --- parseEpisodes: raw JSON in the page ---
const rawEpHtml =
  '<html><body>"episodes":[{"id":1,"number":"1"},{"id":2,"number":"2"},{"number":"3"}]</body></html>';
const rawEps = parser.parseEpisodes(rawEpHtml, "one-piece");
assertEqual(rawEps.length, 2, "parseEpisodes raw: entries without an id are dropped");
assertEqual(rawEps[0]?.url, "/ver/one-piece/1", "parseEpisodes raw: url");

// A title with a bracket must not cost the episode list
const bracketEpHtml = '<html><body>"episodes":[{"id":1,"number":"1","title":"[A"}]</body></html>';
assertEqual(parser.parseEpisodes(bracketEpHtml, "one-piece").length, 1, "parseEpisodes: a bracket in a title is not the end of the list");

// --- parseEpisodes: escaped JSON inside a self.__next_f.push script ---
const scriptEpHtml =
  '<html><body><script>self.__next_f.push([1,"{\\"episodes\\":[{\\"id\\":10,\\"number\\":\\"7\\"}]}")</script></body></html>';
const scriptEps = parser.parseEpisodes(scriptEpHtml, "one-piece");
assertEqual(scriptEps.length, 1, "parseEpisodes script: one episode");
assertEqual(scriptEps[0]?.number, "7", "parseEpisodes script: number");

// --- parseEpisodes: plain link fallback ---
const linkHtml = [
  '<html><body>',
  '<a href="/ver/one-piece/1">Ep 1</a>',
  '<a href="/ver/one-piece/2">Ep 2</a>',
  '<a href="/ver/one-piece/1">Ep 1 de nuevo</a>',
  '<a href="/ver/other-anime/3">Otro anime</a>',
  '</body></html>',
].join("\n");
const fallbackEps = parser.parseEpisodes(linkHtml, "one-piece");
assertEqual(fallbackEps.map((e) => e.number), ["1", "2"], "parseEpisodes fallback: deduped, wrong slug skipped");

// --- extractMetaTags ---
const meta = parser.extractMetaTags(
  '<html><head><meta property="og:title" content="One Piece">' +
    '<meta property="og:image" content="/b.jpg">' +
    '<meta name="description" content="Synopsis text"></head></html>',
);
assertEqual(meta.title, "One Piece", "meta title");
assertEqual(meta.banner, "/b.jpg", "meta banner");
assertEqual(meta.description, "Synopsis text", "meta description");

// --- isChallengeHtml ---
assert(
  isChallengeHtml('<html><head><title>Just a moment...</title></head><body></body></html>'),
  "challenge title is detected",
);
assert(
  isChallengeHtml('<html><body><div id="challenge-error-text"></div></body></html>'),
  "challenge id is detected",
);
assert(
  !isChallengeHtml('<html><head><title>One Piece</title></head><body>cards</body></html>'),
  "a normal page is not a challenge",
);

// --- parsePagination ---
// Markup copied from a real /directorio listing (filtered, page 1 of 2)
const pagination = (page: number, lastPage: number, withNext: boolean) => [
  '<nav aria-label="Paginaci\u00f3n" class="mt-20 flex items-center justify-center gap-8">',
  '<span class="h-12 w-12"></span>',
  '<div class="flex flex-col items-center gap-0.5">',
  '<span class="text-[10px] font-black tracking-widest text-muted-foreground uppercase">P\u00e1gina</span>',
  `<span class="text-sm font-black text-foreground">${page}<span class="mx-2 text-muted-foreground">/</span>${lastPage}</span>`,
  '</div>',
  withNext
    ? '<a rel="next" aria-label="P\u00e1gina siguiente" class="flex h-12 w-12" href="/directorio?year=&amp;page=2&amp;genre=&amp;type=&amp;status="></a>'
    : '<span class="h-12 w-12"></span>',
  '</nav>',
].join("");

assertEqual(parsePagination(pagination(1, 2, true)), { page: 1, lastPage: 2 }, "pagination: first of two");
assertEqual(parsePagination(pagination(2, 2, false)), { page: 2, lastPage: 2 }, "pagination: last page");
assertEqual(parsePagination(pagination(3, 7, true)), { page: 3, lastPage: 7 }, "pagination: middle page");
assertEqual(parsePagination("<html><body>no listing</body></html>"), { page: 1, lastPage: 1 }, "pagination: no footer means one page");
assertEqual(
  parsePagination('<a rel="next" href="/directorio?page=2"></a>'),
  { page: 1, lastPage: 2 },
  "pagination: a next link without the counter still means another page",
);

console.log("parsers ok");
