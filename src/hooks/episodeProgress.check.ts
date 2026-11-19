import assert from "node:assert/strict";
import type { Episode, HistoryItem } from "../types";
import { collectEpisodeProgress, isWatched, pickCtaEpisode } from "./episodeProgress";

const SLUG = "naruto";

function episode(number: string): Episode {
  return { id: `ep-${number}`, number, url: `/ver/${number}` };
}

const ordered = ["1", "2", "3", "4"].map(episode);

function entry(number: string, ratio: number, timestamp: number): HistoryItem {
  return {
    title: "Naruto",
    image: "",
    url: SLUG,
    number,
    progress: ratio * 100,
    duration: 100,
    timestamp,
  };
}

// Nothing played leaves the screen with no progress at all
assert.deepEqual(collectEpisodeProgress(ordered, [], SLUG), []);

// An entry for another anime never counts
assert.deepEqual(
  collectEpisodeProgress(ordered, [{ ...entry("1", 0.5, 1), url: "bleach" }], SLUG),
  [],
);

const midEpisode = collectEpisodeProgress(ordered, [entry("2", 0.4, 10)], SLUG);
assert.equal(midEpisode.length, 1);
assert.equal(midEpisode[0]!.index, 1);
assert.equal(isWatched(midEpisode[0]!), false);

// Half way keeps the CTA on the episode being watched
assert.equal(pickCtaEpisode(ordered, midEpisode)?.episode.number, "2");

const finished = collectEpisodeProgress(ordered, [entry("2", 1, 10)], SLUG);
assert.equal(isWatched(finished[0]!), true);

// A finished episode hands the CTA to the next one, not to itself
assert.equal(pickCtaEpisode(ordered, finished)?.episode.number, "3");
assert.equal(pickCtaEpisode(ordered, finished)?.continuing, true);

// Read in a row skips the watched ones
assert.equal(
  pickCtaEpisode(ordered, collectEpisodeProgress(ordered, [entry("1", 1, 10), entry("2", 1, 20), entry("3", 0.2, 30)], SLUG))
    ?.episode.number,
  "3",
  "the episode in progress wins over the finished ones",
);

// The most recent play decides, not the highest episode
assert.equal(
  pickCtaEpisode(ordered, collectEpisodeProgress(ordered, [entry("4", 1, 10), entry("2", 0.3, 20)], SLUG))
    ?.episode.number,
  "2",
);

// Everything watched and nothing left after it: no CTA at all
assert.equal(
  pickCtaEpisode(ordered, collectEpisodeProgress(ordered, [entry("4", 1, 10)], SLUG)),
  null,
);

// Finished in the middle with the tail watched leaves nothing to continue
assert.equal(
  pickCtaEpisode(
    ordered,
    collectEpisodeProgress(ordered, [entry("3", 1, 10), entry("4", 1, 20)], SLUG),
  ),
  null,
);

// A saved episode that the list no longer carries never becomes the CTA
assert.equal(pickCtaEpisode([episode("1"), episode("2")], finished), null);

console.log("episode progress ok");
