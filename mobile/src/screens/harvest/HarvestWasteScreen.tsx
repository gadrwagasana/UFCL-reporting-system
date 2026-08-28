import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { FormInput } from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { useHarvestList } from '../../hooks/useHarvest';
import { useHarvestWasteList, useHarvestWasteCategories, useHarvestWasteCreate, useResolutionCreate } from '../../hooks/useTimberLifecycle';
import type { ResolutionDestination } from '../../types/api';
import { HarvestStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<HarvestStackParamList, 'HarvestWaste'>;

const DESTINATIONS: ResolutionDestination[] = ['Firewood', 'Scrap Sale', 'Internal Use', 'Disposal', 'Other'];

// Enterprise Timber Lifecycle Integration Program — Phase 1 (Workstream 1 &
// 2). Harvest Waste as its own explicit transaction, plus the shared
// Resolution Engine — same two concepts as the desktop implementation,
// leaner UI (single screen, no attachments picker on mobile this phase —
// see the completion report for that scope note).
export function HarvestWasteScreen() {
  const navigation = useNavigation<NavProp>();
  const { data: harvestData } = useHarvestList();
  const { data: wasteData, isLoading, isError, refetch, isRefetching } = useHarvestWasteList();
  const { data: catsData } = useHarvestWasteCategories();
  const { createWaste } = useHarvestWasteCreate();
  const { resolve } = useResolutionCreate();

  const [showForm, setShowForm] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [volume, setVolume] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const batchOptions = (harvestData?.rows ?? []).slice(0, 50).map(r => ({
    label: `${r.species} — ${r.harvest_date} (${r.logs_handrolled ?? 0} logs)`,
    value: r.id,
  }));
  const catOptions = (catsData?.rows ?? []).map(c => ({ label: c.name, value: c.id }));

  async function handleSubmit() {
    if (!batchId) { Alert.alert('Required', 'Select a harvest batch.'); return; }
    if (!(Number(volume) > 0)) { Alert.alert('Required', 'Volume must be greater than zero.'); return; }
    if (!supervisor.trim()) { Alert.alert('Required', 'Supervisor is required.'); return; }
    if (!reason.trim()) { Alert.alert('Required', 'Reason is required.'); return; }
    setSubmitting(true);
    try {
      const r = await createWaste({
        harvest_log_id: Number(batchId), category_id: categoryId ? Number(categoryId) : undefined,
        volume_logs: Number(volume), supervisor: supervisor.trim(), reason: reason.trim(),
      });
      Alert.alert('Recorded', `Waste recorded (${r.percentage}% of batch).`);
      setShowForm(false);
      setBatchId(''); setCategoryId(''); setVolume(''); setSupervisor(''); setReason('');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to record waste.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResolve(id: number, maxVolume: number) {
    Alert.alert(
      'Resolve Waste',
      `Choose a destination for up to ${maxVolume} units.`,
      [
        ...DESTINATIONS.map(dest => ({
          text: dest,
          onPress: async () => {
            try {
              // Firewood/Scrap Sale/Internal Use need a warehouse — mobile
              // keeps this simple (Disposal/Other need none); a fuller
              // warehouse picker is a desktop-first affordance for now.
              if (['Firewood', 'Scrap Sale', 'Internal Use'].includes(dest)) {
                Alert.alert('Use Desktop', 'Resolving to a stock-recoverable destination (Firewood/Scrap Sale/Internal Use) requires picking a warehouse — please use the desktop app for this resolution. Disposal/Other can be resolved here.');
                return;
              }
              await resolve({ source_type: 'harvest_waste', source_id: id, destination: dest, volume: maxVolume });
              Alert.alert('Resolved', `Resolved to ${dest}.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to resolve.');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  if (isLoading) return <LoadingState message="Loading harvest waste…" fullScreen />;
  if (isError)   return <ErrorState message="Could not load harvest waste" onRetry={refetch} fullScreen />;

  const rows = wasteData?.rows ?? [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Harvest Waste"
        subtitle="Track waste against harvest batches and resolve outcomes"
        dark
        onBack={() => navigation.goBack()}
        actions={[{ icon: showForm ? 'close' : 'add', onPress: () => setShowForm(v => !v) }]}
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={showForm ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Record Harvest Waste</Text>
            <FormSelect label="Harvest Batch" options={batchOptions} value={batchId} onChange={v => setBatchId(String(v))} required />
            <FormSelect label="Category" options={catOptions} value={categoryId} onChange={v => setCategoryId(String(v))} placeholder="Optional" />
            <FormInput label="Volume (logs)" value={volume} onChangeText={setVolume} keyboardType="numeric" required />
            <FormInput label="Supervisor" value={supervisor} onChangeText={setSupervisor} required />
            <FormInput label="Reason" value={reason} onChangeText={setReason} multiline numberOfLines={2} required />
            <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
              <Text style={s.submitText}>{submitting ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        ListEmptyComponent={
          <EmptyState icon="trash-outline" title="No harvest waste recorded" subtitle="Tap + to record waste against a harvest batch." />
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.cardTitle}>{item.species} — {item.harvest_date}</Text>
              {item.resolution_id
                ? <View style={s.badgeGreen}><Text style={s.badgeGreenText}>Resolved</Text></View>
                : <View style={s.badgeAmber}><Text style={s.badgeAmberText}>Unresolved</Text></View>}
            </View>
            <Text style={s.rowText}>{item.volume_logs} logs ({item.percentage}%) — {item.category ?? 'Uncategorized'}</Text>
            <Text style={s.rowMeta}>Supervisor: {item.supervisor}</Text>
            <Text style={s.rowMeta}>{item.reason}</Text>
            {!item.resolution_id && (
              <TouchableOpacity style={s.resolveBtn} onPress={() => handleResolve(item.id, item.volume_logs)}>
                <Text style={s.resolveBtnText}>Resolve</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: 6, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  rowText: { fontSize: Typography.sm, color: Colors.textPrimary },
  rowMeta: { fontSize: Typography.xs, color: Colors.textMuted },

  badgeGreen: { backgroundColor: Colors.successBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeGreenText: { fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.medium },
  badgeAmber: { backgroundColor: Colors.warningBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeAmberText: { fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.medium },

  resolveBtn: { alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: Colors.navy, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  resolveBtnText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },

  submitBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
