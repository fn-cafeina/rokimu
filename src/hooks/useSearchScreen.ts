import { useCallback, useEffect, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { errorFor } from "../utils/resource";
import { useDebounce } from "./useDebounce";

// The source site rejects queries shorter than 3 characters
export const MIN_SEARCH_LENGTH = 3;

/**
 * Live search: the debounced input fires the request itself, there is no
 * autocomplete list. Results of the previous term stay on screen until the
 * new ones land, the way Discover behaves in inkuru.
 */
export function useSearchScreen() {
  const fetchSearch = useSearchStore((s) => s.fetchSearch);
  const results = useSearchStore((s) => s.results);
  const lastSearchTerm = useSearchStore((s) => s.lastSearchTerm);
  const setStoreSearchTerm = useSearchStore((s) => s.setSearchTerm);
  const resetStoreSearch = useSearchStore((s) => s.resetSearch);
  const cancelSearch = useSearchStore((s) => s.cancelSearch);

  const [term, setTerm] = useState(lastSearchTerm);
  const debouncedTerm = useDebounce(term, 300);

  const searchAnimes = results.data ?? [];
  const isLoading = results.status === "loading";
  const error = errorFor(results, results.key ?? "");
  const hasQuery = term.trim().length >= MIN_SEARCH_LENGTH;

  const executeSearch = useCallback(
    async (query: string, force = false) => {
      const trimmed = query.trim();
      if (trimmed.length < MIN_SEARCH_LENGTH) return;
      setStoreSearchTerm(trimmed);
      await fetchSearch(trimmed, force);
    },
    [fetchSearch, setStoreSearchTerm],
  );

  useEffect(() => {
    const trimmed = debouncedTerm.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) return;
    // The store key is the last requested term: retyping it is not a new search
    if (useSearchStore.getState().results.key === trimmed) return;
    void executeSearch(trimmed);
  }, [debouncedTerm, executeSearch]);

  const handleTextChange = useCallback((text: string) => {
    setTerm(text);
    // Clearing the input resets immediately instead of waiting for the debounce
    if (text.trim().length === 0) {
      cancelSearch();
      resetStoreSearch();
    }
  }, [cancelSearch, resetStoreSearch]);

  const resetSearch = useCallback(() => {
    cancelSearch();
    setTerm("");
    resetStoreSearch();
  }, [cancelSearch, resetStoreSearch]);

  const retrySearch = useCallback(() => {
    void executeSearch(term, true);
  }, [executeSearch, term]);

  return {
    searchTerm: term,
    searchAnimes,
    isLoading,
    error,
    hasQuery,
    handleTextChange,
    resetSearch,
    retrySearch,
  };
}
