import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, Switch, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { useAdminUsers, useUpdateUser } from '../../hooks/useAdmin';
import { AdminStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Route = AdminStackScreenProps<'UserPermissions'>['route'];

// Same grouping as renderPermissionCheckboxes() in renderer/app.js
const PERM_GROUPS: { label: string; items: { id: string; label: string }[] }[] = [
  { label: 'Overview',        items: [{ id: 'dashboard', label: 'Dashboard' }, { id: 'ceo', label: 'CEO Overview' }] },
  { label: 'Production',      items: [
    { id: 'daily-harvest',     label: 'Daily Harvest' },
    { id: 'daily-timber',      label: 'Daily Timber' },
    { id: 'daily-poles',       label: 'Daily Poles' },
    { id: 'value-added-timber',label: 'Value-Added Timber' },
    { id: 'machine-logs',      label: 'Machine Logs' },
  ]},
  { label: 'Forestry',        items: [
    { id: 'timber-inventory',  label: 'Timber Inventory' },
    { id: 'compartments',      label: 'Compartments' },
    { id: 'log-transport',     label: 'Log Transport' },
  ]},
  { label: 'Labour',          items: [
    { id: 'casual-requests',   label: 'Casual Requests' },
    { id: 'casuals',           label: 'Casuals' },
  ]},
  { label: 'Workshop & Stock', items: [
    { id: 'workshop-overview',  label: 'Workshop Overview' },
    { id: 'warehouses',         label: 'Warehouses' },
    { id: 'stock-items',        label: 'Stock Items' },
    { id: 'inventory',          label: 'Inventory' },
    { id: 'stock-movements',    label: 'Stock Movements' },
    { id: 'stock-transfers',    label: 'Stock Transfers' },
    { id: 'material-requests',  label: 'Material Requests' },
  ]},
  { label: 'Fleet & Machines', items: [
    { id: 'machines',     label: 'Machines' },
    { id: 'machine-fuel', label: 'Machine Fuel' },
    { id: 'machine-kpi',  label: 'Machine KPI' },
    { id: 'vehicles',     label: 'Vehicles' },
  ]},
  { label: 'Logistics',        items: [
    { id: 'logistics-dashboard', label: 'Logistics Dashboard' },
    { id: 'deliveries',          label: 'Deliveries' },
    { id: 'dispatch',            label: 'Dispatch' },
    { id: 'transport',           label: 'Transport' },
    { id: 'transport-jobs',      label: 'Transport Jobs' },
  ]},
  { label: 'Commercial',       items: [
    { id: 'sales',     label: 'Sales' },
    { id: 'products',  label: 'Products' },
    { id: 'logistics', label: 'Logistics' },
  ]},
  { label: 'Reports',          items: [
    { id: 'weekly-cost',  label: 'Weekly Cost' },
    { id: 'weekly-perf',  label: 'Weekly Performance' },
    { id: 'monthly',      label: 'Monthly Dashboard' },
    { id: 'kpi',          label: 'KPI Scorecard' },
    { id: 'sage',         label: 'Sage Reconciliation' },
  ]},
  { label: 'System',           items: [
    { id: 'users',         label: 'Users' },
    { id: 'changes',       label: 'Changes' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'audit',         label: 'Audit' },
    { id: 'export',        label: 'Export' },
  ]},
];

export function UserPermissionsScreen() {
  const navigation = useNavigation();
  const route      = useRoute<Route>();
  const { userId, userName } = route.params;

  const { data, isLoading } = useAdminUsers();
  const updateUser = useUpdateUser();

  const user = data?.rows.find((r) => r.id === userId);

  const [perms,           setPerms]           = useState<Set<string>>(new Set());
  const [responsibilities,setResponsibilities] = useState('');
  const [expanded,        setExpanded]         = useState<Set<string>>(new Set(['Overview']));
  const [saving,          setSaving]           = useState(false);

  useEffect(() => {
    if (user) {
      setPerms(new Set(user.user_permissions ?? []));
      setResponsibilities((user.user_responsibilities ?? []).join('\n'));
    }
  }, [user]);

  function toggle(id: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  function toggleGroup(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else                 next.add(label);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const resp = (responsibilities ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
      const res = await updateUser.mutateAsync({
        userId,
        permissions:     Array.from(perms),
        responsibilities: resp,
      });
      if (res.ok) navigation.goBack();
      else        Alert.alert('Error', res.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading permissions…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={`Permissions — ${userName}`} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* User info card */}
        {user && (
          <View style={styles.infoCard}>
            <Text style={styles.infoName}>{user.name}</Text>
            <Text style={styles.infoSub}>@{user.username} · {user.role}</Text>
            <Text style={styles.infoNote}>
              Custom permissions override the default role permissions.
              {perms.size === 0 ? ' Currently using role defaults.' : ` ${perms.size} custom page(s) set.`}
            </Text>
          </View>
        )}

        {/* Permission groups */}
        {PERM_GROUPS.map((group) => {
          const open = expanded.has(group.label);
          const groupCount = group.items.filter((i) => perms.has(i.id)).length;
          return (
            <View key={group.label} style={styles.group}>
              <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(group.label)}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.groupRight}>
                  {groupCount > 0 && (
                    <View style={styles.groupBadge}>
                      <Text style={styles.groupBadgeText}>{groupCount}</Text>
                    </View>
                  )}
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
              {open && group.items.map((item) => (
                <View key={item.id} style={styles.permRow}>
                  <Text style={styles.permLabel}>{item.label}</Text>
                  <Switch
                    value={perms.has(item.id)}
                    onValueChange={() => toggle(item.id)}
                    trackColor={{ true: Colors.navy }}
                    thumbColor={Colors.white}
                  />
                </View>
              ))}
            </View>
          );
        })}

        {/* Responsibilities */}
        <View style={styles.respSection}>
          <Text style={styles.respLabel}>Custom Responsibilities (one per line)</Text>
          <TextInput
            style={styles.respInput}
            value={responsibilities}
            onChangeText={setResponsibilities}
            multiline
            numberOfLines={4}
            placeholder="e.g. Manage stock inventory&#10;Approve transfers"
            placeholderTextColor={Colors.textMuted}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Sticky Save */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>Save Permissions</Text>
          }
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.md, paddingBottom: 100 },

  infoCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  infoName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  infoSub:  { fontSize: Typography.sm, color: Colors.textMuted },
  infoNote: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: Spacing.xs },

  group: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.sm, overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.base,
  },
  groupLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  groupRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  groupBadge: {
    backgroundColor: Colors.navy, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  groupBadgeText: { color: Colors.white, fontSize: Typography.xs, fontWeight: Typography.bold },

  permRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  permLabel: { fontSize: Typography.sm, color: Colors.textPrimary },

  respSection: { gap: Spacing.xs },
  respLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  respInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: Typography.sm, color: Colors.textPrimary,
    backgroundColor: Colors.card, minHeight: 100,
  },

  footer:  { backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.base },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
});
