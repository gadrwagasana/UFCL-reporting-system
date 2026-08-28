import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useProcurementRfqActions } from '../../hooks/useProcurementRfq';
import { ProcurementStackParamList } from '../../navigation/types';
import { showToast } from '../../stores/toastStore';
import { Colors, Spacing, Typography, Radius } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'RfqCreate'>;
type RouteType = RouteProp<ProcurementStackParamList, 'RfqCreate'>;

export function RfqCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { create } = useProcurementRfqActions();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      const res = await create(params.requisitionId, { title: title.trim() || undefined, due_date: dueDate.trim() || undefined });
      showToast('RFQ created.');
      if (res.id) navigation.replace('RfqDetail', { rfqId: res.id });
      else navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not create RFQ', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="New RFQ" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. RFQ for workshop hand tools" placeholderTextColor={Colors.textMuted} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="2026-08-15" placeholderTextColor={Colors.textMuted} />
        </View>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Creating…' : 'Create RFQ'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  field: { marginBottom: Spacing.sm },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.card },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
});
