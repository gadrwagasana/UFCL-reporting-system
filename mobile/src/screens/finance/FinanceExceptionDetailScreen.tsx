import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { StatusBadge }   from '../../components/StatusBadge';
import { useFinanceExceptionDetail, useFinanceExceptionActions } from '../../hooks/useFinance';
import { FinanceCenterStackParamList } from '../../navigation/types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<FinanceCenterStackParamList, 'FinanceExceptionDetail'>;
type RouteProps = RouteProp<FinanceCenterStackParamList, 'FinanceExceptionDetail'>;

export function FinanceExceptionDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteProps>();
  const { data, isLoading, isError, refetch } = useFinanceExceptionDetail(params.caseId);
  const { addComment, resolve } = useFinanceExceptionActions();
  const [comment, setComment] = useState('');
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState<'comment' | 'resolve' | null>(null);

  if (isLoading) return <LoadingState message="Loading case…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load exception case" onRetry={refetch} fullScreen />;

  const { case: c, comments } = data;
  const canAct = c.status !== 'resolved' && c.status !== 'closed';

  async function handleAddComment() {
    const text = comment.trim();
    if (!text) return;
    setBusy('comment');
    try {
      const r = await addComment(params.caseId, text);
      if (!r.ok) { Alert.alert('Error', r.error || 'Could not add comment.'); return; }
      setComment('');
      await refetch();
    } catch {
      Alert.alert('Error', 'Could not add comment. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function handleResolve() {
    const notes = resolution.trim();
    if (!notes) { Alert.alert('Resolution required', 'Please describe how this was resolved.'); return; }
    setBusy('resolve');
    try {
      const r = await resolve(params.caseId, notes);
      if (!r.ok) { Alert.alert('Error', r.error || 'Could not resolve.'); return; }
      Alert.alert('Resolved', 'Exception case marked resolved.');
      await refetch();
    } catch {
      Alert.alert('Error', 'Could not resolve. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={`Case #${c.id}`} dark onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.title}>{c.title}</Text>
              <StatusBadge status={c.status} size="sm" />
            </View>
            <Text style={styles.meta}>{c.category.replace(/_/g, ' ')} · {c.severity}{c.financial_impact != null ? ` · ${formatCurrency(c.financial_impact)}` : ''}</Text>
            {c.description ? <Text style={styles.description}>{c.description}</Text> : null}
          </View>

          <Text style={styles.sectionTitle}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyText}>No comments yet.</Text>
          ) : comments.map((cm) => (
            <View key={cm.id} style={styles.commentCard}>
              <View style={styles.commentTop}>
                <Text style={styles.commentUser}>{cm.user_name || '—'}</Text>
                <Text style={styles.commentDate}>{formatDateTime(cm.created_at)}</Text>
              </View>
              <Text style={styles.commentText}>{cm.comment}</Text>
            </View>
          ))}

          {canAct ? (
            <>
              <View style={styles.inputBlock}>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={3}
                  placeholder="Add a comment…"
                  placeholderTextColor={Colors.textMuted}
                  value={comment}
                  onChangeText={setComment}
                />
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddComment} disabled={busy !== null} activeOpacity={0.85}>
                  {busy === 'comment' ? <ActivityIndicator size="small" color={Colors.navy} /> : <Text style={styles.secondaryBtnText}>Add Comment</Text>}
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Resolve</Text>
              <View style={styles.inputBlock}>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={3}
                  placeholder="Describe how this was resolved…"
                  placeholderTextColor={Colors.textMuted}
                  value={resolution}
                  onChangeText={setResolution}
                />
                <TouchableOpacity style={styles.resolveBtn} onPress={handleResolve} disabled={busy !== null} activeOpacity={0.85}>
                  {busy === 'resolve' ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.resolveBtnText}>Mark Resolved</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : c.resolution_notes ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Resolution</Text>
              <Text style={styles.description}>{c.resolution_notes}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  title: { flex: 1, fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  meta: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  description: { fontSize: Typography.sm, color: Colors.textPrimary, marginTop: Spacing.sm, lineHeight: Typography.sm * 1.4 },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.md,
  },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  commentCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.xs },
  commentTop: { flexDirection: 'row', justifyContent: 'space-between' },
  commentUser: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textPrimary },
  commentDate: { fontSize: Typography.xs, color: Colors.textMuted },
  commentText: { fontSize: Typography.sm, color: Colors.textPrimary, marginTop: 2 },
  inputBlock: { marginTop: Spacing.sm, gap: Spacing.sm },
  textArea: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md,
    fontSize: Typography.base, color: Colors.textPrimary, minHeight: 80, textAlignVertical: 'top',
  },
  secondaryBtn: {
    height: 44, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: Typography.base, color: Colors.navy, fontWeight: Typography.semibold },
  resolveBtn: { height: 48, borderRadius: Radius.md, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  resolveBtnText: { fontSize: Typography.base, color: Colors.white, fontWeight: Typography.semibold },
});
