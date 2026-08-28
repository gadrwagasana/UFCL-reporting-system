import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import type { WorkshopOverviewResponse, WorkshopListResponse } from '../types/api';

export function useWorkshopOverview() {
  return useQuery({
    queryKey: ['workshop-overview'],
    queryFn:  () => get<WorkshopOverviewResponse>(EP.WORKSHOPS_OVERVIEW),
    staleTime: 30_000,
  });
}

export function useWorkshopList() {
  return useQuery({
    queryKey: ['workshop-list'],
    queryFn:  () => get<WorkshopListResponse>(EP.WORKSHOPS_LIST),
    staleTime: 60_000,
  });
}

export function useWorkshopCreate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post(EP.WORKSHOPS_CREATE, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workshop-list'] });
      qc.invalidateQueries({ queryKey: ['workshop-overview'] });
    },
  });
  return { createWorkshop: mutation.mutateAsync };
}

export function useWorkshopUpdate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      put(EP.WORKSHOPS_UPDATE(id), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workshop-list'] });
      qc.invalidateQueries({ queryKey: ['workshop-overview'] });
    },
  });
  return { updateWorkshop: mutation.mutateAsync };
}

export function useWorkshopDelete() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: number) => del(EP.WORKSHOPS_DELETE(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workshop-list'] });
      qc.invalidateQueries({ queryKey: ['workshop-overview'] });
    },
  });
  return { deleteWorkshop: mutation.mutateAsync };
}

export function useTransferApprove() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      movementId,
      action,
      rejectionReason,
    }: {
      movementId:      number;
      action:          'approve' | 'reject';
      rejectionReason?: string;
    }) => post(EP.WORKSHOPS_TRANSFER_APPROVE(movementId), { action, rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workshop-overview'] });
    },
  });
  return { approveTransfer: mutation.mutateAsync };
}

export function useMaterialRequestApproveFromOverview() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      requestId,
      action,
      approvedQty,
      reviewNotes,
      sourceWarehouseId,
      destinationWorkshopId,
    }: {
      requestId:              number;
      action:                 'approve' | 'reject';
      approvedQty?:           number;
      reviewNotes?:           string;
      sourceWarehouseId?:     number;
      destinationWorkshopId?: number;
    }) => post(EP.MATERIAL_APPROVE(requestId), { action, approvedQty, reviewNotes, sourceWarehouseId, destinationWorkshopId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workshop-overview'] });
      qc.invalidateQueries({ queryKey: ['material-requests'] });
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
  });
  return { approveMaterialRequest: mutation.mutateAsync };
}
