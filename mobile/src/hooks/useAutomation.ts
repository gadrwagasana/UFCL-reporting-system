import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put } from '../api/client';
import { EP } from '../api/endpoints';
import type {
  AutomationDashboardResponse,
  AutomationRuleResponse,
  AutomationSeverity,
  AutomationAction,
} from '../types/api';

const QK = {
  dashboard: ['automation', 'dashboard'] as const,
  rule: (key: string) => ['automation', 'rule', key] as const,
};

export function useAutomationDashboard() {
  return useQuery<AutomationDashboardResponse>({
    queryKey: QK.dashboard,
    queryFn:  () => get<AutomationDashboardResponse>(EP.AUTOMATION_DASHBOARD),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAutomationRule(ruleKey: string) {
  return useQuery<AutomationRuleResponse>({
    queryKey: QK.rule(ruleKey),
    queryFn:  () => get<AutomationRuleResponse>(EP.AUTOMATION_RULE(ruleKey)),
    enabled:  !!ruleKey,
  });
}

export function useAutomationRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<{ ok: boolean; message?: string; error?: string }>(EP.AUTOMATION_RUN, {}),
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['automation'] }), 2000);
    },
  });
}

export interface UpdateRulePayload {
  ruleKey:        string;
  severity?:      AutomationSeverity;
  auto_action?:   AutomationAction;
  cooldown_hours?: number;
  notify_roles?:  string[];
  enabled?:       boolean;
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleKey, ...updates }: UpdateRulePayload) =>
      put<{ ok: boolean; error?: string }>(EP.AUTOMATION_RULE(ruleKey), updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation'] });
    },
  });
}

export function useResolveEscalation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      put<{ ok: boolean; error?: string }>(EP.AUTOMATION_ESCALATION_RESOLVE(id), { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation'] });
    },
  });
}

export function useAckEscalation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      put<{ ok: boolean; error?: string }>(EP.AUTOMATION_ESCALATION_ACK(id), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation'] });
    },
  });
}
