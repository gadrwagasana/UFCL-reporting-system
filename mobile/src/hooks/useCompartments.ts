import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import type { CompartmentListResponse, CompartmentPendingApproval } from '../types/api';

export function useCompartmentList() {
  return useQuery({
    queryKey: ['compartment-list'],
    queryFn:  () => get<CompartmentListResponse>(EP.COMPARTMENTS_LIST),
    staleTime: 60_000,
  });
}

export function useCompartmentCreate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post(EP.COMPARTMENTS_CREATE, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compartment-list'] }),
  });
  return { createCompartment: mutation.mutateAsync };
}

export function useCompartmentUpdate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      put<CompartmentPendingApproval | { ok: true }>(EP.COMPARTMENTS_UPDATE(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compartment-list'] }),
  });
  return { updateCompartment: mutation.mutateAsync };
}

export function useCompartmentDelete() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, reason, entityRef }: { id: number; reason?: string; entityRef?: string }) =>
      del<CompartmentPendingApproval | { ok: true }>(EP.COMPARTMENTS_DELETE(id), { reason, entityRef }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compartment-list'] }),
  });
  return { deleteCompartment: mutation.mutateAsync };
}
