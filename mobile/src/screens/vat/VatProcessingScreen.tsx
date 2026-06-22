import React from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }   from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useVatList }   from '../../hooks/useVat';
import { VatEntry }     from '../../types/api';
import { VatEntriesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<VatEntriesStackParamList, 'VatProcessingList'>;

const TYPE_COLOR: Record<string, string> = {
  'Kiln-dried timber': Colors.warning,
  'CCA treated timber': Colors.navy,
};

function EntryCard({ item, onPress }: { item: VatEntry; onPress: () => void }) {
  const typeColor = TYPE_COLOR[item.type_value_added] ?? Colors.textMuted;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '20', borderColor: typeColor }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>
            {item.type_value_added === 'Kiln-dried timber' ? 'Kiln' : 'CCA'}
          </Text>
        </View>
        <Text style={styles.dateText}>{item.date_fmt ?? '—'}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.sizeText}>{item.product_size}</Text>
        <Text style={styles.qty}>{item.num_timber} pcs</Text>
      </View>
    </TouchableOpacity>
  );
}

export function VatProcessingScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useVatList();

  const rows = data?.rows ?? [];

  if (isLoading) return <LoadingState message="Loading VAT entries…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="VAT Processed" dark />

      {isError ? (
        <ErrorState message="Could not load VAT entries" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState
              icon="layers-outline"
              title="No VAT entries yet"
              subtitle="Go to Inbound to record intake from a transfer."
            />
          }
          renderItem={({ item }) => (
            <EntryCard
              item={item}
              onPress={() => navigation.navigate('VatDetail', { entry: item })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  card:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: Typography.xs, color: Colors.textMuted },

  typeBadge: {
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  typeBadgeText: { fontSize: Typography.xs, fontWeight: Typography.semibold },

  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sizeText: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  qty:      { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.navy },
});
