import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, ScrollView, TouchableOpacity, Modal, Pressable, TextInput } from 'react-native';
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
import { DatePickerField } from '../../components/DatePickerField';
import { useSrmContractsRegister, useSrmActions } from '../../hooks/useSrm';
import { useAuth } from '../../hooks/useAuth';
import { showToast } from '../../stores/toastStore';
import { ProcurementStackParamList } from '../../navigation/types';
import type { ProcurementSupplierContract } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'ContractRegister'>;

const GOVERNANCE_ROLES = ['admin', 'ceo', 'procurement-manager'];

type StatusFilter = '' | 'draft' | 'active' | 'expiring' | 'expired' | 'renewed';
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'renewed', label: 'Renewed' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReasonModal({ visible, title, onClose, onConfirm }: { visible: boolean; title: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  React.useEffect(() => { if (visible) { setReason(''); setError(''); } }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>{title}</Text>
        <TextInput
          style={[sheetStyles.input, error ? sheetStyles.inputError : null]}
          value={reason} onChangeText={(v) => { setReason(v); if (error) setError(''); }}
          placeholder="Reason" placeholderTextColor={Colors.textMuted} multiline autoFocus
        />
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={() => { if (!reason.trim()) { setError('Reason is required.'); return; } onConfirm(reason.trim()); }}>
            <Text style={sheetStyles.saveText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function RenewModal({ visible, contract, onClose, onConfirm }: { visible: boolean; contract: ProcurementSupplierContract | null; onClose: () => void; onConfirm: (endDate: string) => void }) {
  const [endDate, setEndDate] = useState<string | null>(null);
  const [error, setError] = useState('');
  React.useEffect(() => { if (visible) { setEndDate(null); setError(''); } }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>Renew {contract?.contract_ref}</Text>
        <DatePickerField label="New End Date" value={endDate} onChange={setEndDate} required />
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={() => { if (!endDate) { setError('End date is required.'); return; } onConfirm(endDate); }}>
            <Text style={sheetStyles.saveText}>Renew</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function ContractRegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const { role } = useAuth();
  const canGovern = role ? GOVERNANCE_ROLES.includes(role) : false;
  const { data, isLoading, isError, refetch, isRefetching } = useSrmContractsRegister();
  const srm = useSrmActions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [approveTarget, setApproveTarget] = useState<ProcurementSupplierContract | null>(null);
  const [renewTarget, setRenewTarget] = useState<ProcurementSupplierContract | null>(null);

  const allRows = data?.rows ?? [];
  const isFiltered = !!search.trim() || !!statusFilter;
  const rows = useMemo(() => {
    let out = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((c) => c.contract_ref.toLowerCase().includes(q) || (c.supplier_name ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((c) => c.computedStatus === statusFilter);
    return out;
  }, [allRows, search, statusFilter]);

  async function onApprove(reason: string) {
    if (!approveTarget) return;
    try {
      await srm.approveContract(approveTarget.id, reason);
      showToast('Contract approved.');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? e?.message ?? 'Could not approve contract.', 'error');
    } finally {
      setApproveTarget(null);
    }
  }

  async function onRenew(endDate: string) {
    if (!renewTarget) return;
    try {
      await srm.renewContract(renewTarget.id, { end_date: endDate });
      showToast('Contract renewed.');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? e?.message ?? 'Could not renew contract.', 'error');
    } finally {
      setRenewTarget(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Contract Register" dark onBack={() => navigation.goBack()} />
      {isError ? (
        <ErrorState message="Could not load contracts" onRetry={refetch} fullScreen />
      ) : isLoading && !data ? (
        <SearchSkeleton rows={6} />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search contract ref, supplier…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_CHIPS.map((s) => (
              <FilterChip key={s.value || 'all'} label={s.label} active={statusFilter === s.value} onPress={() => setStatusFilter(s.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={<EmptyState icon="document-text-outline" title="No contracts" subtitle="Contracts are added from a supplier's Contracts tab." />}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.contract_ref}</Text>
                  <StatusBadge status={item.computedStatus ?? item.status} size="sm" withIcon />
                </View>
                <Text style={styles.cardMeta}>{item.supplier_name}{item.category ? ` · ${item.category}` : ''}</Text>
                {item.start_date || item.end_date ? <Text style={styles.cardMeta}>{item.start_date ?? '—'} to {item.end_date ?? '—'}</Text> : null}
                {item.contract_value != null ? <Text style={styles.cardMeta}>Value: {Number(item.contract_value).toLocaleString()}</Text> : null}
                <View style={styles.cardActions}>
                  {canGovern && item.status === 'draft' ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setApproveTarget(item)}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                      <Text style={[styles.actionBtnText, { color: Colors.success }]}>Approve</Text>
                    </TouchableOpacity>
                  ) : null}
                  {!['renewed', 'cancelled', 'draft'].includes(item.status) ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setRenewTarget(item)}>
                      <Ionicons name="refresh-outline" size={14} color={Colors.navy} />
                      <Text style={[styles.actionBtnText, { color: Colors.navy }]}>Renew</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}
          />
        </>
      )}
      <ReasonModal visible={!!approveTarget} title={`Approve ${approveTarget?.contract_ref ?? ''}`} onClose={() => setApproveTarget(null)} onConfirm={onApprove} />
      <RenewModal visible={!!renewTarget} contract={renewTarget} onClose={() => setRenewTarget(null)} onConfirm={onRenew} />
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
  cardActions: { flexDirection: 'row', gap: Spacing.base, marginTop: Spacing.xs },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: Typography.xs, fontWeight: Typography.medium },
});

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.base, ...Shadow.lg,
  },
  title: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.bg },
  inputError: { borderColor: Colors.error },
  error: { fontSize: Typography.xs, color: Colors.error, marginTop: 4 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText: { fontSize: Typography.base, color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  saveText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
