import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useAutomationDashboard } from '../../hooks/useAutomation';
import { AdminStackParamList } from '../../navigation/types';
import type { WorkflowJob } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function PendingJob({ job }: { job: WorkflowJob }) {
  const runAt = job.run_at ? new Date(job.run_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
  return (
    <View style={s.jobRow}>
      <Ionicons name="time-outline" size={16} color={Colors.navy} style={{ flexShrink: 0, marginTop: 1 }} />
      <View style={s.jobBody}>
        <Text style={s.jobType}>{job.type}</Text>
        <Text style={s.jobMeta}>Run at: {runAt} · {job.attempts}/{job.max_attempts} attempts</Text>
      </View>
    </View>
  );
}

function FailedJob({ job }: { job: WorkflowJob }) {
  return (
    <View style={s.jobRow}>
      <Ionicons name="warning" size={16} color={Colors.error} style={{ flexShrink: 0, marginTop: 1 }} />
      <View style={s.jobBody}>
        <Text style={[s.jobType, { color: Colors.error }]}>{job.type}</Text>
        <Text style={s.jobMeta}>
          {job.attempts}/{job.max_attempts} attempts · {fmtAgo(job.processed_at)}
        </Text>
        {job.last_error ? (
          <Text style={s.jobError} numberOfLines={2}>{String(job.last_error).slice(0, 120)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Section({
  title, count, color, expanded, onToggle, children,
}: {
  title: string; count: number; color: string;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <TouchableOpacity style={s.sectionHeader} onPress={onToggle} activeOpacity={0.8}>
        <Text style={[s.sectionTitle, { color }]}>{title}</Text>
        <View style={[s.countBadge, { backgroundColor: color + '1A' }]}>
          <Text style={[s.countBadgeText, { color }]}>{count}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>
      {expanded && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

export function AutomationJobsScreen() {
  const navigation = useNavigation<Nav>();
  const [pendingOpen, setPendingOpen] = useState(true);
  const [failedOpen,  setFailedOpen]  = useState(true);

  const { data: res, isLoading, isRefetching, refetch } = useAutomationDashboard();

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Workflow Jobs" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  const pending = res?.ok ? res.pending_jobs || [] : [];
  const failed  = res?.ok ? res.failed_jobs  || [] : [];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Workflow Jobs" onBack={() => navigation.goBack()} />

      <FlatList
        data={[]}
        renderItem={null}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <>
            <Section
              title="Upcoming Jobs"
              count={pending.length}
              color={Colors.navy}
              expanded={pendingOpen}
              onToggle={() => setPendingOpen(v => !v)}
            >
              {pending.length === 0 ? (
                <Text style={s.emptySection}>No pending jobs.</Text>
              ) : (
                pending.map((j, i) => (
                  <View key={j.id}>
                    <PendingJob job={j} />
                    {i < pending.length - 1 && <View style={s.divider} />}
                  </View>
                ))
              )}
            </Section>

            <Section
              title="Failed Jobs"
              count={failed.length}
              color={failed.length > 0 ? Colors.error : Colors.textMuted}
              expanded={failedOpen}
              onToggle={() => setFailedOpen(v => !v)}
            >
              {failed.length === 0 ? (
                <Text style={s.emptySection}>No failed jobs.</Text>
              ) : (
                failed.map((j, i) => (
                  <View key={j.id}>
                    <FailedJob job={j} />
                    {i < failed.length - 1 && <View style={s.divider} />}
                  </View>
                ))
              )}
            </Section>
          </>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  section:       { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.sm, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sectionTitle:  { fontSize: Typography.sm, fontWeight: Typography.semibold },
  countBadge:    { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: Radius.full },
  countBadgeText:{ fontSize: Typography.xs, fontWeight: Typography.bold },
  sectionBody:   { padding: Spacing.base },

  jobRow:  { flexDirection: 'row', gap: Spacing.sm },
  jobBody: { flex: 1 },
  jobType: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  jobMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  jobError:{ fontSize: 10, color: Colors.error, marginTop: 3, opacity: 0.85 },

  divider:      { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.sm },
  emptySection: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.sm },
});
