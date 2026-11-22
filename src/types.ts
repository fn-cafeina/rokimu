export type AppErrorType = "NETWORK_ERROR" | "AUTH_ERROR" | "TIMEOUT" | "VIDEO_ERROR" | "PARSER_ERROR" | "UNKNOWN";

export interface AppError {
  type: AppErrorType;
  message: string;
}

export interface Anime {
  title: string;
  image: string;
  url: string; // slug
  status: string;
}

export interface Episode {
  id: string;
  number: string;
  url: string;
}

export interface RelatedAnime {
  id: number;
  name: string;
  poster: string;
  slug: string;
  type: string;
  vote_average: number;
}

export interface AnimeRelations {
  prequel: RelatedAnime[];
  sequel: RelatedAnime[];
  related: RelatedAnime[];
}

export interface AnimeDetail extends Anime {
  synopsis: string;
  banner: string;
  genres: string[];
  episodes: Episode[];
  relations: AnimeRelations | null;
}

export interface VideoServer {
  id: string;
  title: string;
  url: string;
  language: string;
}

export interface HistoryItem {
  title: string;
  image: string;
  url: string;
  number: string;
  progress?: number;
  duration?: number;
  timestamp: number;
}

export interface ISession {
  cookies: string;
  userAgent: string;
}

export interface StreamUrlResult {
  url: string;
  headers?: Record<string, string>;
}

export interface CacheEntry<T> {
  payload: T;
  expiration: number;
}

export interface EpisodeRange {
  label: string;
  start: number;
  end: number;
}

export interface EpisodeSheetRow {
  key: string;
  language: string;
  /** Right-aligned status: Descargado, 42%, En cola */
  hint: string;
  icon: "download" | "trash" | "stop";
  /** Row tap: play, from disk or from the network. */
  onSelect: () => void;
  /** Icon tap: download, delete or stop this language. */
  onAction: () => void;
}

