import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useTransportCompaniesList, useTransportCompanyDelete } from '../../hooks/useTransport';
import { TransportCompany } from '../../types/api';
import { TransportCarriersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Phase 1 Logistics fix — Transport Carriers had full CRUD on desktop but no
// mobile screen at all.
type NavProp = NativeStackNavigationProp<TransportCarriersStackParamList, 'TransportCarriersList'>;

type StatusFilter = '' | 'active' | 'inactive';
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CarrierCard({ company, onPress, onDelete }: { company: TransportCompany; onPress: () => void; onDelete: () => void }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.name}>{company.name}</Text>
        <View style={[s.badge, company.active ? s.badgeActive : s.badgeInactive]}>
          <Text style={[s.badgeText, company.active ? s.badgeTextActive : s.badgeTextInactive]}>
            {company.active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      {company.contact_person ? <Text style={s.meta}>👤 {company.contact_person}</Text> : null}
      {company.phone ? <Text style={s.meta}>📞 {company.phone}</Text> : null}
      <View style={s.metaRow}>
        <Text style={s.metaText}>{company.job_count} job{company.job_count === 1 ? '' : 's'}</Text>
        <Text style={s.metaText}>{company.total_cost.toLocaleString()} total cost</Text>
      </View>
      <TouchableOpacity style={s.deleteBtn} onPress={onDelete} hitSlop={8}>
        <Text style={s.deleteText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function TransportCarriersListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useTransportCompaniesList();
  const deleteMutation = useTransportCompanyDelete();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const allCompanies = data?.rows ?? [];
  const isFiltered = !!search.trim() || !!statusFilter;
  const companies = useMemo(() => {
    let out = allCompanies;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contact_person ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((c) => (statusFilter === 'active' ? c.active : !c.active));
    return out;
  }, [allCompanies, search, statusFilter]);

  if (isLoading) return <LoadingState message="Loading carriers…" fullScreen />;

  function handleDelete(company: TransportCompany) {
    Alert.alert('Delete carrier?', `Delete "${company.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const res = await deleteMutation.mutateAsync({ id: company.id });
            if (!res.ok) Alert.alert('Could not delete', (res as any).error ?? 'Unknown error');
          } catch {
            Alert.alert('Error', 'Could not delete carrier.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Transport Carriers"
        dark
        actions={[{ icon: 'add-outline', onPress: () => navigation.navigate('TransportCarrierForm', {}) }]}
      />
      {isError ? (
        <ErrorState message="Could not load transport carriers" onRetry={refetch} fullScreen />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search company, contact, phone…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {STATUS_CHIPS.map((c) => (
              <FilterChip key={c.value || 'all'} label={c.label} active={statusFilter === c.value} onPress={() => setStatusFilter(c.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          <FlatList
            data={companies}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={companies.length === 0 ? s.emptyContainer : s.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
            ListEmptyComponent={
              <EmptyState
                icon="business-outline"
                title={isFiltered ? 'No matching carriers' : 'No carriers'}
                subtitle={isFiltered ? 'Try different search or filter criteria.' : 'No transport carriers found. Tap + to add one.'}
              />
            }
            renderItem={({ item }) => (
              <CarrierCard
                company={item}
                onPress={() => navigation.navigate('TransportCarrierForm', { company: item })}
                onDelete={() => handleDelete(item)}
              />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  chipRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:     { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  meta: { fontSize: Typography.xs, color: Colors.textMuted },
  metaRow: { flexDirection: 'row', gap: Spacing.base, marginTop: 2 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeInactive: { backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: 11, fontWeight: Typography.semibold },
  badgeTextActive: { color: '#166534' },
  badgeTextInactive: { color: Colors.textMuted },

  deleteBtn: { alignSelf: 'flex-end', marginTop: 4 },
  deleteText: { fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.medium },
});
