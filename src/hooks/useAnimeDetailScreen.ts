import { useCallback, useMemo, useState } from "react";
import type { AppError, Episode, VideoServer } from "../types";
import { usePlayerStore } from "../stores/playerStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useHistoryStore } from "../stores/historyStore";
import { useAnimeData } from "./useAnimeData";
import { usePersistedRange } from "./useAnimeDetail";
import { computeEpisodePagination } from "./episodeHelpers";
import { errorFor, isLoadingFor } from "../utils/resource";
import { findHistoryEntry, makeHistoryEntry, addToHistorySafe } from "../utils/history";
import { navigateToPlayer } from "../utils/navigation";
import { downloadKey, useDownloadsStore } from "../stores/downloadsStore";

export function useAnimeDetailScreen(slug: string) {
  const { anime, view, isLoading: isAnimeLoading, error, hasLoaded, refresh } = useAnimeData(slug);
  const resolveStream = usePlayerStore((s) => s.resolveStream);
  const serversResource = usePlayerStore((s) => s.servers);
  const fetchServers = usePlayerStore((s) => s.fetchServers);
  const episodeOrder = useSettingsStore((s) => s.episodeOrder);
  const setEpisodeOrder = useSettingsStore((s) => s.setEpisodeOrder);
  const addToHistory = useHistoryStore((s) => s.addToHistory);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  // The same sheet serves playback and download: only the confirm action differs
  const [selectionMode, setSelectionMode] = useState<"play" | "download">("play");
  const [isExpanded, setIsExpanded] = useState(false);

  const [activeRangeIdx, setActiveRangeIdx, isRestoring] = usePersistedRange(slug);
  const { ranges, visibleEpisodes } = useMemo(
    () => computeEpisodePagination(anime?.episodes, episodeOrder, activeRangeIdx),
    [anime?.episodes, episodeOrder, activeRangeIdx],
  );

  // Servers belong to one episode: key them the same way so the modal can
  // never show another episode's list or a stale error
  const serversKey = selectedEpisode != null ? `${slug}_${selectedEpisode.number}` : null;
  const servers: VideoServer[] =
    serversKey != null && serversResource.dataKey === serversKey ? serversResource.data ?? [] : [];
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

  const handleEpisodePress = useCallback(
    (ep: Episode) => {
      // A saved episode plays from disk, so the server sheet would only fail
      // offline and add a step when online
      const saved = useDownloadsStore.getState().entries[downloadKey(slug, ep.number)];
      if (saved?.status === "done") {
        openPlayer(ep);
        return;
      }
      setSelectionMode("play");
      setSelectedEpisode(ep);
      void fetchServers(slug, ep.number);
    },
    [slug, fetchServers, openPlayer],
  );

  const handleDownloadPress = useCallback(
    (ep: Episode) => {
      setSelectionMode("download");
      setSelectedEpisode(ep);
      void fetchServers(slug, ep.number);
    },
    [slug, fetchServers],
  );

  const retryServers = useCallback(() => {
    if (selectedEpisode != null) void fetchServers(slug, selectedEpisode.number, true);
  }, [slug, selectedEpisode, fetchServers]);

  const handleServerSelect = useCallback(
    (server: VideoServer) => {
      if (!selectedEpisode) return;
      if (selectionMode === "download") {
        // Language is the server: it decides which audio track gets saved
        useDownloadsStore.getState().enqueue({
          slug,
          number: selectedEpisode.number,
          title: anime?.title ?? "",
          image: anime?.image ?? "",
          language: server.language,
        });
        setSelectedEpisode(null);
        return;
      }
      void resolveStream(server, { slug, number: selectedEpisode.number });
      openPlayer(selectedEpisode);
      setSelectedEpisode(null);
    },
    [selectedEpisode, selectionMode, anime, slug, resolveStream, setSelectedEpisode, openPlayer],
  );

  return {
    anime,
    view,
    isAnimeLoading,
    error,
    hasLoaded,
    refresh,
    servers,
    serverLoading,
    serverError,
    retryServers,
    resolveStream,
    episodeOrder,
    setEpisodeOrder,
    isAscending: episodeOrder === "asc",
    activeRangeIdx,
    setActiveRangeIdx,
    isRestoring,
    ranges,
    visibleEpisodes,
    handleEpisodePress,
    handleDownloadPress,
    handleServerSelect,
    selectionMode,
    selectedEpisode,
    setSelectedEpisode,
    isExpanded,
    setIsExpanded,
    selectEpisode: setSelectedEpisode,
    closeModal: () => setSelectedEpisode(null),
  };
}
