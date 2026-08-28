import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put } from '../api/client';
import { EP } from '../api/endpoints';
import { ProductListResponse, ProductActiveResponse } from '../types/api';

export function useProductList(filter = 'All') {
  return useQuery<ProductListResponse>({
    queryKey:  ['products-list', filter],
    queryFn:   () => get<ProductListResponse>(EP.PRODUCTS_LIST(filter)),
    staleTime: 2 * 60_000,
  });
}

export function useProductsActive(type: 'Timber' | 'Poles') {
  return useQuery<ProductActiveResponse>({
    queryKey:  ['products-active', type],
    queryFn:   () => get<ProductActiveResponse>(EP.PRODUCTS_ACTIVE(type)),
    staleTime: 5 * 60_000,
  });
}

export interface ProductPayload {
  type:         'Timber' | 'Poles' | 'Manufactured Product';
  sub_type?:    string;
  size:         string;
  reason:       string;
  ref?:         string;
  width_mm?:    number;
  height_mm?:   number;
  length_m?:    number;
  diameter_mm?: number;
  machine?:     string;
}

export function useProductCreate() {
  const qc = useQueryClient();

  async function createProduct(payload: ProductPayload): Promise<void> {
    await post(EP.PRODUCTS_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['products-list'] });
    await qc.invalidateQueries({ queryKey: ['products-active'] });
  }

  return { createProduct };
}

export function useProductUpdate() {
  const qc = useQueryClient();

  async function updateProduct(id: number, payload: Omit<ProductPayload, 'reason'>): Promise<void> {
    await put(EP.PRODUCTS_UPDATE(id), payload);
    await qc.invalidateQueries({ queryKey: ['products-list'] });
    await qc.invalidateQueries({ queryKey: ['products-active'] });
  }

  return { updateProduct };
}

export function useProductToggle() {
  const qc = useQueryClient();

  async function toggleProduct(id: number, reason: string): Promise<void> {
    await post(EP.PRODUCTS_TOGGLE(id), { reason });
    await qc.invalidateQueries({ queryKey: ['products-list'] });
    await qc.invalidateQueries({ queryKey: ['products-active'] });
  }

  return { toggleProduct };
}
