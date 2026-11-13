// Material 3 dark color roles. Must match the tokens in global.css.
// Native props (tintColor, Switch trackColor, Slider, RefreshControl) cannot
// read Tailwind classes, so they read these constants instead.
export const ACCENT_COLOR = "#5BC8F5";
export const ON_ACCENT_COLOR = "#00344A";
export const MUTED_ICON = "#938F99";
export const ON_SURFACE = "#E6E0E9";

export const SURFACE_COLOR = "#141218";
export const SURFACE_CONTAINER_LOW = "#1D1B20";
export const SURFACE_CONTAINER = "#211F26";
export const SURFACE_CONTAINER_HIGH = "#2B292F";
export const SURFACE_CONTAINER_HIGHEST = "#36343B";
export const ON_SURFACE_COLOR = "#E6E0E9";
export const ON_SURFACE_VARIANT = "#CAC4D0";
export const OUTLINE_COLOR = "#938F99";
export const OUTLINE_VARIANT = "#49454F";
export const ERROR_COLOR = "#F2B8B5";

export const SOURCE_CONFIG = {
  baseUrl: "https://www.animelatinohd.com",
  get sessionWashUrl() { return SOURCE_CONFIG.baseUrl + "/"; },
  homeEndpoint: "/directorio",
};

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w300";
export const TMDB_POSTER_W92 = "https://media.themoviedb.org/t/p/w92";

export const LANGUAGE_MAP: Record<string, string> = {
  SUB: "Subtitulado",
  LAT: "Latino",
  ESP: "Castellano",
};
