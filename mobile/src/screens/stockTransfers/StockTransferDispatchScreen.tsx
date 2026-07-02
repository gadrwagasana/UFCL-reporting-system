import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader }  from '../../components/AppHeader';
import { FormSelect } from '../../components/FormSelect';
import { useStockTransferDispatch } from '../../hooks/useStockTransfers';
import type { StockTransfersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius } from '../../theme';

type Props = NativeStackScreenProps<StockTransfersStackParamList, 'StockTransferDispatch'>;

export function StockTransferDispatchScreen() {
  const navigation    = useNavigation();
  const { params }    = useRoute<Props['route']>();
  const { transferId, remaining, itemName, uom, vehicles } = params;

  const dispatchMutation = useStockTransferDispatch();

  const [vehicleId,   setVehicleId]   = useState('');
  const [driverName,  setDriverName]  = useState('');
  const [qty,         setQty]         = useState(String(remaining));
  const [reference,   setReference]   = useState('');
  const [notes,       setNotes]       = useState('');

  const vehicleOptions = vehicles.map(v => ({
    label: `${v.registration}${v.driver_assigned ? ` — ${v.driver_assigned}` : ''}`,
    value: String(v.id),
  }));

  const selectedVehicle = vehicles.find(v => String(v.id) === vehicleId);
  const qtyNum  = Number(qty);
  const canSubmit = vehicleId && qtyNum > 0 && qtyNum <= remaining && !dispatchMutation.isPending;

  const handleDispatch = async () => {
    if (!canSubmit) return;
    try {
      await dispatchMutation.mutateAsync({
        id:          transferId,
        qty:         qtyNum,
        vehicle_id:  Number(vehicleId),
        driver_name: driverName.trim() || selectedVehicle?.driver_assigned || undefined,
        reference:   reference.trim() || undefined,
        notes:       notes.trim()     || undefined,
      });
      Alert.alert('Dispatched', `${qtyNum} ${uom} dispatched successfully.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Dispatch failed. Please try again.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Dispatch Transfer" subtitle={itemName} onBack={() => navigation.goBack()} dark />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Remaining banner */}
          <View style={s.infoBanner}>
            <Text style={s.infoText}>
              Remaining to dispatch: <Text style={s.infoBold}>{remaining} {uom}</Text>
            </Text>
          </View>

          {/* Vehicle */}
          <View style={s.field}>
            <FormSelect
              label="Vehicle"
              options={vehicleOptions}
              value={vehicleId}
              placeholder="Select vehicle…"
              required
              onChange={v => {
                const id = String(v);
                setVehicleId(id);
                const veh = vehicles.find(x => String(x.id) === id);
                if (veh?.driver_assigned) setDriverName(veh.driver_assigned);
              }}
            />
          </View>

          {/* Driver */}
          <View style={s.field}>
            <Text style={s.label}>Driver Name <Text style={s.opt}>(optional — auto-filled from vehicle)</Text></Text>
            <TextInput
              style={s.input}
              value={driverName}
              onChangeText={setDriverName}
              placeholder="Driver name…"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          {/* Dispatch quantity */}
          <View style={s.field}>
            <Text style={s.label}>Dispatch Quantity ({uom}) <Text style={s.req}>*</Text></Text>
            <TextInput
              style={s.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />
            {qtyNum > remaining && (
              <Text style={s.error}>Cannot dispatch more than remaining ({remaining} {uom}).</Text>
            )}
          </View>

          {/* Reference */}
          <View style={s.field}>
            <Text style={s.label}>Waybill / Reference <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={reference}
              onChangeText={setReference}
              placeholder="e.g. WB-2026-001"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
            />
          </View>

          {/* Notes */}
          <View style={s.field}>
            <Text style={s.label}>Notes <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.btnDisabled]}
            onPress={handleDispatch}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {dispatchMutation.isPending
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.submitText}>Confirm Dispatch</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  infoBanner: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  infoText: { fontSize: Typography.sm, color: Colors.white },
  infoBold: { fontWeight: Typography.bold },

  field: { gap: 6 },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  req:   { color: Colors.error },
  opt:   { fontWeight: '400', color: Colors.textMuted, fontSize: Typography.xs },
  error: { fontSize: Typography.xs, color: Colors.error },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.card,
  },
  textArea: { minHeight: 80 },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.sm,
  },
  submitText:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  btnDisabled: { opacity: 0.4 },
});
