import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { EP } from '../api/endpoints';
import type { SearchResponse, SearchFilters, SearchModule } from '../types/api';

const PAGE_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;

// Overview mode — no module filter. Server returns a capped, grouped-by-module
// preview across every module the caller can access, in one round trip.
export function useGlobalSearchOverview(q: string, filters: Omit<SearchFilters, 'module'> = {}) {
  const trimmed = q.trim();
  return useQuery<SearchResponse>({
    queryKey:  ['global-search-overview', trimmed, filters],
    queryFn:   () => get<SearchResponse>(EP.SEARCH, { q: trimmed, ...filters }),
    enabled:   trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 15_000,
  });
}

// Deep mode — a single module, real pagination for infinite scroll. Also serves
// as "browse mode" (module set, empty query — e.g. a suggested-module chip
// tapped before typing): the server treats an empty/short query as "match
// everything" once a module is given, so this only needs `module` to fire, not
// a minimum query length.
// `module` is undefined while the screen is in overview mode — the query stays
// disabled so this hook never fires a redundant request alongside the overview one.
export function useGlobalSearch(q: string, module: SearchModule | undefined, filters: Omit<SearchFilters, 'module'> = {}) {
  const trimmed = q.trim();
  return useInfiniteQuery<SearchResponse>({
    queryKey: ['global-search', trimmed, module, filters],
    queryFn: ({ pageParam }) =>
      get<SearchResponse>(EP.SEARCH, { q: trimmed, module, ...filters, page: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.results.length < PAGE_LIMIT ? undefined : allPages.length,
    enabled:   !!module,
    staleTime: 15_000,
  });
}
