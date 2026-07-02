import { useQuery } from '@tanstack/react-query';
import { get }      from '../api/client';
import { EP }       from '../api/endpoints';
import type { TimberInventoryResponse } from '../types/api';

export function useTimberInventory() {
  return useQuery<TimberInventoryResponse>({
    queryKey:  ['timber-inventory'],
    queryFn:   () => get<TimberInventoryResponse>(EP.TIMBER_INVENTORY),
    staleTime: 120_000,
  });
}
