import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { StatusBadge }  from '../../components/StatusBadge';
import { useChanges, useSubmitChange, useReviewChange } from '../../hooks/useAdmin';
import type { ChangeRequest } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

const RECORD_TYPES = [
  'Production Log', 'Sales Order', 'Inventory', 'Logistics',
  'Stock Movement', 'Compartment', 'Customer', 'Other',
];

function ChangeCard({
  item,
  isMgr,
  onApprove,
  onReject,
}: {
  item:      ChangeRequest;
  isMgr:    boolean;
  onApprove: () => void;
  onReject:  () => void;
}) {
  const isPending = item.status === 'Pending';
  return (
    <View style={styles.changeCard}>
      <View style={styles.changeHeader}>
        <View style={styles.changeLeft}>
          <Text style={styles.changeType}>{item.record_type}</Text>
          <Text style={styles.changeRef} numberOfLines={1}>{item.record_ref}</Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <Text style={styles.changeText} numberOfLines={3}>{item.request_text}</Text>

      <View style={styles.changeMeta}>
        <Text style={styles.metaText}>By {item.by ?? '—'}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{item.created}</Text>
      </View>

      {item.response ? (
        <Text style={styles.responseText} numberOfLines={2}>Response: {item.response}</Text>
      ) : null}

      {isMgr && isPending && (
        <View style={styles.reviewActions}>
          <TouchableOpacity style={[styles.reviewBtn, styles.approveBtn]} onPress={onApprove}>
            <Ionicons name="checkmark" size={14} color={Colors.white} />
            <Text style={styles.reviewBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.reviewBtn, styles.rejectBtn]} onPress={onReject}>
            <Ionicons name="close" size={14} color={Colors.white} />
            <Text style={styles.reviewBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function ChangesScreen() {
  const navigation = useNavigation();
  const { data, isLoading, isError, refetch, isRefetching } = useChanges();
  const submitChange = useSubmitChange();
  const reviewChange = useReviewChange();

  const [recordType,   setRecordType]   = useState(RECORD_TYPES[0]);
  const [recordRef,    setRecordRef]    = useState('');
  const [requestText,  setRequestText]  = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [showForm,     setShowForm]     = useState(true);

  const isMgr = data?.isMgr ?? false;

  async function handleSubmit() {
    if (!recordRef.trim())   return Alert.alert('Validation', 'Record reference is required');
    if (!requestText.trim()) return Alert.alert('Validation', 'Request details are required');
    setSubmitting(true);
    try {
      const res = await submitChange.mutateAsync({
        record_type:  recordType,
        record_ref:   recordRef.trim(),
        request_text: requestText.trim(),
      });
      if (res.ok) {
        setRecordRef('');
        setRequestText('');
        Alert.alert('Submitted', 'Your change request has been submitted for review.');
      } else {
        Alert.alert('Error', res.error ?? 'Submit failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function promptReview(item: ChangeRequest, status: 'Approved' | 'Rejected') {
    Alert.prompt(
      `${status === 'Approved' ? 'Approve' : 'Reject'} Request`,
      'Add a note (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status,
          onPress: (note) =>
            reviewChange.mutate(
              { id: item.id, status, response: note?.trim() || undefined },
              {
                onSuccess: (res) => {
                  if (!res.ok) Alert.alert('Error', res.error ?? 'Review failed');
                },
              },
            ),
        },
      ],
      'plain-text',
    );
  }

  if (isLoading) return <LoadingState message="Loading change requests…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Change Requests" onBack={() => navigation.goBack()} />

      <FlatList
        data={data?.rows ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <View style={styles.formSection}>
            {/* Submit form */}
            <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowForm((v) => !v)}>
              <Text style={styles.sectionTitle}>SUBMIT A REQUEST</Text>
              <Ionicons name={showForm ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
            </TouchableOpacity>

            {showForm && (
              <View style={styles.form}>
                <Text style={styles.formLabel}>Record Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {RECORD_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, recordType === t && styles.chipActive]}
                      onPress={() => setRecordType(t)}
                    >
                      <Text style={[styles.chipText, recordType === t && styles.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.formLabel}>Record Reference</Text>
                <TextInput
                  style={styles.input}
                  value={recordRef}
                  onChangeText={setRecordRef}
                  placeholder="e.g. SO-2026-001 or record ID"
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={styles.formLabel}>Request Details</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={requestText}
                  onChangeText={setRequestText}
                  multiline
                  numberOfLines={4}
                  placeholder="Describe what needs to be changed and why…"
                  placeholderTextColor={Colors.textMuted}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.submitBtnText}>Submit Request</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* Section header for list */}
            {(data?.rows ?? []).length > 0 && (
              <Text style={styles.listSectionTitle}>
                REQUESTS HISTORY ({data!.rows.length})
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="create-outline"
            title="No change requests"
            subtitle="Submit a request above to request a record change."
          />
        }
        renderItem={({ item }) => (
          <ChangeCard
            item={item}
            isMgr={isMgr}
            onApprove={() => promptReview(item, 'Approved')}
            onReject={() => promptReview(item, 'Rejected')}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {isError && (
        <ErrorState message="Could not load change requests" onRetry={refetch} fullScreen />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  formSection: { gap: Spacing.md, marginBottom: Spacing.md },
  sectionToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, letterSpacing: 1,
  },
  form: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  formLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  chips:     { gap: Spacing.sm, paddingVertical: 4 },
  chip:      { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  chipActive:    { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:      { fontSize: Typography.sm, color: Colors.textSecondary },
  chipTextActive:{ color: Colors.white },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  inputMulti:   { minHeight: 90 },
  submitBtn:    { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:{ color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },

  listSectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, letterSpacing: 1,
  },

  changeCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  changeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  changeLeft:   { flex: 1 },
  changeType:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  changeRef:    { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  changeText:   { fontSize: Typography.sm, color: Colors.textSecondary },
  changeMeta:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText:     { fontSize: Typography.xs, color: Colors.textMuted },
  metaDot:      { fontSize: Typography.xs, color: Colors.textMuted },
  responseText: { fontSize: Typography.sm, color: Colors.navy, fontStyle: 'italic' },
  reviewActions:{ flexDirection: 'row', gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  reviewBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  approveBtn:   { backgroundColor: Colors.success },
  rejectBtn:    { backgroundColor: Colors.error },
  reviewBtnText:{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },

  separator:    { height: Spacing.sm },
});
