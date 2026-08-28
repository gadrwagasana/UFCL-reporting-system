import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import {
  AttendanceRosterResponse, AttendanceListResponse, AttendanceDashboardResponse,
  AttendanceReportResponse, AttendancePersonType, AttendanceStatus,
} from '../types/api';

// HR Enterprise Phase 2 — Attendance's first mobile exposure.

export function useAttendanceRoster(workshopId: number | null, date: string) {
  return useQuery<AttendanceRosterResponse>({
    queryKey:  ['attendance-roster', workshopId, date],
    queryFn:   () => get<AttendanceRosterResponse>(EP.ATTENDANCE_ROSTER, { workshopId: workshopId ?? undefined, date }),
    staleTime: 30_000,
    enabled:   !!date,
  });
}

interface AttendanceMarkPayload {
  person_type:      AttendancePersonType;
  person_id:        number;
  attendance_date:  string;
  workshop_id?:     number | null;
  status:           AttendanceStatus;
  check_in?:        string | null;
  check_out?:       string | null;
  notes?:           string | null;
}

export function useAttendanceMark() {
  const qc = useQueryClient();

  async function markAttendance(payload: AttendanceMarkPayload): Promise<{ ok: boolean; id?: number; error?: string }> {
    const result = await post<{ ok: boolean; id?: number; error?: string }>(EP.ATTENDANCE_MARK, payload);
    await qc.invalidateQueries({ queryKey: ['attendance-roster'] });
    await qc.invalidateQueries({ queryKey: ['attendance-list'] });
    await qc.invalidateQueries({ queryKey: ['attendance-dashboard'] });
    return result;
  }

  return { markAttendance };
}

interface AttendanceFilters {
  date?: string; date_from?: string; date_to?: string;
  workshop_id?: number | string; status?: AttendanceStatus;
  person_type?: AttendancePersonType; person_id?: number;
}

export function useAttendanceList(filters: AttendanceFilters) {
  return useQuery<AttendanceListResponse>({
    queryKey:  ['attendance-list', filters],
    queryFn:   () => get<AttendanceListResponse>(EP.ATTENDANCE_LIST, filters as Record<string, unknown>),
    staleTime: 30_000,
  });
}

export function useAttendanceDashboard(workshopId: number | null) {
  return useQuery<AttendanceDashboardResponse>({
    queryKey:  ['attendance-dashboard', workshopId],
    queryFn:   () => get<AttendanceDashboardResponse>(EP.ATTENDANCE_DASHBOARD, { workshopId: workshopId ?? undefined }),
    staleTime: 30_000,
  });
}

export function useAttendanceReportFetch() {
  async function fetchReport(filters: AttendanceFilters): Promise<AttendanceReportResponse> {
    return get<AttendanceReportResponse>(EP.ATTENDANCE_REPORT, filters as Record<string, unknown>);
  }
  return { fetchReport };
}

interface AttendanceUpdatePayload {
  status?: AttendanceStatus; check_in?: string | null; check_out?: string | null; notes?: string | null;
}

export function useAttendanceUpdate() {
  const qc = useQueryClient();

  async function updateAttendance(id: number, payload: AttendanceUpdatePayload): Promise<{ ok: boolean; error?: string }> {
    const result = await put<{ ok: boolean; error?: string }>(EP.ATTENDANCE_UPDATE(id), payload);
    await qc.invalidateQueries({ queryKey: ['attendance-list'] });
    await qc.invalidateQueries({ queryKey: ['attendance-dashboard'] });
    return result;
  }

  return { updateAttendance };
}

export function useAttendanceDelete() {
  const qc = useQueryClient();

  async function deleteAttendance(id: number, reason?: string): Promise<{ ok: boolean; error?: string }> {
    const result = await del<{ ok: boolean; error?: string }>(EP.ATTENDANCE_DELETE(id), reason ? { reason } : undefined);
    await qc.invalidateQueries({ queryKey: ['attendance-list'] });
    await qc.invalidateQueries({ queryKey: ['attendance-dashboard'] });
    return result;
  }

  return { deleteAttendance };
}
