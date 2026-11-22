import assert from "node:assert/strict";
import {
  BROWSE_STATUSES,
  BROWSE_TYPES,
  EMPTY_FILTER,
  GENRES,
  YEARS,
  activeFilterCount,
  browseQuery,
  filterSummary,
  isFilterEmpty,
} from "./browse";

// Page 1 with no filter is the plain listing, and its key is the cached one
assert.equal(browseQuery(EMPTY_FILTER, 1), "/directorio?year=&page=1&genre=&type=&status=");
assert.ok(isFilterEmpty(EMPTY_FILTER), "no picked value means no filter");
assert.equal(activeFilterCount(EMPTY_FILTER), 0);

// All four at once: the site reads every key from the same request
assert.equal(
  browseQuery({ genre: "ciencia-ficcion", type: "Movie", status: "1", year: 2020 }, 3),
  "/directorio?year=2020&page=3&genre=ciencia-ficcion&type=Movie&status=1",
);

// A single filter leaves the other keys present but empty
assert.equal(
  browseQuery({ ...EMPTY_FILTER, year: 2014 }, 2),
  "/directorio?year=2014&page=2&genre=&type=&status=",
);

// Pagination is part of the query, so two pages are two different requests
assert.notEqual(browseQuery(EMPTY_FILTER, 1), browseQuery(EMPTY_FILTER, 2));

assert.equal(activeFilterCount({ genre: "accion", type: null, status: "2", year: null }), 2);
assert.equal(filterSummary(EMPTY_FILTER), null, "nothing picked, nothing to show");
assert.equal(filterSummary({ ...EMPTY_FILTER, genre: "accion" }), "Acción");
assert.equal(filterSummary({ ...EMPTY_FILTER, type: "Movie", year: 2020 }), "2 filtros");
assert.equal(filterSummary({ ...EMPTY_FILTER, status: "3" }), "Próximamente");
assert.equal(filterSummary({ ...EMPTY_FILTER, status: "3", year: 1999 }), "2 filtros");

// Lists come from the site's own selects
assert.equal(GENRES.length, 40);
assert.ok(GENRES.every((genre) => /^[a-z0-9-]+$/.test(genre.value)), "genre values are slugs");
assert.equal(BROWSE_TYPES.length, 5);
assert.deepEqual(BROWSE_STATUSES.map((status) => status.value), ["0", "1", "2", "3"]);
assert.equal(YEARS[0], new Date().getFullYear(), "the year list starts at the current year");
assert.equal(YEARS[YEARS.length - 1], 1970, "and ends where the site's list ends");
assert.equal(new Set(YEARS).size, YEARS.length, "no repeated year");

console.log("browse ok");
