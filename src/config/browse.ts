// One route carries every filter: `/directorio` reads `genre`, `type`, `status`
// and `year` server-side and they combine. The taxonomy pages (`/genero/<slug>`,
// `/anio/<year>`) ignore any extra param, so they are not used for filtering.
export const BROWSE = {
  home: "/directorio",
};

export interface BrowseFilter {
  genre: string | null;
  type: string | null;
  status: string | null;
  year: number | null;
}

export const EMPTY_FILTER: BrowseFilter = { genre: null, type: null, status: null, year: null };

export interface BrowseOption {
  value: string;
  label: string;
}

/** `type` values as the site's own select uses them */
export const BROWSE_TYPES: BrowseOption[] = [
  { value: "TV", label: "Serie" },
  { value: "Movie", label: "Película" },
  { value: "Special", label: "Especial" },
  { value: "OVA", label: "Ova" },
  { value: "ONA", label: "Ona" },
];

/** `status` values: the numbers are the site's, the labels are its own too */
export const BROWSE_STATUSES: BrowseOption[] = [
  { value: "0", label: "Finalizado" },
  { value: "1", label: "En Emisión" },
  { value: "2", label: "Pausado" },
  { value: "3", label: "Próximamente" },
];

export const GENRES: BrowseOption[] = [
  { value: "accion", label: "Acción" },
  { value: "artes-marciales", label: "Artes Marciales" },
  { value: "aventura", label: "Aventura" },
  { value: "ciencia-ficcion", label: "Ciencia Ficción" },
  { value: "comedia", label: "Comedia" },
  { value: "deportes", label: "Deportes" },
  { value: "detectives", label: "Detectives" },
  { value: "drama", label: "Drama" },
  { value: "ecchi", label: "Ecchi" },
  { value: "escolar", label: "Escolar" },
  { value: "espacio", label: "Espacio" },
  { value: "fantasia", label: "Fantasía" },
  { value: "gore", label: "Gore" },
  { value: "harem", label: "Harem" },
  { value: "historico", label: "Histórico" },
  { value: "horror", label: "Horror" },
  { value: "isekai", label: "Isekai" },
  { value: "josei", label: "Josei" },
  { value: "juegos", label: "Juegos" },
  { value: "mahou-shoujo", label: "Mahou Shoujo" },
  { value: "mecha", label: "Mecha" },
  { value: "militar", label: "Militar" },
  { value: "misterio", label: "Misterio" },
  { value: "mitologico", label: "Mitológico" },
  { value: "musica", label: "Musica" },
  { value: "parodia", label: "Parodia" },
  { value: "psicologico", label: "Psicológico" },
  { value: "recuentos-de-la-vida", label: "Recuentos De La Vida" },
  { value: "romance", label: "Romance" },
  { value: "samurais", label: "Samurais" },
  { value: "seinen", label: "Seinen" },
  { value: "shoujo", label: "Shoujo" },
  { value: "shoujo-ai", label: "Shoujo Ai" },
  { value: "shounen", label: "Shounen" },
  { value: "shounen-ai", label: "Shounen Ai" },
  { value: "sobrenatural", label: "Sobrenatural" },
  { value: "soft-hentai", label: "Soft Hentai" },
  { value: "super-poderes", label: "Super Poderes" },
  { value: "suspenso", label: "Suspenso" },
  { value: "vampiros", label: "Vampiros" },
];

const FIRST_YEAR = 1970;

/** The site's own year select: the current year down to 1970 */
export const YEARS: number[] = Array.from(
  { length: new Date().getFullYear() - FIRST_YEAR + 1 },
  (_, index) => new Date().getFullYear() - index,
);

/** Empty strings, never omitted: the site's own URLs keep every key present */
export function browseQuery(filter: BrowseFilter, page: number): string {
  const params: [string, string][] = [
    ["year", filter.year != null ? String(filter.year) : ""],
    ["page", String(page)],
    ["genre", filter.genre ?? ""],
    ["type", filter.type ?? ""],
    ["status", filter.status ?? ""],
  ];
  return `${BROWSE.home}?${params.map(([key, value]) => `${key}=${value}`).join("&")}`;
}

/** What the filter button says: the picked values, or how many */
export function filterSummary(filter: BrowseFilter): string | null {
  const labels: string[] = [];
  const type = BROWSE_TYPES.find((option) => option.value === filter.type);
  const status = BROWSE_STATUSES.find((option) => option.value === filter.status);
  const genre = GENRES.find((option) => option.value === filter.genre);
  if (type != null) labels.push(type.label);
  if (genre != null) labels.push(genre.label);
  if (status != null) labels.push(status.label);
  if (filter.year != null) labels.push(String(filter.year));
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0]!;
  return `${labels.length} filtros`;
}
