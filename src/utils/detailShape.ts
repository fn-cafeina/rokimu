import type { AnimeDetail, AnimeRelations, Episode, RelatedAnime } from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEpisode(value: unknown): value is Episode {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.number === "string" && typeof value.url === "string";
}

function isRelatedAnime(value: unknown): value is RelatedAnime {
  if (!isRecord(value)) return false;
  return typeof value.slug === "string" && typeof value.name === "string" && typeof value.poster === "string";
}

function isRelations(value: unknown): value is AnimeRelations {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.prequel) && value.prequel.every(isRelatedAnime) &&
    Array.isArray(value.sequel) && value.sequel.every(isRelatedAnime) &&
    Array.isArray(value.related) && value.related.every(isRelatedAnime)
  );
}

/**
 * Shape check for a detail read back from storage: a payload written by an
 * older version, or one truncated by a killed write, must never reach a screen.
 */
export function isAnimeDetail(value: unknown): value is AnimeDetail {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === "string" &&
    typeof value.image === "string" &&
    typeof value.url === "string" &&
    typeof value.status === "string" &&
    typeof value.synopsis === "string" &&
    typeof value.banner === "string" &&
    isStringArray(value.genres) &&
    Array.isArray(value.episodes) && value.episodes.every(isEpisode) &&
    (value.relations == null || isRelations(value.relations))
  );
}
