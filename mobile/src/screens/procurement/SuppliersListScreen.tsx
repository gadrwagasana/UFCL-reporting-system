import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { SearchSkeleton } from '../../components/SearchSkeleton';
import { ListSearchBar } from '../../components/ListSearchBar';
import { StatusBadge } from '../../components/StatusBadge';
import { FormSelect } from '../../components/FormSelect';
import { useProcurementSuppliers } from '../../hooks/useProcurementSuppliers';
import { ProcurementStackParamList } from '../../navigation/types';
import type { ProcurementSupplier, ProcurementSupplierStatus } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type StatusFilter = '' | ProcurementSupplierStatus;
type SortKey = 'name' | 'category' | 'rating';
const SORT_LABEL: Record<SortKey, string> = { name: 'Name (A–Z)', category: 'Category (A–Z)', rating: 'Rating (High–Low)' };
const SORT_CYCLE: SortKey[] = ['name', 'category', 'rating'];
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'blacklisted', label: 'Blacklisted' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'archived', label: 'Archived' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'SuppliersList'>;

function SupplierCard({ supplier, onPress }: { supplier: ProcurementSupplier; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{supplier.name}</Text>
        {supplier.preferred ? <Ionicons name="star" size={14} color={Colors.orange} /> : null}
        <StatusBadge status={supplier.status ?? 'active'} size="sm" withIcon />
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
      {supplier.category ? <Text style={styles.cardMeta}>{supplier.category}</Text> : null}
      <View style={styles.cardMetaRow}>
        {supplier.phone ? <Text style={styles.cardMetaItem}><Ionicons name="call-outline" size={11} /> {supplier.phone}</Text> : null}
        {supplier.rating != null ? <Text style={styles.cardMetaItem}><Ionicons name="star-outline" size={11} /> {supplier.rating}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function SuppliersListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useProcurementSuppliers();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [category, setCategory] = useState<string | null>(null);
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [blacklistedOnly, setBlacklistedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const allRows = data?.rows ?? [];
  const categories = useMemo(() => Array.from(new Set(allRows.map((s) => s.category).filter(Boolean))).sort() as string[], [allRows]);
  const isFiltered = !!search.trim() || !!statusFilter || !!category || preferredOnly || blacklistedOnly;

  const rows = useMemo(() => {
    let out = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((s) => s.name.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((s) => (s.status ?? 'active') === statusFilter);
    if (category) out = out.filter((s) => s.category === category);
    if (preferredOnly) out = out.filter((s) => s.preferred);
    if (blacklistedOnly) out = out.filter((s) => s.blacklisted);
    out = out.slice().sort((a, b) => {
      if (sortBy === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
      const av = String(a[sortBy] ?? ''), bv = String(b[sortBy] ?? '');
      return av.localeCompare(bv);
    });
    return out;
  }, [allRows, search, statusFilter, category, preferredOnly, blacklistedOnly, sortBy]);

  function clearFilters() {
    setSearch(''); setStatusFilter(''); setCategory(null); setPreferredOnly(false); setBlacklistedOnly(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Suppliers"
        dark
        actions={[
          { icon: 'git-compare-outline', onPress: () => navigation.navigate('SupplierComparison', undefined) },
          { icon: 'add', onPress: () => navigation.navigate('SupplierForm', { supplier: undefined }) },
        ]}
      />
      {isError ? (
        <ErrorState message="Could not load suppliers" onRetry={refetch} fullScreen />
      ) : isLoading && !data ? (
        <SearchSkeleton rows={6} />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search name, category…" />
          {categories.length > 0 ? (
            <View style={styles.categoryRow}>
              <FormSelect
                label="Category"
                options={categories.map((c) => ({ label: c, value: c }))}
                value={category}
                onChange={(v) => setCategory(String(v))}
                placeholder="All categories"
              />
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_CHIPS.map((s) => (
              <FilterChip key={s.value || 'all'} label={s.label} active={statusFilter === s.value} onPress={() => setStatusFilter(s.value)} />
            ))}
            <View style={styles.chipDivider} />
            <FilterChip label="⭐ Preferred" active={preferredOnly} onPress={() => setPreferredOnly((v) => !v)} />
            <FilterChip label="🚫 Blacklisted only" active={blacklistedOnly} onPress={() => setBlacklistedOnly((v) => !v)} />
            <View style={styles.chipDivider} />
            <FilterChip
              label={`Sort: ${SORT_LABEL[sortBy]}`}
              active={false}
              onPress={() => setSortBy(SORT_CYCLE[(SORT_CYCLE.indexOf(sortBy) + 1) % SORT_CYCLE.length])}
            />
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={clearFilters} /> : null}
          </ScrollView>
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="business-outline"
                title={isFiltered ? 'No matching suppliers' : 'No suppliers yet'}
                subtitle={isFiltered ? 'Try different search or filter criteria.' : 'Tap + to register the first supplier.'}
              />
            }
            renderItem={({ item }) => (
              <SupplierCard supplier={item} onPress={() => navigation.navigate('SupplierDetail', { supplierId: item.id })} />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  categoryRow: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chipDivider: { width: 1, height: 20, backgroundColor: Colors.divider, marginHorizontal: 2 },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  cardMeta: { fontSize: Typography.sm, color: Colors.textSecondary },
  cardMetaRow: { flexDirection: 'row', gap: Spacing.base },
  cardMetaItem: { fontSize: Typography.xs, color: Colors.textMuted },
});
