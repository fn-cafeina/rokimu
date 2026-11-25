import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import type { AppError, Episode, EpisodeSheetRow, VideoServer } from "@/types";
import { usePlayerStore } from "@/stores/playerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useHistoryStore } from "@/stores/historyStore";
import { useAnimeDetail } from "./useAnimeDetail";
import { usePersistedRange } from "./usePersistedRange";
import { computeEpisodePagination } from "./episodePagination";
import { errorFor, isLoadingFor } from "@/utils/resource";
import { findHistoryEntry, makeHistoryEntry, addToHistorySafe } from "@/utils/history";
import { orderServers } from "@/utils/serverOrder";
import { navigateToPlayer } from "@/utils/navigation";
import {
  downloadKey,
  entriesForEpisode,
  useDownloadsStore,
  type DownloadEntry,
} from "@/stores/downloadsStore";
import { useNetworkStatus } from "./useNetworkStatus";

const NO_ENTRIES: Record<string, DownloadEntry> = {};

export function useAnimeDetailScreen(slug: string) {
  const { anime, view, isLoading: isAnimeLoading, isRefreshing, error, hasLoaded, refresh } = useAnimeDetail(slug);
  const resolveStream = usePlayerStore((s) => s.resolveStream);
  const serversResource = usePlayerStore((s) => s.servers);
  const fetchServers = usePlayerStore((s) => s.fetchServers);
  // Each series keeps its own order: flipping one never reorders the rest
  const episodeOrder = useSettingsStore((s) => s.episodeOrderBySlug[slug] ?? s.episodeOrder);
  const setEpisodeOrder = useSettingsStore((s) => s.setEpisodeOrder);
  const addToHistory = useHistoryStore((s) => s.addToHistory);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const { isInternetReachable } = useNetworkStatus();
  // The list only needs live progress while the sheet is open; outside it, a
  // segment tick would repaint the whole detail screen for nothing
  const entries = useDownloadsStore((s) => (selectedEpisode != null ? s.entries : NO_ENTRIES));
  const enqueue = useDownloadsStore((s) => s.enqueue);
  const cancel = useDownloadsStore((s) => s.cancel);
  const remove = useDownloadsStore((s) => s.remove);
  const [isExpanded, setIsExpanded] = useState(false);

  const [activeRangeIdx, setActiveRangeIdx, isRestoring] = usePersistedRange(slug);
  const { ranges, visibleEpisodes } = useMemo(
    () => computeEpisodePagination(anime?.episodes, episodeOrder, activeRangeIdx),
    [anime?.episodes, episodeOrder, activeRangeIdx],
  );
  // A remembered index outlives a list that shrank under it: highlight the
  // range the episodes on screen actually belong to
  const rangeIdx = ranges[activeRangeIdx] != null ? activeRangeIdx : 0;

  // Servers belong to one episode: key them the same way so the modal can
  // never show another episode's list or a stale error
  const serversKey = selectedEpisode != null ? `${slug}_${selectedEpisode.number}` : null;
  const servers = useMemo<VideoServer[]>(
    () => (serversKey != null && serversResource.dataKey === serversKey ? serversResource.data ?? [] : []),
    [serversKey, serversResource.dataKey, serversResource.data],
  );
  const serverLoading = serversKey != null && isLoadingFor(serversResource, serversKey);
  const serverError: AppError | null = serversKey != null ? errorFor(serversResource, serversKey) : null;

  const openPlayer = useCallback(
    (episode: Episode) => {
      if (!anime) return;
      const existing = findHistoryEntry(useHistoryStore.getState().lastViewed, slug, episode.number);
      addToHistorySafe(addToHistory, makeHistoryEntry({
        title: anime.title,
        image: anime.image,
        url: slug,
        number: episode.number,
        progress: existing?.progress,
        duration: existing?.duration,
      }));
      navigateToPlayer({
        slug,
        number: episode.number,
        title: anime.title,
        image: anime.image,
      });
    },
    [anime, slug, addToHistory],
  );

  const playSaved = useCallback(
    (episode: Episode, entry: DownloadEntry) => {
      if (entry.playlistUri == null) return;
      // The player reads the stream from the store on mount; a local episode
      // must settle it here, exactly like a server pick does
      usePlayerStore.getState().playLocal(episode.number, entry.playlistUri);
      openPlayer(episode);
    },
    [openPlayer],
  );

  // The sheet is the only place a saved episode is played or deleted, so it
  // opens the same way whether the copy exists already or not
  const openSheet = useCallback(
    (ep: Episode) => {
      setSelectedEpisode(ep);
      if (isInternetReachable !== false) void fetchServers(slug, ep.number);
    },
    [slug, fetchServers, isInternetReachable],
  );

  const handleEpisodePress = openSheet;
  const handleDownloadPress = openSheet;

  // One row per language: saved copies, work in flight, then the network
  const rows = useMemo<EpisodeSheetRow[]>(() => {
    const ep = selectedEpisode;
    if (ep == null) return [];

    const claimed = new Set<string>();
    const out: EpisodeSheetRow[] = [];
    const downloadInput = (language: string | null) => ({
      slug,
      number: ep.number,
      title: anime?.title ?? "",
      image: anime?.image ?? "",
      language,
    });

    for (const entry of entriesForEpisode(entries, slug, ep.number)) {
      const language = entry.language ?? "Descargado";
      if (entry.language != null) claimed.add(entry.language);

      if (entry.status === "done" && entry.playlistUri != null) {
        out.push({
          key: `saved-${language}`,
          language,
          hint: "Descargado",
          icon: "trash",
          onSelect: () => {
            playSaved(ep, entry);
            setSelectedEpisode(null);
          },
          onAction: () =>
            Alert.alert(
              `Eliminar ${language}`,
              `Se borrará la descarga del episodio ${ep.number}.`,
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Eliminar",
                  style: "destructive",
                  onPress: () => void remove(downloadKey(slug, ep.number, entry.language)),
                },
              ],
            ),
        });
        continue;
      }

      if (entry.status === "downloading" || entry.status === "queued") {
        const percent =
          entry.segmentsTotal > 0
            ? `${Math.round((entry.segmentsDone / entry.segmentsTotal) * 100)}%`
            : "0%";
        out.push({
          key: `pending-${language}`,
          language,
          hint: entry.status === "queued" ? "En cola" : percent,
          icon: "stop",
          onSelect: () => undefined,
          onAction: () => cancel(downloadKey(slug, ep.number, entry.language)),
        });
        continue;
      }

      if (entry.status === "error") {
        out.push({
          key: `error-${language}`,
          language,
          hint: "Error",
          icon: "download",
          onSelect: () => undefined,
          onAction: () => enqueue(downloadInput(entry.language)),
        });
      }
    }

    // The sheet lists one server per language, in play order: the user's
    // preferred server first, site order after. A second server of the same
    // language would just duplicate the row.
    const listed = new Set<string>();
    for (const server of orderServers(servers, useSettingsStore.getState().preferredServer)) {
      const language = server.language ?? "Desconocido";
      if (claimed.has(language) || listed.has(language)) continue;
      listed.add(language);
      out.push({
        key: `server-${server.id}`,
        language,
        hint: "Sin descargar",
        icon: "download",
        onSelect: () => {
          void resolveStream(server, { slug, number: ep.number });
          openPlayer(ep);
          setSelectedEpisode(null);
        },
        onAction: () => enqueue(downloadInput(server.language)),
      });
    }

    return out;
  }, [entries, servers, selectedEpisode, slug, anime, playSaved, resolveStream, openPlayer, enqueue, cancel, remove]);

  const retryServers = useCallback(() => {
    if (selectedEpisode != null) void fetchServers(slug, selectedEpisode.number, true);
  }, [slug, selectedEpisode, fetchServers]);

  const toggleEpisodeOrder = useCallback(() => {
    void setEpisodeOrder(slug, episodeOrder === "asc" ? "desc" : "asc");
  }, [setEpisodeOrder, slug, episodeOrder]);

  return {
    anime,
    view,
    isAnimeLoading,
    isRefreshing,
    error,
    hasLoaded,
    refresh,
    rows,
    serverLoading,
    serverError,
    serverOffline: isInternetReachable === false,
    retryServers,
    episodeOrder,
    toggleEpisodeOrder,
    isAscending: episodeOrder === "asc",
    activeRangeIdx: rangeIdx,
    setActiveRangeIdx,
    isRestoring,
    ranges,
    visibleEpisodes,
    handleEpisodePress,
    handleDownloadPress,
    selectedEpisode,
    setSelectedEpisode,
    isExpanded,
    setIsExpanded,
    selectEpisode: setSelectedEpisode,
    closeModal: () => setSelectedEpisode(null),
  };
}
