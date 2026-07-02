import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useAuthStore } from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import type { UserRole } from '../../types/auth';
import { AdminStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

interface HubCard {
  title:      string;
  subtitle:   string;
  icon:       string;
  color:      string;
  screen:     keyof AdminStackParamList;
  permission: 'admin.secgov' | 'admin.audit' | 'admin.users' | 'admin.roles' | 'admin.trash' | 'admin.changes' | 'automation.view';
}

const CARDS: HubCard[] = [
  {
    title:      'Security & Governance',
    subtitle:   'Failed logins, approvals, workflow health',
    icon:       'shield-checkmark',
    color:      Colors.error,
    screen:     'SecGov',
    permission: 'admin.secgov',
  },
  {
    title:      'Audit Trail',
    subtitle:   'Filterable log of all system actions',
    icon:       'document-text',
    color:      Colors.navy,
    screen:     'Audit',
    permission: 'admin.audit',
  },
  {
    title:      'Users',
    subtitle:   'Create, edit, reset passwords',
    icon:       'people',
    color:      Colors.success,
    screen:     'Users',
    permission: 'admin.users',
  },
  {
    title:      'Role Definitions',
    subtitle:   'Responsibilities and page permissions per role',
    icon:       'key',
    color:      Colors.warning,
    screen:     'Roles',
    permission: 'admin.roles',
  },
  {
    title:      'Trash',
    subtitle:   'Restore or permanently purge deleted records',
    icon:       'trash',
    color:      '#6B7280',
    screen:     'Trash',
    permission: 'admin.trash',
  },
  {
    title:      'Change Requests',
    subtitle:   'Submit and review record-change requests',
    icon:       'create',
    color:      Colors.orange,
    screen:     'Changes',
    permission: 'admin.changes',
  },
  {
    title:      'Automation Center',
    subtitle:   'Rules, escalations, jobs & history',
    icon:       'hardware-chip',
    color:      '#2563EB',
    screen:     'AutomationHome',
    permission: 'automation.view',
  },
];

export function AdminHomeScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore((s) => s.user?.role as UserRole | undefined);

  const visible = CARDS.filter((c) => !role || hasPermission(role, c.permission));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Administration" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>ADMINISTRATION HUB</Text>

        {visible.map((card) => (
          <TouchableOpacity
            key={card.screen}
            style={styles.card}
            onPress={() => navigation.navigate(card.screen as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: card.color + '1A' }]}>
              <Ionicons name={card.icon as never} size={28} color={card.color} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{card.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  scroll:       { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  sectionLabel: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.xs,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm,
  },
  iconBox: {
    width: 52, height: 52, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:  { flex: 1 },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardSub:   { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
});
