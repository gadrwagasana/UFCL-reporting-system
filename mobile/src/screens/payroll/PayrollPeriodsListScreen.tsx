import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { StatusBadge }   from '../../components/StatusBadge';
import { usePayrollPeriods, usePayrollExportExcel } from '../../hooks/usePayroll';
import { PayrollPeriod } from '../../types/api';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CasualLabourStackParamList, 'PayrollPeriodsList'>;

const STATUS_OPTIONS = ['draft', 'calculating', 'pending_approval', 'approved', 'rejected', 'exported', 'closed'];
const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'start_date', label: 'Period' }, { key: 'status', label: 'Status' }, { key: 'total_net', label: 'Net' },
];

function PeriodCard({ item, onPress }: { item: PayrollPeriod; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.dateRange}>{item.start_date} → {item.end_date}</Text>
        <StatusBadge status={item.status} size="sm" />
      </View>
      <Text style={styles.workshop}>{item.workshop_name || 'Company-wide'}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{item.line_count} line(s)</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>Net {Number(item.total_net).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Priority 2/3/4/5 (mobile parity) — search/filter/sort are the same
// server-side params the desktop Periods list uses (payrollPeriodList),
// just surfaced through a lighter mobile-appropriate control set (chips +
// a cycling sort button instead of dropdowns). Excel export reuses the
// same backend export function via usePayrollExportExcel.
export function PayrollPeriodsListScreen() {
  const navigation = useNavigation<NavProp>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState('start_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const { data, isLoading, isError, refetch, isRefetching } = usePayrollPeriods({ search: search || undefined, status, sortBy, sortDir });
  const { exportExcel } = usePayrollExportExcel();

  async function handleExport() {
    setExporting(true);
    try {
      await exportExcel('periods', { search: search || undefined, status, sort_by: sortBy, sort_dir: sortDir });
    } catch {
      // downloadFile/Sharing failures are silent-safe here — no partial
      // file is left behind for the user to be confused by.
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading payroll periods…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Payroll"
        dark
        onBack={() => navigation.goBack()}
        actions={[{
          icon: exporting ? 'hourglass-outline' : 'share-outline',
          label: 'Export Excel',
          onPress: exporting ? () => {} : handleExport,
        }]}
      />

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search workshop or notes…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {exporting && <ActivityIndicator size="small" color={Colors.navy} />}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        <TouchableOpacity style={[styles.chip, !status && styles.chipActive]} onPress={() => setStatus(undefined)}>
          <Text style={[styles.chipText, !status && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {STATUS_OPTIONS.map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.chipDivider} />
        {SORT_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, sortBy === o.key && styles.chipActive]}
            onPress={() => {
              if (sortBy === o.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
              else { setSortBy(o.key); setSortDir('desc'); }
            }}
          >
            <Text style={[styles.chipText, sortBy === o.key && styles.chipTextActive]}>
              {o.label} {sortBy === o.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isError ? (
        <ErrorState message="Could not load payroll periods" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows ?? []).length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState icon="cash-outline" title="No payroll periods" subtitle={search || status ? 'No periods match your search/filter.' : 'Payroll periods are created on desktop.'} />
          }
          renderItem={({ item }) => (
            <PeriodCard item={item} onPress={() => navigation.navigate('PayrollPeriodDetail', { periodId: item.id })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.card, marginHorizontal: Spacing.base, marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm, borderRadius: Radius.md, ...Shadow.sm,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.sm, fontSize: Typography.sm, color: Colors.textPrimary },

  chipRow: { marginTop: Spacing.sm, maxHeight: 40 },
  chipRowContent: { paddingHorizontal: Spacing.base, gap: Spacing.xs, alignItems: 'center' },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: Typography.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: Colors.white, fontWeight: Typography.medium },
  chipDivider: { width: 1, height: 20, backgroundColor: Colors.border, marginHorizontal: 4 },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateRange: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  workshop: { fontSize: Typography.sm, color: Colors.textSecondary },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },
  metaDot: { fontSize: Typography.xs, color: Colors.textMuted },
});
