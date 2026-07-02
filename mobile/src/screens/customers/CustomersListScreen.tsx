import React from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
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
import { useCustomerList } from '../../hooks/useCustomers';
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

function CustomerCard({ customer, onPress }: { customer: Customer; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{customer.name}</Text>
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
  );
}

export function CustomersListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useCustomerList();

  const rows   = data?.rows ?? [];
  const total  = rows.length;
  const active = rows.filter((r) => r.active).length;

  if (isLoading) return <LoadingState message="Loading customers…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Customers"
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
              onPress={() => navigation.navigate('CustomerForm', { customer: item })}
            />
          )}
        />
      )}
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
});
