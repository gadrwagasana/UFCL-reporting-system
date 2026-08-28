import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { AppHeader }       from '../../components/AppHeader';
import { FormInput }       from '../../components/FormInput';
import { DatePickerField } from '../../components/DatePickerField';
import { TimePickerField } from '../../components/TimePickerField';
import { useSawmillCreate, useSawmillUpdate, useSawmillList } from '../../hooks/useSawmill';
import { useOfflineStore }  from '../../stores/offlineStore';
import { EP }               from '../../api/endpoints';
import { MachinePendingApproval } from '../../types/api';
import { SawmillStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<SawmillStackParamList, 'SawmillProductionCreate'>;
type RoutePropT = RouteProp<SawmillStackParamList, 'SawmillProductionCreate'>;

// harvest_date-style DD/MM/YYYY -> ISO, same conversion used by
// HarvestCreateScreen/HarvestPlanFormScreen for the same reason.
function toIsoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return format(new Date(), 'yyyy-MM-dd');
  return `${y}-${m}-${d}`;
}

// Sawmill Timber Entry enhancement — a single log can yield multiple timber
// sizes, so sizes are captured as a dynamic list rather than one flat field.
interface SizeRow {
  key: string;
  widthMm: string;
  thicknessMm: string;
  lengthM: string;
  quantity: string;
}
let _sizeRowSeq = 0;
function newSizeRow(): SizeRow {
  return { key: `sz${++_sizeRowSeq}`, widthMm: '', thicknessMm: '', lengthM: '', quantity: '1' };
}
// Volume (m³) = (width mm ÷ 1000) × (thickness mm ÷ 1000) × length (m).
function sizeRowVolumeM3(r: SizeRow): number {
  const w = Number(r.widthMm) || 0, t = Number(r.thicknessMm) || 0, l = Number(r.lengthM) || 0, q = Number(r.quantity) || 0;
  return (w / 1000) * (t / 1000) * l * q;
}

export function SawmillProductionCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const entry      = route.params?.entry;
  const isEdit     = !!entry;

  const { createEntry }       = useSawmillCreate();
  const { updateEntry }       = useSawmillUpdate();
  const { data: listData }    = useSawmillList();
  const { isOnline, enqueue } = useOfflineStore();

  const [prodDate,       setProdDate]       = useState(entry ? toIsoDate(entry.date) : format(new Date(), 'yyyy-MM-dd'));
  const [supervisor,     setSupervisor]     = useState(entry?.supervisor ?? '');
  const [operators,      setOperators]      = useState(entry?.operators ?? '');
  const [machine,        setMachine]        = useState(entry?.machine ?? '');
  const [logDiameter,    setLogDiameter]    = useState(entry?.log_diameter_cm != null ? String(entry.log_diameter_cm) : '');
  const [startTime,      setStartTime]      = useState<string | null>(entry?.start_time ?? null);
  const [endTime,        setEndTime]        = useState<string | null>(entry?.end_time ?? null);
  const [kilnDried,      setKilnDried]      = useState(entry?.timber_kiln_dried ? String(entry.timber_kiln_dried) : '');
  const [ccaTreated,     setCcaTreated]     = useState(entry?.timber_cca_treated ? String(entry.timber_cca_treated) : '');
  const [untreated,      setUntreated]      = useState(entry?.timber_untreated ? String(entry.timber_untreated) : '');
  const [waste,          setWaste]          = useState(entry?.timber_waste ? String(entry.timber_waste) : '');
  const [polesUnits,     setPolesUnits]     = useState(entry?.poles_units ? String(entry.poles_units) : '');
  const [polesWaste,     setPolesWaste]     = useState(entry?.poles_waste ? String(entry.poles_waste) : '');
  const [logsReceived,   setLogsReceived]   = useState(entry?.logs_received ? String(entry.logs_received) : '');
  const [downtimeHours,  setDowntimeHours]  = useState(entry?.downtime_hours ? String(entry.downtime_hours) : '');
  const [downtimeReason, setDowntimeReason] = useState(entry?.downtime_reason ?? '');
  const [remarks,        setRemarks]        = useState(entry?.remarks ?? '');
  const [sizeRows,       setSizeRows]       = useState<SizeRow[]>(
    entry?.timberSizes?.length
      ? entry.timberSizes.map((s) => ({
          key: `sz${++_sizeRowSeq}`, widthMm: String(s.widthMm), thicknessMm: String(s.thicknessMm),
          lengthM: String(s.lengthM), quantity: String(s.quantity),
        }))
      : [newSizeRow()]
  );
  const [submitting,     setSubmitting]     = useState(false);

  const totalTimber =
    (Number(kilnDried) || 0) + (Number(ccaTreated) || 0) + (Number(untreated) || 0);

  const validSizeRows = sizeRows.filter((r) => Number(r.widthMm) > 0 && Number(r.thicknessMm) > 0 && Number(r.lengthM) > 0 && Number(r.quantity) > 0);
  const totalActualVolumeM3 = validSizeRows.reduce((s, r) => s + sizeRowVolumeM3(r), 0);
  const expectedVolumeM3 = (Number(logsReceived) || 0) / 3.4 * 0.5;

  function updateSizeRow(key: string, patch: Partial<SizeRow>) {
    setSizeRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeSizeRow(key: string) {
    setSizeRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  async function handleSubmit() {
    // Backend rule: machine required if timber is being produced
    if ((totalTimber > 0 || validSizeRows.length > 0) && !machine.trim()) {
      Alert.alert('Required', 'Machine is required when recording timber production.'); return;
    }

    const payload = {
      date: prodDate,    // API field is `date`, NOT `log_date`
      ...(supervisor.trim()    && { supervisor:          supervisor.trim() }),
      ...(operators.trim()     && { operators:           operators.trim() }),
      ...(machine.trim()       && { machine:             machine.trim() }),
      ...(kilnDried            && { timber_kiln_dried:   Number(kilnDried) }),
      ...(ccaTreated           && { timber_cca_treated:  Number(ccaTreated) }),
      ...(untreated            && { timber_untreated:    Number(untreated) }),
      ...(waste                && { timber_waste:        Number(waste) }),
      ...(polesUnits           && { poles_units:         Number(polesUnits) }),
      ...(polesWaste           && { poles_waste:         Number(polesWaste) }),
      ...(logsReceived         && { logs_received:       Number(logsReceived) }),
      ...(logDiameter          && { log_diameter_cm:     Number(logDiameter) }),
      ...(startTime            && { start_time:          startTime }),
      ...(endTime              && { end_time:            endTime }),
      ...(downtimeHours        && { downtime_hours:      Number(downtimeHours) }),
      ...(downtimeReason.trim() && { downtime_reason:   downtimeReason.trim() }),
      ...(remarks.trim()       && { remarks:             remarks.trim() }),
      ...(validSizeRows.length && {
        timber_sizes: validSizeRows.map((r) => ({
          width_mm: Number(r.widthMm), thickness_mm: Number(r.thicknessMm), length_m: Number(r.lengthM), quantity: Number(r.quantity),
        })),
      }),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        if (!isOnline) {
          Alert.alert('Online Required', 'Editing a production entry requires an active connection.');
          return;
        }
        const result = await updateEntry(entry!.id, payload);
        if ('pendingApproval' in result && (result as MachinePendingApproval).pendingApproval) {
          Alert.alert('Submitted for Review', (result as MachinePendingApproval).message);
          navigation.goBack();
          return;
        }
        const unmapped = (result as { unmappedSizes?: string[] }).unmappedSizes;
        if (unmapped?.length) {
          Alert.alert('Saved', `Not yet in Product Catalog (recorded, but not added to Finished Timber Inventory): ${unmapped.join(', ')}.`);
        }
        navigation.goBack();
        return;
      }
      if (!isOnline) {
        enqueue({ endpoint: EP.SAWMILL_CREATE, method: 'POST', body: payload, context: 'sawmill' });
        Alert.alert('Saved Offline', 'Production record will sync when connected.');
        navigation.goBack();
        return;
      }
      const result = await createEntry(payload);
      if (result.unmappedSizes?.length) {
        Alert.alert('Saved', `Actual volume: ${result.actualVolumeM3} m³ (expected: ${result.expectedVolumeM3} m³). Not yet in Product Catalog (recorded, but not added to Finished Timber Inventory): ${result.unmappedSizes.join(', ')}.`);
      } else if (result.actualVolumeM3 != null) {
        Alert.alert('Saved', `Actual volume: ${result.actualVolumeM3} m³ (expected: ${result.expectedVolumeM3} m³).`);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save production record.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title={isEdit ? 'Edit Production Entry' : 'Log Production'} dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Production Details</Text>

          <DatePickerField
            label="Production Date"
            value={prodDate}
            onChange={setProdDate}
            maxDate={new Date()}
          />

          <FormInput
            label="Supervisor"
            value={supervisor}
            onChangeText={setSupervisor}
            placeholder="Supervisor's name"
          />

          <FormInput
            label="Operators"
            value={operators}
            onChangeText={setOperators}
            placeholder="e.g. John Doe, Jane Smith"
          />

          <FormInput
            label="Machine Used"
            value={machine}
            onChangeText={setMachine}
            placeholder="e.g. Sawmill #1"
            hint={(totalTimber > 0 || validSizeRows.length > 0) ? 'Required when recording timber' : undefined}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <TimePickerField label="Start Time" value={startTime} onChange={setStartTime} />
            </View>
            <View style={styles.col}>
              <TimePickerField label="End Time" value={endTime} onChange={setEndTime} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Log Intake</Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Intake Logs"
                value={logsReceived}
                onChangeText={setLogsReceived}
                placeholder="0"
                keyboardType="numeric"
                hint="Logs received for processing"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Log Diameter (cm)"
                value={logDiameter}
                onChangeText={setLogDiameter}
                placeholder="e.g. 35"
                keyboardType="numeric"
              />
            </View>
          </View>

          {listData?.availableLogStock != null && (
            <Text style={styles.hintText}>
              Available inbound log stock: {listData.availableLogStock.toLocaleString()} logs (yard stock, not restricted to today's transport)
            </Text>
          )}

          {expectedVolumeM3 > 0 && (
            <View style={styles.totalChip}>
              <Text style={styles.totalText}>Expected Volume: {expectedVolumeM3.toFixed(2)} m³</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Timber Sizes Produced</Text>
          </View>
          <Text style={styles.sectionHint}>A single log can yield multiple sizes — add one row per size.</Text>

          {sizeRows.map((row, i) => (
            <View key={row.key} style={styles.sizeRow}>
              <View style={styles.sizeRowTop}>
                <Text style={styles.sizeRowLabel}>Size {i + 1}</Text>
                {sizeRows.length > 1 && (
                  <TouchableOpacity onPress={() => removeSizeRow(row.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.row}>
                <View style={styles.col}>
                  <FormInput label="Width (mm)" value={row.widthMm} onChangeText={(v) => updateSizeRow(row.key, { widthMm: v })} placeholder="e.g. 50" keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                  <FormInput label="Thickness (mm)" value={row.thicknessMm} onChangeText={(v) => updateSizeRow(row.key, { thicknessMm: v })} placeholder="e.g. 150" keyboardType="numeric" />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}>
                  <FormInput label="Length (m)" value={row.lengthM} onChangeText={(v) => updateSizeRow(row.key, { lengthM: v })} placeholder="e.g. 4" keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                  <FormInput label="Quantity" value={row.quantity} onChangeText={(v) => updateSizeRow(row.key, { quantity: v })} placeholder="1" keyboardType="numeric" />
                </View>
              </View>
              <Text style={styles.sizeRowVolume}>Volume: {sizeRowVolumeM3(row).toFixed(3)} m³</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.addSizeBtn} onPress={() => setSizeRows((rows) => [...rows, newSizeRow()])} activeOpacity={0.75}>
            <Ionicons name="add" size={16} color={Colors.navy} />
            <Text style={styles.addSizeText}>Add size</Text>
          </TouchableOpacity>

          {totalActualVolumeM3 > 0 && (
            <View style={[styles.totalChip, styles.totalChipGreen]}>
              <Text style={[styles.totalText, styles.totalTextGreen]}>Total Actual Volume: {totalActualVolumeM3.toFixed(3)} m³</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timber Produced (units)</Text>

          {totalTimber > 0 && (
            <View style={styles.totalChip}>
              <Text style={styles.totalText}>Total: {totalTimber} units</Text>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Kiln Dried"
                value={kilnDried}
                onChangeText={setKilnDried}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="CCA Treated"
                value={ccaTreated}
                onChangeText={setCcaTreated}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>

          <FormInput
            label="Untreated"
            value={untreated}
            onChangeText={setUntreated}
            placeholder="0"
            keyboardType="numeric"
          />

          <FormInput
            label="Waste"
            value={waste}
            onChangeText={setWaste}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Poles Produced (units)</Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Poles Units"
                value={polesUnits}
                onChangeText={setPolesUnits}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Poles Waste"
                value={polesWaste}
                onChangeText={setPolesWaste}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Downtime &amp; Notes</Text>

          <FormInput
            label="Downtime Duration (hrs)"
            value={downtimeHours}
            onChangeText={setDowntimeHours}
            placeholder="0"
            keyboardType="numeric"
          />

          {(Number(downtimeHours) || 0) > 0 && (
            <FormInput
              label="Downtime Reason"
              value={downtimeReason}
              onChangeText={setDowntimeReason}
              placeholder="Describe reason for downtime"
              multiline
              numberOfLines={2}
            />
          )}

          <FormInput
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Any additional notes…"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : (isOnline ? 'Save Record' : 'Save Offline')}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  row: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },

  totalChip: {
    backgroundColor: Colors.navyBg ?? '#EEF2FF', borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, alignSelf: 'flex-start',
  },
  totalText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.navy },
  totalChipGreen: { backgroundColor: Colors.successBg },
  totalTextGreen: { color: Colors.success },

  hintText: { fontSize: Typography.xs, color: Colors.textMuted },

  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHint: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: -Spacing.xs },

  sizeRow: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.xs, marginTop: Spacing.xs,
  },
  sizeRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sizeRowLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary },
  sizeRowVolume: { fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.medium },

  addSizeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: Spacing.xs, paddingVertical: Spacing.xs,
  },
  addSizeText: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.navy },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
