import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { ReasonModal }  from '../../components/ReasonModal';
import { useProductList, useProductToggle } from '../../hooks/useProducts';
import { useOfflineStore } from '../../stores/offlineStore';
import { Product } from '../../types/api';
import { ProductsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProductsStackParamList, 'ProductsList'>;

const FILTERS = ['All', 'Kiln-dried', 'CCA-treated', 'Untreated', 'Poles', 'Manufactured Product', 'Active'] as const;
type FilterKey = typeof FILTERS[number];

function MetricBanner({ rows }: { rows: Product[] }) {
  const kilnDried   = rows.filter((r) => r.sub_type === 'Kiln-dried').length;
  const ccaTreated  = rows.filter((r) => r.sub_type === 'CCA-treated').length;
  const untreated   = rows.filter((r) => r.sub_type === 'Untreated').length;
  const poles       = rows.filter((r) => r.type === 'Poles').length;
  const active      = rows.filter((r) => r.active).length;

  return (
    <View style={styles.metricsRow}>
      {[
        { label: 'Kiln-dried',  value: kilnDried },
        { label: 'CCA-treated', value: ccaTreated },
        { label: 'Untreated',   value: untreated },
        { label: 'Poles',       value: poles },
        { label: 'Active',      value: active },
      ].map(({ label, value }) => (
        <View key={label} style={styles.metricCard}>
          <Text style={styles.metricValue}>{value}</Text>
          <Text style={styles.metricLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function TypeBadge({ type, subType }: { type: string; subType: string | null }) {
  const isTimber = type === 'Timber';
  return (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, isTimber ? styles.badgeTimber : styles.badgePoles]}>
        <Text style={isTimber ? styles.badgeTimberText : styles.badgePolesText}>
          {type}
        </Text>
      </View>
      {subType ? (
        <View style={[styles.badge, styles.badgeSub]}>
          <Text style={styles.badgeSubText}>{subType}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ProductCard({
  product, canToggle, onEdit, onToggle,
}: {
  product:   Product;
  canToggle: boolean;
  onEdit:    () => void;
  onToggle:  () => void;
}) {
  return (
    <View style={[styles.card, !product.active && styles.cardInactive]}>
      <View style={styles.cardTop}>
        <TypeBadge type={product.type} subType={product.sub_type} />
        {!product.active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardSize}>{product.size}</Text>

      <View style={styles.costRow}>
        {product.standard_cost ? (
          <Text style={styles.costText}>Cost: RWF {Number(product.standard_cost).toLocaleString()}</Text>
        ) : (
          <View style={styles.costMissingBadge}><Text style={styles.costMissingText}>Cost not set</Text></View>
        )}
        {product.default_price ? (
          <Text style={styles.costText}>Price: RWF {Number(product.default_price).toLocaleString()}</Text>
        ) : (
          <View style={styles.costMissingBadge}><Text style={styles.costMissingText}>Price not set</Text></View>
        )}
      </View>

      {product.machine ? (
        <Text style={styles.cardMeta}>
          <Ionicons name="settings-outline" size={12} color={Colors.textMuted} /> {product.machine}
        </Text>
      ) : null}
      {product.ref ? (
        <Text style={styles.cardMeta}>
          <Ionicons name="link-outline" size={12} color={Colors.textMuted} /> {product.ref}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{product.date}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={16} color={Colors.navy} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          {canToggle && (
            <TouchableOpacity
              style={[styles.actionBtn, product.active ? styles.actionBtnDeactivate : styles.actionBtnActivate]}
              onPress={onToggle}
              activeOpacity={0.7}
            >
              <Ionicons
                name={product.active ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={16}
                color={product.active ? Colors.warning : Colors.success}
              />
              <Text style={[styles.actionBtnText, product.active ? styles.actionBtnDeactivateText : styles.actionBtnActivateText]}>
                {product.active ? 'Deactivate' : 'Reactivate'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export function ProductsListScreen() {
  const navigation   = useNavigation<NavProp>();
  const { isOnline } = useOfflineStore();

  const [filter, setFilter] = useState<FilterKey>('All');

  const { data, isLoading, isError, refetch, isRefetching } = useProductList(filter);
  const { toggleProduct } = useProductToggle();

  const rows     = data?.rows ?? [];
  const canToggle = data?.isAdmin ?? false;

  // ERP UI/UX Completion Phase 8 (audit finding H-13 pattern) — Alert.prompt
  // is iOS-only; state for the cross-platform ReasonModal replacement.
  const [toggleTarget, setToggleTarget] = useState<Product | null>(null);
  const [toggling, setToggling] = useState(false);

  function handleToggle(product: Product) {
    if (!isOnline) {
      Alert.alert('Online Required', 'Product status changes require an active connection.');
      return;
    }
    setToggleTarget(product);
  }

  async function submitToggle(reason: string) {
    if (!toggleTarget || !reason.trim()) return;
    setToggling(true);
    try {
      await toggleProduct(toggleTarget.id, reason.trim());
      setToggleTarget(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update product status.');
    } finally {
      setToggling(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading products…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Products"
        searchModule="products"
        dark
        actions={[{
          icon: 'add',
          onPress: () => navigation.navigate('ProductForm', { product: undefined }),
        }]}
      />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isError ? (
        <ErrorState message="Could not load products" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
          }
          ListHeaderComponent={rows.length > 0 ? <MetricBanner rows={data?.rows ?? []} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No products"
              subtitle={filter !== 'All' ? `No products match the "${filter}" filter.` : 'Tap + to register the first product.'}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              canToggle={canToggle}
              onEdit={() => navigation.navigate('ProductForm', { product: item })}
              onToggle={() => handleToggle(item)}
            />
          )}
        />
      )}

      <ReasonModal
        visible={!!toggleTarget}
        title={toggleTarget?.active ? 'Deactivate Product' : 'Reactivate Product'}
        message={toggleTarget ? `Enter a reason for ${toggleTarget.active ? 'deactivating' : 'reactivating'} ${toggleTarget.size}:` : ''}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Reactivate'}
        loading={toggling}
        onCancel={() => setToggleTarget(null)}
        onConfirm={submitToggle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  filterScroll:  { flexGrow: 0, backgroundColor: Colors.card },
  filterContent: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.base, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chipActive:     { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:       { fontSize: Typography.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: Typography.semibold },

  metricsRow: {
    flexDirection: 'row', gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  metricCard: {
    flex: 1, backgroundColor: Colors.card,
    borderRadius: Radius.md, padding: Spacing.sm,
    alignItems: 'center', ...Shadow.sm,
  },
  metricValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.navy },
  metricLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardInactive: { opacity: 0.65 },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardSize:  { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, fontFamily: 'monospace' },
  cardMeta:  { fontSize: Typography.xs, color: Colors.textMuted },
  cardFooter:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  cardDate:  { fontSize: Typography.xs, color: Colors.textMuted },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnText:           { fontSize: Typography.xs, color: Colors.navy },
  actionBtnDeactivate:     { borderColor: Colors.warningBg },
  actionBtnDeactivateText: { color: Colors.warning },
  actionBtnActivate:       { borderColor: Colors.successBg },
  actionBtnActivateText:   { color: Colors.success },

  badgeRow:        { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  badge:           { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeTimber:     { backgroundColor: Colors.navyBg },
  badgeTimberText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.navy },
  badgePoles:      { backgroundColor: Colors.successBg },
  badgePolesText:  { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.success },
  badgeSub:        { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  badgeSubText:    { fontSize: Typography.xs, color: Colors.textSecondary },

  inactiveBadge:     { backgroundColor: Colors.errorBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: Typography.xs, color: Colors.error },

  costRow:  { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  costText: { fontSize: Typography.xs, color: Colors.textSecondary, fontFamily: 'monospace' },
  costMissingBadge: { backgroundColor: Colors.errorBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  costMissingText:  { fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.medium },
});
