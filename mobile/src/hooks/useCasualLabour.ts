import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { CasualLabourListResponse } from '../types/api';

export function useCasualLabour() {
  return useQuery<CasualLabourListResponse>({
    queryKey:  ['casual-labour'],
    queryFn:   () => get<CasualLabourListResponse>(EP.LABOUR_LIST),
    staleTime: 2 * 60_000,
  });
}

interface CreateCasualLabourPayload {
  start_date:   string;
  end_date:     string;
  task:         string;
  num_casuals:  number;
  description?: string;
  comments?:    string;
}

export function useCasualLabourCreate() {
  const qc = useQueryClient();

  async function createRequest(payload: CreateCasualLabourPayload): Promise<void> {
    await post(EP.LABOUR_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['casual-labour'] });
    await qc.invalidateQueries({ queryKey: ['my-requests'] });
  }

  return { createRequest };
}
