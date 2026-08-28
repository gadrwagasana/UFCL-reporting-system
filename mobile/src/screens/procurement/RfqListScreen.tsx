import React from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { useProcurementRfqs } from '../../hooks/useProcurementRfq';
import { ProcurementStackParamList } from '../../navigation/types';
import type { ProcurementRfq } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'RfqList'>;

function RfqCard({ item, onPress }: { item: ProcurementRfq; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardNumber}>{item.rfq_number ?? `#${item.id}`}</Text>
        <StatusBadge status={item.status} size="sm" withIcon />
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
      {item.requisition_number ? <Text style={styles.cardMeta}>From {item.requisition_number}</Text> : null}
      {item.due_date ? <Text style={styles.cardMeta}>Due {new Date(item.due_date).toLocaleDateString()}</Text> : null}
    </TouchableOpacity>
  );
}

export function RfqListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useProcurementRfqs();
  const rows = data?.rows ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Requests for Quotation" dark />
      {isError ? (
        <ErrorState message="Could not load RFQs" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshing={isLoading || isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="No RFQs yet" subtitle="RFQs are created from approved requisitions." />}
          renderItem={({ item }) => (
            <RfqCard item={item} onPress={() => navigation.navigate('RfqDetail', { rfqId: item.id })} />
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
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNumber: { fontSize: Typography.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardMeta: { fontSize: Typography.xs, color: Colors.textMuted },
});
