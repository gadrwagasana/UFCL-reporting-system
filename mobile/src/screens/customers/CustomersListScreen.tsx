import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { ReasonModal }  from '../../components/ReasonModal';
import { useCustomerList, useCustomerToggle } from '../../hooks/useCustomers';
import { useOfflineStore } from '../../stores/offlineStore';
import { Customer } from '../../types/api';
import { CustomersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CustomersStackParamList, 'CustomersList'>;

function MetricBanner({ total, active }: { total: number; active: number }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{total}</Text>
        <Text style={styles.bannerLabel}>Total</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{active}</Text>
        <Text style={styles.bannerLabel}>Active</Text>
      </View>
    </View>
  );
}

function CustomerCard({
  customer, onPress, onToggle,
}: {
  customer: Customer;
  onPress:  () => void;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.card, !customer.active && styles.cardInactive]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>{customer.name}</Text>
          {!customer.active && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactive</Text></View>}
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
        {customer.contact_person ? (
          <Text style={styles.cardContact} numberOfLines={1}>
            <Ionicons name="person-outline" size={12} color={Colors.textMuted} /> {customer.contact_person}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          {customer.phone ? (
            <Text style={styles.cardMetaItem}>
              <Ionicons name="call-outline" size={11} color={Colors.textMuted} /> {customer.phone}
            </Text>
          ) : null}
          {customer.email ? (
            <Text style={styles.cardMetaItem} numberOfLines={1}>
              <Ionicons name="mail-outline" size={11} color={Colors.textMuted} /> {customer.email}
            </Text>
          ) : null}
        </View>
        {customer.tin ? (
          <Text style={styles.cardTin}>TIN: {customer.tin}</Text>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, customer.active ? styles.actionBtnDeactivate : styles.actionBtnActivate]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Ionicons
          name={customer.active ? 'close-circle-outline' : 'checkmark-circle-outline'}
          size={14}
          color={customer.active ? Colors.warning : Colors.success}
        />
        <Text style={[styles.actionBtnText, { color: customer.active ? Colors.warning : Colors.success }]}>
          {customer.active ? 'Deactivate' : 'Reactivate'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function CustomersListScreen() {
  const navigation = useNavigation<NavProp>();
  const { isOnline } = useOfflineStore();
  const { data, isLoading, isError, refetch, isRefetching } = useCustomerList();
  const { toggleCustomer } = useCustomerToggle();

  const rows   = data?.rows ?? [];
  const total  = rows.length;
  const active = rows.filter((r) => r.active).length;

  // Sales Enterprise Phase 1 — customers.active existed but had no write
  // path on either platform (same pattern as ProductsListScreen's own
  // toggle, ReasonModal instead of Alert.prompt per the app-wide standard).
  const [toggleTarget, setToggleTarget] = useState<Customer | null>(null);
  const [toggling, setToggling] = useState(false);

  function handleToggle(customer: Customer) {
    if (!isOnline) {
      Alert.alert('Online Required', 'Customer status changes require an active connection.');
      return;
    }
    setToggleTarget(customer);
  }

  async function submitToggle(reason: string) {
    if (!toggleTarget || !reason.trim()) return;
    setToggling(true);
    try {
      await toggleCustomer(toggleTarget.id, reason.trim());
      setToggleTarget(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update customer status.');
    } finally {
      setToggling(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading customers…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Customers"
        searchModule="customers"
        dark
        actions={[{
          icon: 'add',
          onPress: () => navigation.navigate('CustomerForm', { customer: undefined }),
        }]}
      />

      {isError ? (
        <ErrorState message="Could not load customers" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
          }
          ListHeaderComponent={total > 0 ? <MetricBanner total={total} active={active} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No customers yet"
              subtitle="Tap + to register the first customer."
            />
          }
          renderItem={({ item }) => (
            <CustomerCard
              customer={item}
              onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id, customerName: item.name })}
              onToggle={() => handleToggle(item)}
            />
          )}
        />
      )}

      <ReasonModal
        visible={!!toggleTarget}
        title={toggleTarget?.active ? 'Deactivate Customer' : 'Reactivate Customer'}
        message={toggleTarget ? `Enter a reason for ${toggleTarget.active ? 'deactivating' : 'reactivating'} ${toggleTarget.name}:` : ''}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Reactivate'}
        loading={toggling}
        onCancel={() => setToggleTarget(null)}
        onConfirm={submitToggle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  banner: {
    flexDirection: 'row',
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  bannerLabel:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: 4,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName:    { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  cardContact: { fontSize: Typography.sm, color: Colors.textSecondary },
  cardMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.base },
  cardMetaItem:{ fontSize: Typography.xs, color: Colors.textMuted, flex: 1 },
  cardTin:     { fontSize: Typography.xs, color: Colors.textMuted, fontFamily: 'monospace' },

  cardInactive: { opacity: 0.65 },
  inactiveBadge:     { backgroundColor: Colors.errorBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, marginRight: Spacing.xs },
  inactiveBadgeText: { fontSize: Typography.xs, color: Colors.error },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm, paddingVertical: 4, marginTop: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnText:       { fontSize: Typography.xs },
  actionBtnDeactivate: { borderColor: Colors.warningBg },
  actionBtnActivate:   { borderColor: Colors.successBg },
});
