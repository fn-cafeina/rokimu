import assert from "node:assert/strict";
import { isAnimeDetail } from "./detailShape";

const episode = { id: "e1", number: "1", url: "/ver/1" };
const related = { id: 1, name: "Bleach", poster: "b.jpg", slug: "bleach", type: "", vote_average: 0 };

const valid = {
  title: "Naruto",
  image: "n.jpg",
  url: "naruto",
  status: "Finalizado",
  synopsis: "Un ninja",
  banner: "nb.jpg",
  genres: ["Acción"],
  episodes: [episode],
  relations: { prequel: [], sequel: [related], related: [] },
};

assert.equal(isAnimeDetail(valid), true, "a full detail passes");
assert.equal(isAnimeDetail({ ...valid, relations: null }), true, "no relations is valid");
assert.equal(isAnimeDetail({ ...valid, episodes: [] }), true, "an empty episode list is valid");
assert.equal(isAnimeDetail(null), false, "null is not a detail");
assert.equal(isAnimeDetail("naruto"), false, "a string is not a detail");
assert.equal(isAnimeDetail({}), false, "an empty object is not a detail");
assert.equal(isAnimeDetail({ ...valid, episodes: undefined }), false, "no episode list is not a detail");
assert.equal(isAnimeDetail({ ...valid, episodes: [{ id: "e1" }] }), false, "an episode without a number is dropped");
assert.equal(isAnimeDetail({ ...valid, genres: [1] }), false, "a non-string genre is dropped");
assert.equal(
  isAnimeDetail({ ...valid, relations: { prequel: [{ slug: "x" }], sequel: [], related: [] } }),
  false,
  "a truncated relations list is dropped",
);

console.log("detail shape ok");
