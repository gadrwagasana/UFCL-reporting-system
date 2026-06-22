import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { VatInboundListResponse, VatListResponse, VatTypeValueAdded } from '../types/api';

export function useVatInbound() {
  return useQuery<VatInboundListResponse>({
    queryKey:  ['vat-inbound'],
    queryFn:   () => get<VatInboundListResponse>(EP.VAT_INBOUND),
    staleTime: 2 * 60_000,
  });
}

export function useVatList() {
  return useQuery<VatListResponse>({
    queryKey:  ['vat-list'],
    queryFn:   () => get<VatListResponse>(EP.VAT_LIST),
    staleTime: 2 * 60_000,
  });
}

interface CreateVatPayload {
  entry_date:         string;
  type_value_added:   VatTypeValueAdded;
  product_size:       string;
  num_timber:         number;
  source_transfer_id?: number;
}

export function useVatCreate() {
  const qc = useQueryClient();

  async function createEntry(payload: CreateVatPayload): Promise<void> {
    await post(EP.VAT_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['vat-list'] });
    await qc.invalidateQueries({ queryKey: ['vat-inbound'] });
  }

  return { createEntry };
}

export const VAT_TYPES: VatTypeValueAdded[] = ['Kiln-dried timber', 'CCA treated timber'];
