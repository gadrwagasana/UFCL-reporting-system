import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useMachineFuelList } from '../../hooks/useMachineFuel';
import { MachineFuelLog }     from '../../types/api';
import { MachineFuelStackParamList } from '../../navigation/types';
import { hasPermission } from '../../utils/permissions';
import { useAuthStore }   from '../../stores/authStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MachineFuelStackParamList, 'MachineFuelList'>;

// Fleet & Equipment Phase 2 parity fix — this screen previously had no
// inline search/filter at all (global search only). Reuses the same
// FilterChip pattern already established by Machines/Vehicles, filtering by
// fuel type (the closest real categorical field on this record).
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FuelCard({ entry, onPress }: { entry: MachineFuelLog; onPress: () => void }) {
  const targetName = entry.machine_name ?? entry.plate_number ?? '—';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.qty}>{entry.quantity} {entry.unit}</Text>
        <Text style={styles.date}>{entry.date_fmt}</Text>
      </View>
      <Text style={styles.target}>{targetName}</Text>
      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Ionicons name="water-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.metaText}>{entry.fuel_type}</Text>
        </View>
        {entry.operator && (
          <View style={styles.meta}>
            <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{entry.operator}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function MachineFuelListScreen() {
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const can  = (perm: Parameters<typeof hasPermission>[1]) => !!user && hasPermission(user.role, perm);
  const { data, isLoading, isError, refetch, isRefetching } = useMachineFuelList();
  const allLogs = data?.rows ?? [];
  const [search, setSearch] = useState('');
  const [fuelFilter, setFuelFilter] = useState('');
  const fuelTypes = useMemo(() => [...new Set(allLogs.map((l) => l.fuel_type))], [allLogs]);
  const isFiltered = !!search.trim() || !!fuelFilter;
  const logs = useMemo(() => {
    let out = allLogs;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((l) =>
        (l.machine_name ?? '').toLowerCase().includes(q) ||
        (l.plate_number ?? '').toLowerCase().includes(q) ||
        (l.operator ?? '').toLowerCase().includes(q) ||
        (l.notes ?? '').toLowerCase().includes(q));
    }
    if (fuelFilter) out = out.filter((l) => l.fuel_type === fuelFilter);
    return out;
  }, [allLogs, search, fuelFilter]);

  if (isLoading) return <LoadingState message="Loading fuel logs…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Machine Fuel"
        searchModule="fuel"
        dark
        actions={can('fuel.machine') ? [{ icon: 'add', onPress: () => navigation.navigate('MachineFuelCreate') }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load fuel logs" onRetry={refetch} fullScreen />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search machine, vehicle, operator, notes…" />
          {fuelTypes.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <FilterChip label="All" active={!fuelFilter} onPress={() => setFuelFilter('')} />
              {fuelTypes.map((f) => (
                <FilterChip key={f} label={f} active={fuelFilter === f} onPress={() => setFuelFilter(f)} />
              ))}
              {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setFuelFilter(''); }} /> : null}
            </ScrollView>
          ) : null}
          <FlatList
            data={logs}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={logs.length === 0 ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
            ListEmptyComponent={
              <EmptyState
                icon="water-outline"
                title={isFiltered ? 'No matching fuel logs' : 'No fuel logs'}
                subtitle={isFiltered ? 'Try a different search or filter.' : 'No machine fuel logs found.'}
              />
            }
            renderItem={({ item }) => (
              <FuelCard entry={item} onPress={() => navigation.navigate('MachineFuelDetail', { entry: item })} />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  chipRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:     { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  card:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qty:     { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.navy },
  date:    { fontSize: Typography.xs, color: Colors.textMuted },
  target:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', gap: Spacing.base },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },
});
