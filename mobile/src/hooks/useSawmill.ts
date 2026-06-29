import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { DailyListResponse } from '../types/api';

export function useSawmillList() {
  return useQuery<DailyListResponse>({
    queryKey:  ['sawmill-list'],
    queryFn:   () => get<DailyListResponse>(EP.SAWMILL_LIST),
    staleTime: 2 * 60_000,
  });
}

interface CreateSawmillPayload {
  date:               string;    // YYYY-MM-DD — API field is `date`, not `log_date`
  supervisor?:        string;
  operators?:         string;
  machine?:           string;
  product_size?:      string;
  timber_kiln_dried?: number;
  timber_cca_treated?: number;
  timber_untreated?:  number;
  timber_waste?:      number;
  poles_units?:       number;
  poles_waste?:       number;
  logs_received?:     number;
  downtime_hours?:    number;
  downtime_reason?:   string;
  remarks?:           string;
}

export function useSawmillCreate() {
  const qc = useQueryClient();

  async function createEntry(payload: CreateSawmillPayload): Promise<void> {
    await post(EP.SAWMILL_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['sawmill-list'] });
  }

  return { createEntry };
}
