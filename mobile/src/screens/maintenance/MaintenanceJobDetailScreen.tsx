import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRoute, RouteProp } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import {
  useMaintenanceJobDetail, useMaintenanceJobTransition, useMaintenanceJobLabourAdd,
  useMaintenanceProductionImpactAdd, useMaintenanceAssetSummary, useMaintenanceJobAssign, MAINT_JOB_STATUS_LABEL,
} from '../../hooks/useMaintenanceJobs';
import { useAuth } from '../../hooks/useAuth';
import { MaintenanceJobsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type RouteType = RouteProp<MaintenanceJobsStackParamList, 'MaintenanceJobDetail'>;

// Mechanician Phase 3 — mirrors the desktop tabbed overlay's sections as
// scrollable card sections rather than tabs (mobile convention already
// established, e.g. VehicleDetailScreen).

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({ label, color, onPress }: { label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, color ? { borderColor: color } : null]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.actionBtnText, color ? { color } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Mechanician Phase 4 (Priority 5) — mobile equivalent of the desktop
// Timeline tab. Same detour-splice idea as _mjTimelineHtml on desktop: the
// linear stages render as a checked/current/pending chip row, and the two
// detour states (waiting_parts / external_repair) insert as one extra chip
// right after In Progress instead of a whole separate component.
const MAINT_TIMELINE_STAGES = ['inspection', 'diagnosis', 'assigned', 'in_progress', 'testing', 'returned_to_service', 'closed'] as const;
function TimelineRow({ status }: { status: string }) {
  if (status === 'cancelled') {
    return <Text style={[styles.metaLine, { color: Colors.error }]}>This job was cancelled — it left the normal flow.</Text>;
  }
  const isDetour = status === 'waiting_parts' || status === 'external_repair';
  const detourIdx = MAINT_TIMELINE_STAGES.indexOf('in_progress');
  const idx = MAINT_TIMELINE_STAGES.indexOf(status as typeof MAINT_TIMELINE_STAGES[number]);
  return (
    <View style={styles.timelineWrap}>
      {MAINT_TIMELINE_STAGES.map((s, i) => {
        const done = isDetour ? i <= detourIdx : i < idx;
        const current = isDetour ? false : i === idx;
        return (
          <View key={s} style={[styles.timelineChip, done && styles.timelineChipDone, current && styles.timelineChipCurrent]}>
            <Text style={[styles.timelineChipText, (done || current) && styles.timelineChipTextActive]}>
              {done ? '✓ ' : ''}{MAINT_JOB_STATUS_LABEL[s as keyof typeof MAINT_JOB_STATUS_LABEL]}
            </Text>
          </View>
        );
      })}
      {isDetour ? (
        <View style={[styles.timelineChip, { borderColor: status === 'waiting_parts' ? Colors.warning : Colors.error, backgroundColor: status === 'waiting_parts' ? Colors.warning : Colors.error }]}>
          <Text style={[styles.timelineChipText, styles.timelineChipTextActive]}>{MAINT_JOB_STATUS_LABEL[status as keyof typeof MAINT_JOB_STATUS_LABEL]}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function MaintenanceJobDetailScreen() {
  const { params } = useRoute<RouteType>();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useMaintenanceJobDetail(params.jobId);
  const { transition } = useMaintenanceJobTransition();
  const { addLabour } = useMaintenanceJobLabourAdd();
  const { addImpact } = useMaintenanceProductionImpactAdd();
  const { assign } = useMaintenanceJobAssign();

  const [reasonInput, setReasonInput] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [assignTechId, setAssignTechId] = useState('');
  const [labourHours, setLabourHours] = useState('');
  const [labourNotes, setLabourNotes] = useState('');
  const [impactDowntime, setImpactDowntime] = useState('');
  const [impactLoss, setImpactLoss] = useState('');
  const [impactReason, setImpactReason] = useState('');
  const [extCost, setExtCost] = useState('');
  const [extNotes, setExtNotes] = useState('');
  // Called unconditionally (Rules of Hooks) — guarded internally via `enabled`
  // since we don't know the job's machine_id until useMaintenanceJobDetail resolves.
  const { data: assetSummary } = useMaintenanceAssetSummary(data?.ok ? data.job.machine_id : 0);

  if (isLoading) return <LoadingState message="Loading job…" fullScreen />;
  if (isError || !data?.ok) return <ErrorState message="Could not load maintenance job" onRetry={refetch} fullScreen />;

  const { job: r, labour, parts, productionImpact, canManage, cost } = data;
  const isAssignee = String(r.assigned_to) === String(user?.id);
  const canAct = canManage || isAssignee;
  const needsReason = ['request_parts', 'send_external', 'cancel'].includes(pendingAction ?? '');

  async function recordVendorReturn() {
    try {
      await transition(r.id, 'return_external', {
        cost: extCost ? Number(extCost) : undefined,
        notes: extNotes || undefined,
      });
      setExtCost(''); setExtNotes('');
    } catch {
      Alert.alert('Error', 'Could not record the vendor return.');
    }
  }

  async function runAction(action: string) {
    if (['request_parts', 'send_external', 'cancel', '__assign'].includes(action)) {
      setPendingAction(action);
      return;
    }
    try {
      await transition(r.id, action);
    } catch {
      Alert.alert('Error', 'Could not update the job.');
    }
  }

  async function confirmReasonAction() {
    if (!reasonInput.trim()) { Alert.alert('Reason required', 'Please enter a reason.'); return; }
    try {
      await transition(r.id, pendingAction!, { reason: reasonInput.trim() });
      setPendingAction(null);
      setReasonInput('');
    } catch {
      Alert.alert('Error', 'Could not update the job.');
    }
  }

  async function confirmAssign() {
    const techId = Number(assignTechId);
    if (!techId) { Alert.alert('Technician required', 'Please enter a technician user ID.'); return; }
    try {
      await assign(r.id, techId);
      setPendingAction(null);
      setAssignTechId('');
    } catch {
      Alert.alert('Error', 'Could not assign the technician.');
    }
  }

  const actions: { action: string; label: string; color?: string }[] = [];
  if (canManage && ['inspection', 'diagnosis'].includes(r.status)) actions.push({ action: '__assign', label: 'Assign Technician', color: Colors.navy });
  if (canAct) {
    if (r.status === 'inspection') actions.push({ action: 'diagnose', label: 'Diagnose' });
    if (r.status === 'assigned') actions.push({ action: 'start', label: 'Start Work', color: Colors.success });
    if (r.status === 'in_progress') {
      actions.push({ action: 'request_parts', label: 'Request Parts', color: Colors.warning });
      actions.push({ action: 'test', label: 'Send to Testing' });
      if (canManage) actions.push({ action: 'send_external', label: 'Send for External Repair', color: Colors.error });
    }
    if (r.status === 'waiting_parts') {
      actions.push({ action: 'resume', label: 'Resume Work', color: Colors.success });
      if (canManage) actions.push({ action: 'send_external', label: 'Send for External Repair', color: Colors.error });
    }
    if (r.status === 'testing') actions.push({ action: 'return_to_service', label: 'Return to Service', color: Colors.success });
    if (r.status === 'returned_to_service') actions.push({ action: 'close', label: 'Close Job', color: Colors.success });
    if (!['closed', 'cancelled'].includes(r.status)) actions.push({ action: 'cancel', label: 'Cancel Job', color: Colors.error });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title={r.title} subtitle={`${r.machine_code} — ${r.machine_name}`} dark />
      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}>
        {assetSummary?.ok ? (
          <SectionCard title="Asset Summary">
            <Text style={styles.metaLine}>Machine status: {assetSummary.machine.status}</Text>
            <Text style={styles.metaLine}>Open maintenance: {assetSummary.openMaintenance}</Text>
            <Text style={styles.metaLine}>Last maintenance: {assetSummary.lastMaintenance ? new Date(assetSummary.lastMaintenance).toLocaleDateString('en-GB') : '—'}</Text>
            <Text style={styles.metaLine}>Next PM due: {assetSummary.nextPreventiveMaintenance ? new Date(assetSummary.nextPreventiveMaintenance).toLocaleDateString('en-GB') : '—'}</Text>
            <Text style={styles.metaLine}>Downtime this month: {assetSummary.downtimeHoursThisMonth.toFixed(1)}h</Text>
            <Text style={styles.metaLine}>Failures (90d): {assetSummary.recentFailures90d}</Text>
          </SectionCard>
        ) : null}

        <SectionCard title="Timeline">
          <TimelineRow status={r.status} />
        </SectionCard>

        <SectionCard title="Overview">
          <View style={styles.row}>
            <StatusBadge status={r.status} label={MAINT_JOB_STATUS_LABEL[r.status]} size="sm" />
            <Text style={styles.priorityText}>{r.priority.toUpperCase()}</Text>
          </View>
          <Text style={styles.metaLine}>Workshop: {r.workshop_name ?? '—'}</Text>
          <Text style={styles.metaLine}>Assigned to: {r.assigned_to_name ?? '—'}</Text>
          {r.description ? <Text style={styles.metaLine}>{r.description}</Text> : null}
          {r.delay_reason ? <Text style={[styles.metaLine, { color: Colors.warning }]}>Delay: {r.delay_reason}</Text> : null}
          {r.cancelled_reason ? <Text style={[styles.metaLine, { color: Colors.error }]}>Cancelled: {r.cancelled_reason}</Text> : null}

          {actions.length ? (
            <View style={styles.actionRow}>
              {actions.map((a) => <ActionButton key={a.action} label={a.label} color={a.color} onPress={() => runAction(a.action)} />)}
            </View>
          ) : null}
          {pendingAction === '__assign' ? (
            <View style={styles.inlineForm}>
              <Text style={styles.formLabel}>Technician user ID *</Text>
              <TextInput style={styles.input} value={assignTechId} onChangeText={setAssignTechId} placeholder="User ID" keyboardType="numeric" />
              <View style={styles.actionRow}>
                <ActionButton label="Assign" color={Colors.success} onPress={confirmAssign} />
                <ActionButton label="Cancel" onPress={() => { setPendingAction(null); setAssignTechId(''); }} />
              </View>
            </View>
          ) : pendingAction ? (
            <View style={styles.inlineForm}>
              <Text style={styles.formLabel}>Reason {needsReason ? '*' : ''}</Text>
              <TextInput style={styles.input} value={reasonInput} onChangeText={setReasonInput} placeholder="Reason" />
              <View style={styles.actionRow}>
                <ActionButton label="Confirm" color={Colors.success} onPress={confirmReasonAction} />
                <ActionButton label="Cancel" onPress={() => { setPendingAction(null); setReasonInput(''); }} />
              </View>
            </View>
          ) : null}
        </SectionCard>

        <SectionCard title="Cost (parts + external repair)">
          <Text style={styles.metaLine}>Parts (received): RWF {Math.round(cost.partsCostActual).toLocaleString()}</Text>
          <Text style={styles.metaLine}>Parts (pending): RWF {Math.round(cost.partsCostPending).toLocaleString()}</Text>
          <Text style={styles.metaLine}>External repair: RWF {Math.round(cost.externalRepairCost).toLocaleString()}</Text>
          <Text style={styles.metaLine}>Labour hours: {cost.labourHours.toFixed(1)}h</Text>
          <Text style={[styles.metaLine, { fontWeight: Typography.semibold }]}>Total: RWF {Math.round(cost.totalCost).toLocaleString()}</Text>
        </SectionCard>

        {(r.external_repair_vendor || r.external_repair_sent_at || r.status === 'external_repair') ? (
          <SectionCard title="External Repair">
            <Text style={styles.metaLine}>Vendor: {r.external_repair_vendor ?? '—'}</Text>
            <Text style={styles.metaLine}>Reason: {r.external_repair_reason ?? '—'}</Text>
            <Text style={styles.metaLine}>Sent: {r.external_repair_sent_at ? new Date(r.external_repair_sent_at).toLocaleDateString('en-GB') : '—'}</Text>
            <Text style={styles.metaLine}>Returned: {r.external_repair_returned_at ? new Date(r.external_repair_returned_at).toLocaleDateString('en-GB') : '—'}</Text>
            <Text style={styles.metaLine}>Cost: {r.external_repair_cost ? `RWF ${Number(r.external_repair_cost).toLocaleString()}` : '—'}</Text>
            {canAct && r.status === 'external_repair' ? (
              <View style={styles.inlineForm}>
                <Text style={styles.formLabel}>Record vendor return</Text>
                <TextInput style={styles.input} value={extCost} onChangeText={setExtCost} placeholder="Cost (RWF)" keyboardType="numeric" />
                <TextInput style={styles.input} value={extNotes} onChangeText={setExtNotes} placeholder="Notes" />
                <ActionButton label="Record Return & Move to Testing" color={Colors.success} onPress={recordVendorReturn} />
              </View>
            ) : null}
          </SectionCard>
        ) : null}

        <SectionCard title={`Labour (${labour.length})`}>
          {labour.length === 0 ? <Text style={styles.emptyText}>No labour sessions yet.</Text> : labour.map((l) => (
            <View key={l.id} style={styles.labourRow}>
              <Text style={styles.metaLine}>{l.technician_name ?? '—'} · {l.hours_worked != null ? `${l.hours_worked}h` : 'In progress'}</Text>
              {l.notes ? <Text style={styles.subText}>{l.notes}</Text> : null}
            </View>
          ))}
          {canAct ? (
            <View style={styles.inlineForm}>
              <Text style={styles.formLabel}>Add note / manual hours</Text>
              <TextInput style={styles.input} value={labourHours} onChangeText={setLabourHours} placeholder="Hours" keyboardType="numeric" />
              <TextInput style={styles.input} value={labourNotes} onChangeText={setLabourNotes} placeholder="Notes" />
              <ActionButton label="Add Entry" color={Colors.navy} onPress={async () => {
                await addLabour(r.id, { hours: labourHours ? Number(labourHours) : undefined, notes: labourNotes || undefined });
                setLabourHours(''); setLabourNotes('');
              }} />
            </View>
          ) : null}
        </SectionCard>

        <SectionCard title={`Parts (${parts.length})`}>
          {parts.length === 0 ? <Text style={styles.emptyText}>No material requests linked yet.</Text> : parts.map((p) => (
            <View key={p.id} style={styles.labourRow}>
              <Text style={styles.metaLine}>{p.item_name} · Qty {p.requested_qty}</Text>
              <Text style={styles.subText}>{p.status}{p.transfer_status ? ` · Transfer: ${p.transfer_status}` : ''}</Text>
            </View>
          ))}
          <Text style={styles.hintText}>Request materials for this job from the Materials tab, selecting this job when prompted.</Text>
        </SectionCard>

        <SectionCard title={`Production Impact (${productionImpact.length})`}>
          {productionImpact.length === 0 ? <Text style={styles.emptyText}>No production impact recorded.</Text> : productionImpact.map((pi) => (
            <View key={pi.id} style={styles.labourRow}>
              <Text style={styles.metaLine}>{pi.log_date} · {pi.downtime_hours ?? '—'}h downtime</Text>
              {pi.reason ? <Text style={styles.subText}>{pi.reason}</Text> : null}
            </View>
          ))}
          <View style={styles.inlineForm}>
            <Text style={styles.formLabel}>Log production impact</Text>
            <TextInput style={styles.input} value={impactDowntime} onChangeText={setImpactDowntime} placeholder="Downtime hours" keyboardType="numeric" />
            <TextInput style={styles.input} value={impactLoss} onChangeText={setImpactLoss} placeholder="Estimated production loss" keyboardType="numeric" />
            <TextInput style={styles.input} value={impactReason} onChangeText={setImpactReason} placeholder="Reason" />
            <ActionButton label="Log Impact" color={Colors.navy} onPress={async () => {
              await addImpact({
                job_id: r.id,
                downtime_hours: impactDowntime ? Number(impactDowntime) : undefined,
                estimated_production_loss: impactLoss ? Number(impactLoss) : undefined,
                reason: impactReason || undefined,
              });
              setImpactDowntime(''); setImpactLoss(''); setImpactReason('');
            }} />
          </View>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  section: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  priorityText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted },
  metaLine: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: 2 },
  subText: { fontSize: Typography.xs, color: Colors.textMuted },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
  hintText: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.xs, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  actionBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: Spacing.md },
  actionBtnText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textPrimary },

  timelineWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timelineChip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 4, paddingHorizontal: Spacing.sm, backgroundColor: Colors.card },
  timelineChipDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  timelineChipCurrent: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  timelineChipText: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
  timelineChipTextActive: { color: Colors.white },

  inlineForm: { marginTop: Spacing.sm, gap: Spacing.xs },
  formLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.sm, color: Colors.textPrimary },
  labourRow: { paddingVertical: 4, borderTopWidth: 1, borderTopColor: Colors.border },
});
