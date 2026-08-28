import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import { LogTransportListResponse } from '../types/api';

interface LogTransportPendingApproval {
  ok:              true;
  pendingApproval: true;
  level:           string;
  message:         string;
}

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

// Remediation Phase 2 — logTransportUpdate had backend/IPC wiring (desktop)
// with no REST route or mobile UI at all; entries could be created but
// never corrected on either platform (desktop's own edit UI was added in
// this same phase).
export function useLogTransportUpdate() {
  const qc = useQueryClient();

  async function updateEntry(id: number, payload: CreateLogTransportPayload): Promise<LogTransportPendingApproval | void> {
    const result = await put<LogTransportPendingApproval | { ok: true }>(EP.LOG_TRANSPORT_UPDATE(id), payload);
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as LogTransportPendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['log-transport-list'] });
    await qc.invalidateQueries({ queryKey: ['sawmill-list'] });
  }

  return { updateEntry };
}

// ERP Final Enterprise Completion Gate — logTransportDelete had backend/IPC
// wiring (desktop) with no REST route or mobile UI at all — same gap
// useLogTransportUpdate closed for Update.
export function useLogTransportDelete() {
  const qc = useQueryClient();

  async function deleteEntry(id: number, reason?: string): Promise<LogTransportPendingApproval | void> {
    const result = await del<LogTransportPendingApproval | { ok: true }>(EP.LOG_TRANSPORT_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as LogTransportPendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['log-transport-list'] });
    await qc.invalidateQueries({ queryKey: ['sawmill-list'] });
  }

  return { deleteEntry };
}
