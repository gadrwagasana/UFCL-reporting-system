import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Layout, Radius } from '../theme';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import type { ComponentProps } from 'react';
import type { SearchModule } from '../types/api';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ERP Enterprise Completion Phase 4 — client-side visibility hint only,
// mirroring db/services/data.js's LEADER_APPROVERS ∪ MANAGER_APPROVERS
// exactly (the union of both — the screen itself, like desktop's
// insertPendingPanel/insertDeletionPanel, further narrows what each tier
// actually sees/can act on via the backend's own response). The backend
// (pendingEditsList/deletionRequestsList/processApprovalDecision) remains
// the sole authority — this only decides whether to show the icon.
const GOVERNANCE_APPROVER_ROLES = [
  'supervisor', 'harvesting-leader', 'sawmill-leader', 'logistics-leader',
  'poles-leader', 'vat-leader', 'admin', 'ceo', 'operations', 'logistics', 'sales',
];

interface Action {
  icon:      IoniconName;
  onPress:   () => void;
  badge?:    number;
  // Renders the icon inside a solid colour pill instead of a plain tinted
  // glyph. Plain re-tinting isn't reliable here: this header defaults to a
  // navy background, and orange-on-navy only measures ~2.2:1 contrast (worse
  // than the ~11:1 the other white icons get) — a filled pill keeps the icon
  // itself high-contrast (white-on-orange ≈ 5.1:1) while still reading as a
  // distinct, differently-coloured control against either header colour.
  highlight?: boolean;
  // Stabilization Phase 6 — optional, since dozens of existing call sites
  // predate this prop. Falls back to a humanized version of the icon name
  // rather than leaving the button with no accessible name at all.
  label?: string;
}

// e.g. 'create-outline' -> 'Create', 'archive-outline' -> 'Archive'
function humanizeIconName(icon: string): string {
  const base = icon.replace(/-outline$|-sharp$/, '').replace(/-/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

interface Props {
  title:       string;
  subtitle?:   string;
  onBack?:     () => void;
  actions?:    Action[];
  dark?:       boolean;
  // Every screen gets a Global Search action by default (appended after any
  // screen-specific actions) — set true only on GlobalSearchScreen itself.
  hideSearch?: boolean;
  // Identifies this screen's module so Search opens pre-scoped to it ("Context
  // Search" — e.g. "Search Sales Orders…") instead of landing on "Everywhere".
  // Only set on a module's own list/home screen — leave unset on detail/form
  // screens, which have no natural search context of their own.
  searchModule?: SearchModule;
  // ERP Enterprise Completion Phase 3 (Workstream 11) — every screen gets a
  // Notifications bell by default (same opt-out convention as hideSearch),
  // registered once here rather than per-screen. Before this, the only way
  // to reach Notifications on mobile was a tab that existed exclusively in
  // CeoNavigator — every other role had no reachable path to it at all.
  // Set true only on NotificationsScreen itself.
  hideNotifications?: boolean;
  // ERP Enterprise Completion Phase 4 — shown only to LEADER_APPROVERS/
  // MANAGER_APPROVERS-tier roles (unlike Search/Notifications, this is not
  // relevant to every role, so it is opt-in-by-role rather than opt-out-by-
  // screen). Set true only on GovernanceScreen itself.
  hideGovernance?: boolean;
}

export function AppHeader({ title, subtitle, onBack, actions = [], dark = true, hideSearch = false, searchModule, hideNotifications = false, hideGovernance = false }: Props) {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { role }   = useAuth();
  const topPad     = Platform.OS === 'android' ? insets.top + Spacing.sm : insets.top;
  const fgColor    = dark ? Colors.textOnDark : Colors.textPrimary;
  const bg         = dark ? Colors.navy : Colors.white;

  // Rules-of-Hooks: called unconditionally; `enabled:false` on the one screen
  // (NotificationsScreen) that already fetches this itself with its own filters.
  const { data: notifData } = useNotifications({ enabled: !hideNotifications });
  const unreadCount = notifData?.unread ?? 0;

  const showGovernance = !hideGovernance && !!role && GOVERNANCE_APPROVER_ROLES.includes(role);

  let allActions = actions;
  if (!hideNotifications) {
    allActions = [...allActions, {
      icon: 'notifications-outline' as IoniconName,
      onPress: () => navigation.navigate('Notifications'),
      badge: unreadCount,
      label: 'Notifications',
    }];
  }
  if (showGovernance) {
    allActions = [...allActions, {
      icon: 'checkmark-done-outline' as IoniconName,
      onPress: () => navigation.navigate('Governance'),
      label: 'Pending Approvals',
    }];
  }
  if (!hideSearch) {
    allActions = [...allActions, {
      icon: 'search' as IoniconName,
      onPress: () => navigation.navigate('GlobalSearch', { contextModule: searchModule }),
      highlight: true,
    }];
  }

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: topPad }]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backBtn} onPress={onBack} activeOpacity={0.7}
            accessibilityRole="button" accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={Layout.iconSize.lg} color={fgColor} />
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}

        <View style={styles.center}>
          <Text style={[styles.title, { color: fgColor }]} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: dark ? Colors.textOnDarkMuted : Colors.textMuted }]}
              numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          {allActions.map((a, i) => (
            <TouchableOpacity
              key={i} style={styles.actionBtn} onPress={a.onPress} activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={a.label ?? humanizeIconName(a.icon)}
            >
              {a.highlight ? (
                <View style={styles.highlightPill}>
                  <Ionicons name={a.icon} size={Layout.iconSize.md} color={Colors.white} />
                </View>
              ) : (
                <Ionicons name={a.icon} size={Layout.iconSize.lg} color={fgColor} />
              )}
              {a.badge != null && a.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{a.badge > 99 ? '99+' : a.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  row: {
    height: Layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  subtitle: {
    fontSize: Typography.xs,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightPill: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.orange,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: Typography.bold,
  },
});
