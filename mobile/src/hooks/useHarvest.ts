import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { HarvestListResponse, CompartmentListResponse } from '../types/api';

export function useHarvestList() {
  return useQuery<HarvestListResponse>({
    queryKey:  ['harvest-list'],
    queryFn:   () => get<HarvestListResponse>(EP.HARVEST_LIST),
    staleTime: 2 * 60_000,
  });
}

export function useCompartments() {
  return useQuery<CompartmentListResponse>({
    queryKey:  ['meta-compartments'],
    queryFn:   () => get<CompartmentListResponse>(EP.META_COMPARTMENTS),
    staleTime: 10 * 60_000,
  });
}

interface CreateHarvestPayload {
  harvest_date:    string;
  species:         string;
  quantity:        number;
  uom?:            string;
  compt_id?:       number;
  sub_name?:       string;
  location?:       string;
  logs_crosscut?:  number;
  logs_handrolled?: number;
  notes?:          string;
}

export function useHarvestCreate() {
  const qc = useQueryClient();

  async function createEntry(payload: CreateHarvestPayload): Promise<void> {
    await post(EP.HARVEST_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['harvest-list'] });
  }

  return { createEntry };
}
