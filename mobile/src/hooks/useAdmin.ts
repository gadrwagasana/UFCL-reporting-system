import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import type {
  SecGovDashboardResponse, AuditListResponse, UsersListResponse, RolesListResponse,
  TrashListResponse, ChangesListResponse,
} from '../types/api';

export interface AuditFilters {
  module?:     string;
  actionType?: string;
  roleFilter?: string;
  fromDate?:   string;
  toDate?:     string;
  search?:     string;
}

const QK = {
  secgov:  ['admin-secgov']                         as const,
  audit:   (f: AuditFilters) => ['admin-audit', f] as const,
  users:   ['admin-users']                          as const,
  roles:   ['admin-roles']                          as const,
  trash:   ['admin-trash']                          as const,
  changes: ['admin-changes']                        as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useSecGov() {
  return useQuery({
    queryKey: QK.secgov,
    queryFn:  () => get<SecGovDashboardResponse>(EP.ADMIN_SECGOV),
    staleTime: 60_000,
  });
}

export function useAudit(filters: AuditFilters = {}) {
  const params: Record<string, string> = {};
  if (filters.module)     params.module     = filters.module;
  if (filters.actionType) params.actionType = filters.actionType;
  if (filters.roleFilter) params.roleFilter = filters.roleFilter;
  if (filters.fromDate)   params.fromDate   = filters.fromDate;
  if (filters.toDate)     params.toDate     = filters.toDate;
  if (filters.search)     params.search     = filters.search;
  const qs  = new URLSearchParams(params).toString();
  const url = qs ? `${EP.ADMIN_AUDIT}?${qs}` : EP.ADMIN_AUDIT;

  return useQuery({
    queryKey: QK.audit(filters),
    queryFn:  () => get<AuditListResponse>(url),
    staleTime: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: QK.users,
    queryFn:  () => get<UsersListResponse>(EP.ADMIN_USERS),
    staleTime: 0,
  });
}

export function useAdminRoles() {
  return useQuery({
    queryKey: QK.roles,
    queryFn:  () => get<RolesListResponse>(EP.ADMIN_ROLES),
    staleTime: 300_000,
  });
}

export function useAdminTrash() {
  return useQuery({
    queryKey: QK.trash,
    queryFn:  () => get<TrashListResponse>(EP.ADMIN_TRASH),
    staleTime: 0,
  });
}

export function useChanges() {
  return useQuery({
    queryKey: QK.changes,
    queryFn:  () => get<ChangesListResponse>(EP.ADMIN_CHANGES),
    staleTime: 0,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      username: string; name: string; role: string; department?: string;
      password: string; workshop_id?: number | null; active?: boolean;
    }) => post<{ ok: boolean; error?: string }>(EP.ADMIN_USERS, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...payload }: {
      userId: number; name?: string; role?: string; department?: string;
      permissions?: string[]; responsibilities?: string[]; active?: boolean;
      workshop_id?: number | null;
    }) => put<{ ok: boolean; error?: string }>(EP.ADMIN_USER(userId), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      del<{ ok: boolean; error?: string }>(EP.ADMIN_USER(userId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
      post<{ ok: boolean; error?: string }>(EP.ADMIN_USER_RESET_PW(userId), { newPassword }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ role, ...payload }: {
      role: string; description?: string; responsibilities?: string[];
      permissions?: string[];
    }) => put<{ ok: boolean; error?: string }>(EP.ADMIN_ROLE(role), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.roles }),
  });
}

export function useTrashRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableName, recordId }: { tableName: string; recordId: number }) =>
      post<{ ok: boolean; error?: string }>(EP.ADMIN_TRASH_RESTORE, { tableName, recordId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.trash }),
  });
}

export function useTrashPurge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableName, recordId }: { tableName: string; recordId: number }) =>
      post<{ ok: boolean; error?: string }>(EP.ADMIN_TRASH_PURGE, { tableName, recordId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.trash }),
  });
}

export function useSubmitChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { record_type: string; record_ref: string; request_text: string }) =>
      post<{ ok: boolean; error?: string }>(EP.ADMIN_CHANGES, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.changes }),
  });
}

export function useReviewChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, response }: {
      id: number; status: 'Approved' | 'Rejected'; response?: string;
    }) => put<{ ok: boolean; error?: string }>(EP.ADMIN_CHANGE(id), { status, response }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.changes }),
  });
}
