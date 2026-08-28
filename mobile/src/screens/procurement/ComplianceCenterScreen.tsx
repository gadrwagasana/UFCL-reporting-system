import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { SearchSkeleton } from '../../components/SearchSkeleton';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useSrmComplianceRegister } from '../../hooks/useSrm';
import { ProcurementStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'ComplianceCenter'>;

type StatusFilter = '' | 'active' | 'expiring' | 'expired' | 'missing' | 'waived';
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'missing', label: 'Missing' },
  { value: 'waived', label: 'Waived' },
];

const COMPLIANCE_STATUS_COLOR: Record<string, string> = {
  active: Colors.success, expiring: Colors.warning, expired: Colors.error, missing: Colors.textMuted, waived: Colors.navy,
};

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ComplianceCenterScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useSrmComplianceRegister();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const allRows = data?.rows ?? [];
  const isFiltered = !!search.trim() || !!statusFilter;
  const rows = useMemo(() => {
    let out = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) => r.supplier_name.toLowerCase().includes(q) || r.compliance_type.toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((r) => r.status === statusFilter);
    return out;
  }, [allRows, search, statusFilter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Compliance Center" dark onBack={() => navigation.goBack()} />
      {isError ? (
        <ErrorState message="Could not load compliance data" onRetry={refetch} fullScreen />
      ) : isLoading && !data ? (
        <SearchSkeleton rows={6} />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search supplier, compliance type…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_CHIPS.map((s) => (
              <FilterChip key={s.value || 'all'} label={s.label} active={statusFilter === s.value} onPress={() => setStatusFilter(s.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          <FlatList
            data={rows}
            keyExtractor={(item, i) => `${item.supplier_id}-${item.compliance_type}-${i}`}
            contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title="No compliance records" subtitle="Nothing matches these filters." />}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SupplierDetail', { supplierId: item.supplier_id })}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.supplier_name}</Text>
                  <View style={[styles.pill, { backgroundColor: (COMPLIANCE_STATUS_COLOR[item.status] ?? Colors.textMuted) + '22' }]}>
                    <Text style={[styles.pillText, { color: COMPLIANCE_STATUS_COLOR[item.status] ?? Colors.textMuted }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{item.compliance_type}{item.expiry_date ? ` · Expires ${item.expiry_date}` : ''}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, justifyContent: 'space-between' },
  cardName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  cardMeta: { fontSize: Typography.sm, color: Colors.textSecondary },
  pill: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  pillText: { fontSize: Typography.xs, fontWeight: Typography.semibold, textTransform: 'capitalize' },
});
