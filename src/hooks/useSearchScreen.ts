import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { errorFor } from "../utils/resource";

type SearchStatus = "idle" | "typing" | "searching" | "searched";

// The source site rejects queries shorter than 3 characters
export const MIN_SEARCH_LENGTH = 3;

export function useSearchScreen() {
  const fetchSearch = useSearchStore((s) => s.fetchSearch);
  const results = useSearchStore((s) => s.results);
  const lastSearchTerm = useSearchStore((s) => s.lastSearchTerm);
  const setStoreSearchTerm = useSearchStore((s) => s.setSearchTerm);
  const resetStoreSearch = useSearchStore((s) => s.resetSearch);
  const cancelSearch = useSearchStore((s) => s.cancelSearch);

  const [state, setState] = useState<{ term: string; status: SearchStatus }>({
    term: lastSearchTerm,
    status: lastSearchTerm ? "searched" : "idle",
  });
  // Bumped by every local transition; an async completion only lands if its
  // token still matches, so a superseded search cannot resurrect "searched"
  const searchTokenRef = useRef(0);

  const searchAnimes = useMemo(() => results.data ?? [], [results.data]);
  const isLoading = results.status === "loading";
  const error = errorFor(results, results.key ?? "");

  const executeSearch = useCallback(
    async (term: string, force = false) => {
      const trimmed = term.trim();
      if (trimmed.length < MIN_SEARCH_LENGTH) return;
      cancelSearch();
      const token = ++searchTokenRef.current;
      setState({ term, status: "searching" });
      setStoreSearchTerm(trimmed);
      await fetchSearch(trimmed, force);
      // Superseded (input cleared or replaced while in flight): don't resurrect
      // "searched", which would show empty results over the explore grid
      if (searchTokenRef.current !== token) return;
      setState({ term, status: "searched" });
    },
    [fetchSearch, setStoreSearchTerm, cancelSearch],
  );

  const handleSearch = useCallback(
    (term: string | null | undefined) => {
      if (term == null || term === "") return;
      void executeSearch(term);
    },
    [executeSearch],
  );

  const retrySearch = useCallback(() => {
    void executeSearch(state.term, true);
  }, [executeSearch, state.term]);

  const handleTextChange = useCallback((text: string) => {
    searchTokenRef.current += 1;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      // Clearing the input resets immediately; doing it here (not debounced)
      // avoids wiping results of an in-flight search
      resetStoreSearch();
      setState({ term: text, status: "idle" });
      return;
    }
    setState({ term: text, status: "typing" });
  }, [resetStoreSearch]);

  const resetSearch = useCallback(() => {
    searchTokenRef.current += 1;
    cancelSearch();
    setState({ term: "", status: "idle" });
    resetStoreSearch();
  }, [resetStoreSearch, cancelSearch]);

  return {
    searchTerm: state.term,
    searchAnimes,
    isLoading,
    error,
    isIdle: state.status === "idle",
    isTyping: state.status === "typing",
    isSearched: state.status === "searched",
    handleSearch,
    handleTextChange,
    resetSearch,
    retrySearch,
  };
}
