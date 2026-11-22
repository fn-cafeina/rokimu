// The site exposes each dimension as its own path and ignores the other as a
// query param (`/genero/accion?anio=2014` returns the unfiltered genre page),
// so a filter is one path, never a combination.
export const BROWSE = {
  home: "/directorio",
  genre: (slug: string) => `/genero/${slug}`,
  year: (year: number) => `/anio/${year}`,
};

export interface Genre {
  label: string;
  slug: string;
}

export const GENRES: Genre[] = [
  { label: "Acción", slug: "accion" },
  { label: "Artes Marciales", slug: "artes-marciales" },
  { label: "Aventura", slug: "aventura" },
  { label: "Ciencia Ficción", slug: "ciencia-ficcion" },
  { label: "Comedia", slug: "comedia" },
  { label: "Deportes", slug: "deportes" },
  { label: "Detectives", slug: "detectives" },
  { label: "Drama", slug: "drama" },
  { label: "Ecchi", slug: "ecchi" },
  { label: "Escolar", slug: "escolar" },
  { label: "Espacio", slug: "espacio" },
  { label: "Fantasía", slug: "fantasia" },
  { label: "Gore", slug: "gore" },
  { label: "Harem", slug: "harem" },
  { label: "Histórico", slug: "historico" },
  { label: "Horror", slug: "horror" },
  { label: "Isekai", slug: "isekai" },
  { label: "Josei", slug: "josei" },
  { label: "Juegos", slug: "juegos" },
  { label: "Mahou Shoujo", slug: "mahou-shoujo" },
  { label: "Mecha", slug: "mecha" },
  { label: "Militar", slug: "militar" },
  { label: "Misterio", slug: "misterio" },
  { label: "Mitológico", slug: "mitologico" },
  { label: "Música", slug: "musica" },
  { label: "Parodia", slug: "parodia" },
  { label: "Psicológico", slug: "psicologico" },
  { label: "Recuentos de la Vida", slug: "recuentos-de-la-vida" },
  { label: "Romance", slug: "romance" },
  { label: "Samurais", slug: "samurais" },
  { label: "Seinen", slug: "seinen" },
  { label: "Shoujo", slug: "shoujo" },
  { label: "Shoujo Ai", slug: "shoujo-ai" },
  { label: "Shounen", slug: "shounen" },
  { label: "Shounen Ai", slug: "shounen-ai" },
  { label: "Sobrenatural", slug: "sobrenatural" },
  { label: "Soft Hentai", slug: "soft-hentai" },
  { label: "Super Poderes", slug: "super-poderes" },
  { label: "Suspenso", slug: "suspenso" },
  { label: "Vampiros", slug: "vampiros" },
];

// The site's own year list in the header: the current year and back
const YEAR_COUNT = 11;

export const YEARS: number[] = Array.from({ length: YEAR_COUNT }, (_, index) => new Date().getFullYear() - index);

export function genreLabel(slug: string): string {
  return GENRES.find((genre) => genre.slug === slug)?.label ?? slug;
}
