import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { useAuth }      from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import { get }          from '../../api/client';
import { EP }           from '../../api/endpoints';
import {
  MyRequestsResponse, HarvestListResponse, DailyListResponse,
  MaterialRequestsListResponse, CasualLabourListResponse,
} from '../../types/api';
import { roleLabel } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';
import { UserRole }  from '../../types/auth';

const TODAY_FMT = format(new Date(), 'dd/MM/yyyy');

// ─── Quick action definitions per role ───────────────────────────────────────

interface QuickAction {
  label:     string;
  icon:      string;
  available: boolean;
}

function getQuickActions(role: UserRole | null): QuickAction[] {
  switch (role) {
    case 'supervisor':
      return [
        { label: 'Material Requests', icon: 'cart-outline',    available: true },
        { label: 'Casual Labour',     icon: 'people-outline',  available: true },
        { label: 'Vehicle Fuel',      icon: 'car-outline',     available: false },
        { label: 'My Requests',       icon: 'list-outline',    available: true },
      ];
    case 'harvesting-leader':
      return [
        { label: 'Harvest Log',       icon: 'leaf-outline',        available: true },
        { label: 'Log Transport',     icon: 'trail-sign-outline',  available: true },
        { label: 'Material Requests', icon: 'cart-outline',        available: true },
        { label: 'Casual Labour',     icon: 'people-outline',      available: true },
        { label: 'My Requests',       icon: 'list-outline',        available: true },
      ];
    case 'sawmill-leader':
      return [
        { label: 'Production Log',    icon: 'construct-outline',   available: true },
        { label: 'Material Requests', icon: 'cart-outline',        available: true },
        { label: 'Casual Labour',     icon: 'people-outline',      available: true },
        { label: 'My Requests',       icon: 'list-outline',        available: true },
      ];
    case 'poles-leader':
      return [
        { label: 'Poles Purchase',    icon: 'pricetag-outline',            available: false },
        { label: 'Poles Delivery',    icon: 'cube-outline',                available: false },
        { label: 'Quality Check',     icon: 'shield-checkmark-outline',    available: false },
        { label: 'My Requests',       icon: 'list-outline',                available: true  },
      ];
    case 'mechanician':
      return [
        { label: 'Machine Logs',      icon: 'settings-outline',  available: false },
        { label: 'Machine Fuel',      icon: 'flash-outline',     available: false },
        { label: 'My Requests',       icon: 'list-outline',      available: true  },
      ];
    case 'operations':
      return [
        { label: 'Material Reviews',  icon: 'checkmark-circle-outline',  available: false },
        { label: 'Labour Reviews',    icon: 'people-circle-outline',     available: false },
        { label: 'My Requests',       icon: 'list-outline',              available: true  },
      ];
    default:
      return [{ label: 'My Requests', icon: 'list-outline', available: true }];
  }
}

// ─── Action card ─────────────────────────────────────────────────────────────

function ActionCard({ action }: { action: QuickAction }) {
  return (
    <View style={[styles.actionCard, !action.available && styles.actionCardLocked]}>
      <View style={[styles.actionIconWrap, !action.available && styles.actionIconWrapLocked]}>
        <Ionicons
          name={action.available ? (action.icon as never) : 'lock-closed-outline'}
          size={24}
          color={action.available ? Colors.navy : Colors.textMuted}
        />
      </View>
      <Text style={[styles.actionLabel, !action.available && styles.actionLabelLocked]}>
        {action.label}
      </Text>
      {!action.available && (
        <Text style={styles.actionComingSoon}>Coming Soon</Text>
      )}
    </View>
  );
}

// ─── Role-specific stats ──────────────────────────────────────────────────────

function StatCard({
  value, label, color = Colors.navy,
}: { value: string | number; label: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function HarvestStats({ role }: { role: UserRole | null }) {
  const { data: harvest } = useQuery<HarvestListResponse>({
    queryKey:  ['harvest-list'],
    queryFn:   () => get<HarvestListResponse>(EP.HARVEST_LIST),
    staleTime: 2 * 60_000,
    enabled:   role === 'harvesting-leader',
  });
  const { data: materials } = useQuery<MaterialRequestsListResponse>({
    queryKey:  ['material-requests'],
    queryFn:   () => get<MaterialRequestsListResponse>(EP.MATERIAL_LIST),
    staleTime: 2 * 60_000,
    enabled:   role === 'harvesting-leader',
  });
  const { data: labour } = useQuery<CasualLabourListResponse>({
    queryKey:  ['casual-labour'],
    queryFn:   () => get<CasualLabourListResponse>(EP.LABOUR_LIST),
    staleTime: 2 * 60_000,
    enabled:   role === 'harvesting-leader',
  });

  if (!harvest && !materials && !labour) return null;

  const todayTrees = (harvest?.rows ?? [])
    .filter((r) => r.harvest_date === TODAY_FMT)
    .reduce((s, r) => s + Number(r.quantity), 0);

  const todayLogs = (harvest?.rows ?? [])
    .filter((r) => r.harvest_date === TODAY_FMT)
    .reduce((s, r) => s + Number(r.logs_crosscut ?? 0), 0);

  const pendingMat = (materials?.rows ?? []).filter((r) => r.status === 'pending').length;
  const pendingLab = (labour?.rows ?? []).filter((r) => r.status === 'Pending').length;

  return (
    <>
      <Text style={styles.sectionTitle}>Today's Activity</Text>
      <View style={styles.statsRow}>
        <StatCard value={todayTrees} label="Trees Harvested" color={Colors.green} />
        <StatCard value={todayLogs}  label="Logs Crosscut"   color={Colors.green} />
      </View>
      {(pendingMat + pendingLab) > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending Requests</Text>
          <View style={styles.statsRow}>
            {pendingMat > 0 && <StatCard value={pendingMat} label="Material Requests" color={Colors.warning} />}
            {pendingLab > 0 && <StatCard value={pendingLab} label="Labour Requests"   color={Colors.warning} />}
          </View>
        </>
      )}
    </>
  );
}

function SawmillStats({ role }: { role: UserRole | null }) {
  const { data: sawmill } = useQuery<DailyListResponse>({
    queryKey:  ['sawmill-list'],
    queryFn:   () => get<DailyListResponse>(EP.SAWMILL_LIST),
    staleTime: 2 * 60_000,
    enabled:   role === 'sawmill-leader',
  });
  const { data: materials } = useQuery<MaterialRequestsListResponse>({
    queryKey:  ['material-requests'],
    queryFn:   () => get<MaterialRequestsListResponse>(EP.MATERIAL_LIST),
    staleTime: 2 * 60_000,
    enabled:   role === 'sawmill-leader',
  });
  const { data: labour } = useQuery<CasualLabourListResponse>({
    queryKey:  ['casual-labour'],
    queryFn:   () => get<CasualLabourListResponse>(EP.LABOUR_LIST),
    staleTime: 2 * 60_000,
    enabled:   role === 'sawmill-leader',
  });

  if (!sawmill && !materials && !labour) return null;

  const todayRows = (sawmill?.rows ?? []).filter((r) => r.date === TODAY_FMT);
  const todayTimber = todayRows.reduce(
    (s, r) =>
      s + (Number(r.timber_kiln_dried ?? 0) +
           Number(r.timber_cca_treated ?? 0) +
           Number(r.timber_untreated ?? 0)),
    0,
  );
  const todayWaste = todayRows.reduce((s, r) => s + Number(r.timber_waste ?? 0), 0);

  const pendingMat = (materials?.rows ?? []).filter((r) => r.status === 'pending').length;
  const pendingLab = (labour?.rows ?? []).filter((r) => r.status === 'Pending').length;

  return (
    <>
      <Text style={styles.sectionTitle}>Today's Production</Text>
      <View style={styles.statsRow}>
        <StatCard value={todayTimber} label="Timber Units"  color={Colors.navy} />
        <StatCard value={todayWaste}  label="Waste Units"   color={Colors.warning} />
      </View>
      {(pendingMat + pendingLab) > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending Requests</Text>
          <View style={styles.statsRow}>
            {pendingMat > 0 && <StatCard value={pendingMat} label="Material Requests" color={Colors.warning} />}
            {pendingLab > 0 && <StatCard value={pendingLab} label="Labour Requests"   color={Colors.warning} />}
          </View>
        </>
      )}
    </>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const { user, role } = useAuth();
  const isOfflineSession = useAuthStore((s) => s.isOfflineSession);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const { data, isLoading, isRefetching, refetch } = useQuery<MyRequestsResponse>({
    queryKey:  ['my-requests'],
    queryFn:   () => get<MyRequestsResponse>(EP.MY_REQUESTS),
    staleTime: 2 * 60_000,
  });

  const pendingCount = (data?.edits ?? []).filter((r) => r.status === 'pending').length
    + (data?.deletions ?? []).filter((r) => r.status === 'pending').length;

  const actions = getQuickActions(role);

  if (isLoading) {
    return <LoadingState message="Loading dashboard…" fullScreen />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Dashboard" dark />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
        }
      >
        {isOfflineSession && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning} />
            <Text style={styles.offlineBannerText}>Offline Mode — Data from last sync</Text>
          </View>
        )}

        {/* Greeting */}
        <View style={styles.heroCard}>
          <View>
            <Text style={styles.greeting}>Good morning, {firstName}</Text>
            <Text style={styles.heroRole}>{roleLabel(role ?? '')}</Text>
            {user?.workshopName ? (
              <View style={styles.workshopRow}>
                <Ionicons name="business-outline" size={13} color={Colors.textOnDarkMuted} />
                <Text style={styles.workshopText}>{user.workshopName}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Pending submissions (universal) */}
        <Text style={styles.sectionTitle}>Submissions</Text>
        <View style={styles.statsRow}>
          <StatCard value={pendingCount} label="Pending Submissions" />
        </View>

        {/* Role-specific stats */}
        {role === 'harvesting-leader' && <HarvestStats role={role} />}
        {role === 'sawmill-leader'    && <SawmillStats role={role} />}

        {/* Quick actions overview */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {actions.map((action) => (
            <ActionCard key={action.label} action={action} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: Spacing.md,
  },
  offlineBannerText: {
    fontSize: Typography.sm, color: Colors.warning, fontWeight: Typography.medium, flex: 1,
  },

  heroCard: {
    backgroundColor: Colors.navy, borderRadius: Radius.xl,
    padding: Spacing.xl, ...Shadow.md,
  },
  greeting:    { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textOnDark },
  heroRole:    {
    fontSize: Typography.sm, color: Colors.textOnDarkMuted,
    marginTop: Spacing.xxs, fontWeight: Typography.medium,
  },
  workshopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  workshopText:{ fontSize: Typography.xs, color: Colors.textOnDarkMuted },

  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  statValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.navy },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.xxs, textAlign: 'center' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: {
    width: '47.5%', backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, alignItems: 'center', gap: Spacing.xs, ...Shadow.sm,
  },
  actionCardLocked: { opacity: 0.55 },
  actionIconWrap: {
    width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  actionIconWrapLocked: { backgroundColor: Colors.divider },
  actionLabel:       { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary, textAlign: 'center' },
  actionLabelLocked: { color: Colors.textMuted },
  actionComingSoon:  { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
});
