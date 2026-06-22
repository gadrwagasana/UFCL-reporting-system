import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { LogTransportListResponse } from '../types/api';

export function useLogTransportList() {
  return useQuery<LogTransportListResponse>({
    queryKey:  ['log-transport-list'],
    queryFn:   () => get<LogTransportListResponse>(EP.LOG_TRANSPORT_LIST),
    staleTime: 2 * 60_000,
  });
}

interface CreateLogTransportPayload {
  transport_date:  string;
  qty_transported: number;
  unit?:           string;
  compt_id?:       number;
  sub_name?:       string;
  tractor_plate?:  string;
  loggers_number?: string;
  notes?:          string;
}

export function useLogTransportCreate() {
  const qc = useQueryClient();

  async function createEntry(payload: CreateLogTransportPayload): Promise<void> {
    await post(EP.LOG_TRANSPORT_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['log-transport-list'] });
    await qc.invalidateQueries({ queryKey: ['sawmill-list'] });  // sawmill daily validates log transport
  }

  return { createEntry };
}
