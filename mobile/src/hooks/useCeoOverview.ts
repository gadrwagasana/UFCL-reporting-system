import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { EP } from '../api/endpoints';
import { CeoOverview } from '../types/dashboard';

// Master Professionalization Phase C2 — this hook previously had zero
// importers anywhere in the app (CeoOverviewScreen did its own inline
// useQuery against the same endpoint/queryKey instead) and its local
// OverviewData type didn't even match the real backend contract (wrong
// field names like sawmill.volume_m3/total_trees that data.getCeoOverview
// has never returned). Rewritten against the real CeoOverview type
// (types/dashboard.ts) and now the single source of truth CeoOverviewScreen
// actually imports, instead of a duplicate, incorrect copy sitting unused.
export function useCeoOverview() {
  return useQuery<CeoOverview>({
    queryKey: ['ceo-overview'],
    queryFn:  () => get<CeoOverview>(EP.CEO_OVERVIEW),
    staleTime: 5 * 60_000,
  });
}
