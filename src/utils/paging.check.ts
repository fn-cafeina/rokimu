import assert from "node:assert/strict";
import { appendPage } from "./paging";
import type { Anime } from "@/types";

const card = (url: string): Anime => ({ title: url, image: `${url}.jpg`, url, status: "" });

const page1 = [card("a"), card("b")];

const empty = appendPage(page1, []);
assert.equal(empty.items, page1, "an empty page keeps the same array");
assert.equal(empty.added, 0, "an empty page adds nothing");

const overlap = appendPage(page1, [card("b"), card("c")]);
assert.deepEqual(overlap.items.map((item) => item.url), ["a", "b", "c"], "only new slugs are appended, in order");
assert.equal(overlap.added, 1, "the overlap counts once");

const duplicate = appendPage(page1, [card("a"), card("b")]);
assert.equal(duplicate.items, page1, "a fully seen page keeps the same array");
assert.equal(duplicate.added, 0, "a fully seen page stops the list");

const first = appendPage([], page1);
assert.equal(first.items.length, 2, "the first page appends to nothing");
assert.equal(first.added, 2, "the first page counts every card");

const shifted = appendPage(page1, [card("b"), card("c"), card("b")]);
assert.deepEqual(shifted.items.map((item) => item.url), ["a", "b", "c"], "a repeated slug inside one page is appended once");

const repeatedFirstPage = appendPage([], [card("a"), card("a")]);
assert.equal(repeatedFirstPage.added, 1, "a slug repeated inside the first page is appended once");

console.log("paging ok");
