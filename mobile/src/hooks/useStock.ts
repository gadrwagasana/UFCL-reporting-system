import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import type {
  StockItemListResponse, InventoryListResponse,
  StockMovementListResponse, StockItem,
} from '../types/api';

const CATALOG_KEY   = ['stock-items']   as const;
const INVENTORY_KEY = ['stock-inventory'] as const;
const MOVEMENTS_KEY = ['stock-movements'] as const;
const CATS_KEY      = ['stock-categories'] as const;

// ── Stock Catalog ─────────────────────────────────────────────────────────────

export function useStockItems() {
  return useQuery<StockItemListResponse>({
    queryKey:  CATALOG_KEY,
    queryFn:   () => get<StockItemListResponse>(EP.STOCK_ITEMS),
    staleTime: 60_000,
  });
}

export function useStockItemCreate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<{ ok: true }>(EP.STOCK_ITEMS_CREATE, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
      qc.invalidateQueries({ queryKey: INVENTORY_KEY });
    },
  });
  return { createStockItem: mutation.mutateAsync, ...mutation };
}

export function useStockItemUpdate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      put<{ ok: true }>(EP.STOCK_ITEMS_UPDATE(id), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
      qc.invalidateQueries({ queryKey: INVENTORY_KEY });
    },
  });
  return { updateStockItem: mutation.mutateAsync, ...mutation };
}

export function useStockItemDelete() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      del<{ ok: true }>(EP.STOCK_ITEMS_DELETE(id), { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
      qc.invalidateQueries({ queryKey: INVENTORY_KEY });
      qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
    },
  });
  return { deleteStockItem: mutation.mutateAsync, ...mutation };
}

// ── Stock Categories ──────────────────────────────────────────────────────────

export function useStockCategories() {
  return useQuery<{ ok: true; rows: { id: number; name: string }[] }>({
    queryKey:  CATS_KEY,
    queryFn:   () => get(EP.STOCK_CATEGORIES),
    staleTime: 120_000,
  });
}

export function useStockCategoryCreate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (name: string) =>
      post<{ ok: true }>(EP.STOCK_CATEGORIES_CREATE, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATS_KEY });
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
    },
  });
  return { createCategory: mutation.mutateAsync, ...mutation };
}

export function useStockCategoryDelete() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: number) => del<{ ok: true }>(EP.STOCK_CATEGORIES_DELETE(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATS_KEY });
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
    },
  });
  return { deleteCategory: mutation.mutateAsync, ...mutation };
}

// ── Stock Inventory ───────────────────────────────────────────────────────────

export function useStockInventory() {
  return useQuery<InventoryListResponse>({
    queryKey:  INVENTORY_KEY,
    queryFn:   () => get<InventoryListResponse>(EP.STOCK_INVENTORY),
    staleTime: 120_000,
  });
}

// ── Stock Movements ───────────────────────────────────────────────────────────

export function useStockMovements() {
  return useQuery<StockMovementListResponse>({
    queryKey:  MOVEMENTS_KEY,
    queryFn:   () => get<StockMovementListResponse>(EP.STOCK_MOVEMENTS),
    staleTime: 60_000,
  });
}

export function useStockMovementCreate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<{ ok: true }>(EP.STOCK_MOVEMENTS_CREATE, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
      qc.invalidateQueries({ queryKey: INVENTORY_KEY });
    },
  });
  return { createMovement: mutation.mutateAsync, ...mutation };
}

export function useStockMovementDelete() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      del<{ ok: true }>(EP.STOCK_MOVEMENTS_DELETE(id), { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
      qc.invalidateQueries({ queryKey: INVENTORY_KEY });
    },
  });
  return { deleteMovement: mutation.mutateAsync, ...mutation };
}

export function useTransferApproveFromMovements() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: 'approve' | 'reject'; reason?: string }) =>
      post<{ ok: true }>(EP.WORKSHOPS_TRANSFER_APPROVE(id), { action, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
      qc.invalidateQueries({ queryKey: INVENTORY_KEY });
    },
  });
  return { approveTransfer: mutation.mutateAsync, ...mutation };
}

// ── Consumption shorthand (stock-out from catalog) ────────────────────────────

export function useStockConsume() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: {
      item_id: number;
      quantity: number;
      warehouse_id: number;
      notes?: string;
      reference?: string;
    }) =>
      post<{ ok: true }>(EP.STOCK_MOVEMENTS_CREATE, {
        ...payload,
        movement_type: 'out',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
      qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
      qc.invalidateQueries({ queryKey: INVENTORY_KEY });
    },
  });
  return { consumeStock: mutation.mutateAsync, ...mutation };
}
