import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { useAuth }      from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import { get }          from '../../api/client';
import { EP }           from '../../api/endpoints';
import { MyRequestsResponse } from '../../types/api';
import { roleLabel }    from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';
import { UserRole }     from '../../types/auth';

// ─── Quick action definitions per role ───────────────────────────────────────

interface QuickAction {
  label:    string;
  icon:     string;
  sprint1:  boolean;   // true = navigable now, false = locked until Sprint 2
  screen?:  string;
}

function getQuickActions(role: UserRole | null): QuickAction[] {
  switch (role) {
    case 'supervisor':
      return [
        { label: "Today's Work",       icon: 'today-outline',          sprint1: false },
        { label: 'Material Requests',  icon: 'cart-outline',           sprint1: false },
        { label: 'Casual Labour',      icon: 'people-outline',         sprint1: false },
        { label: 'Vehicle Fuel',       icon: 'car-outline',            sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',           sprint1: true  },
      ];
    case 'operations':
      return [
        { label: 'Material Reviews',   icon: 'checkmark-circle-outline', sprint1: false },
        { label: 'Labour Reviews',     icon: 'people-circle-outline',    sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',             sprint1: true  },
      ];
    case 'logistics':
    case 'logistics-officer':
      return [
        { label: 'Deliveries',         icon: 'cube-outline',           sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',           sprint1: true  },
      ];
    case 'harvesting-leader':
      return [
        { label: 'Harvest Log',        icon: 'leaf-outline',           sprint1: false },
        { label: 'Log Transport',      icon: 'trail-sign-outline',     sprint1: false },
        { label: 'Material Requests',  icon: 'cart-outline',           sprint1: false },
        { label: 'Casual Labour',      icon: 'people-outline',         sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',           sprint1: true  },
      ];
    case 'sawmill-leader':
      return [
        { label: 'Sawmill Log',        icon: 'construct-outline',      sprint1: false },
        { label: 'Material Requests',  icon: 'cart-outline',           sprint1: false },
        { label: 'Casual Labour',      icon: 'people-outline',         sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',           sprint1: true  },
      ];
    case 'poles-leader':
      return [
        { label: 'Poles Purchase',     icon: 'pricetag-outline',       sprint1: false },
        { label: 'Poles Delivery',     icon: 'cube-outline',           sprint1: false },
        { label: 'Quality Check',      icon: 'shield-checkmark-outline', sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',           sprint1: true  },
      ];
    case 'mechanician':
      return [
        { label: 'Machine Logs',       icon: 'settings-outline',       sprint1: false },
        { label: 'Machine Fuel',       icon: 'flash-outline',          sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',           sprint1: true  },
      ];
    case 'storekeeper':
    case 'storekeeper-assistant':
      return [
        { label: 'Material Review',    icon: 'checkmark-circle-outline', sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',             sprint1: true  },
      ];
    case 'sales':
    case 'sales-staff':
      return [
        { label: 'Delivery Status',    icon: 'car-outline',            sprint1: false },
        { label: 'My Requests',        icon: 'list-outline',           sprint1: true  },
      ];
    default:
      return [
        { label: 'My Requests',        icon: 'list-outline',           sprint1: true  },
      ];
  }
}

// ─── Quick action card ────────────────────────────────────────────────────────

interface ActionCardProps {
  action:   QuickAction;
  onPress?: () => void;
}

function ActionCard({ action, onPress }: ActionCardProps) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, !action.sprint1 && styles.actionCardLocked]}
      onPress={action.sprint1 ? onPress : undefined}
      activeOpacity={action.sprint1 ? 0.75 : 1}
    >
      <View style={[styles.actionIconWrap, !action.sprint1 && styles.actionIconWrapLocked]}>
        <Ionicons
          name={action.sprint1 ? (action.icon as never) : 'lock-closed-outline'}
          size={24}
          color={action.sprint1 ? Colors.navy : Colors.textMuted}
        />
      </View>
      <Text style={[styles.actionLabel, !action.sprint1 && styles.actionLabelLocked]}>
        {action.label}
      </Text>
      {!action.sprint1 && (
        <Text style={styles.actionSprint2}>Sprint 2</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const { user, role } = useAuth();
  const isOfflineSession = useAuthStore((s) => s.isOfflineSession);
  const navigation = useNavigation<any>();

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const { data, isLoading, isRefetching, refetch } = useQuery<MyRequestsResponse>({
    queryKey: ['my-requests'],
    queryFn:  () => get<MyRequestsResponse>(EP.MY_REQUESTS),
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
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.navy}
          />
        }
      >
        {/* Offline banner */}
        {isOfflineSession && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning} />
            <Text style={styles.offlineBannerText}>
              Offline Mode — Data from last sync
            </Text>
          </View>
        )}

        {/* Hero / greeting card */}
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

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending Submissions</Text>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {actions.map((action) => (
            <ActionCard
              key={action.label}
              action={action}
              onPress={() => {
                // My Requests is the only Sprint 1 navigable screen for non-CEO roles
                // Navigation will be wired per-navigator in Sprint 2
              }}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  offlineBannerText: {
    fontSize: Typography.sm,
    color: Colors.warning,
    fontWeight: Typography.medium,
    flex: 1,
  },

  heroCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadow.md,
  },
  greeting: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textOnDark,
  },
  heroRole: {
    fontSize: Typography.sm,
    color: Colors.textOnDarkMuted,
    marginTop: Spacing.xxs,
    fontWeight: Typography.medium,
  },
  workshopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  workshopText: {
    fontSize: Typography.xs,
    color: Colors.textOnDarkMuted,
  },

  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    ...Shadow.sm,
  },
  statValue: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.navy,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xxs,
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionCard: {
    width: '47.5%',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  actionCardLocked: {
    opacity: 0.55,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconWrapLocked: {
    backgroundColor: Colors.divider,
  },
  actionLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  actionLabelLocked: {
    color: Colors.textMuted,
  },
  actionSprint2: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
});
