import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { useNotifications, useNotificationActions, Notification } from '../../hooks/useNotifications';
import { Colors, Spacing, Typography } from '../../theme';

// ── Category filter tabs ──────────────────────────────────────────────────────

const CATEGORIES = [
  { key: null,       label: 'All' },
  { key: 'approval', label: 'Approvals' },
  { key: 'security', label: 'Security' },
  { key: 'system',   label: 'System' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

const CATEGORY_COLOR: Record<string, string> = {
  security: Colors.error,
  approval: Colors.warning,
  system:   Colors.info,
};

const CATEGORY_ICON: Record<string, string> = {
  security: 'shield-checkmark-outline',
  approval: 'checkmark-circle-outline',
  system:   'information-circle-outline',
};

// ── Notification card ─────────────────────────────────────────────────────────

function NotifCard({
  item,
  onPress,
}: {
  item: Notification;
  onPress: (id: number) => void;
}) {
  const catColor = CATEGORY_COLOR[item.category] ?? Colors.textMuted;
  const catIcon  = (CATEGORY_ICON[item.category] ?? 'notifications-outline') as never;

  return (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => onPress(item.id)}
      activeOpacity={0.75}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.iconWrap, { backgroundColor: catColor + '18' }]}>
          <Ionicons name={catIcon} size={20} color={catColor} />
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        {item.related_module ? (
          <Text style={styles.module}>{item.related_module}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const [category, setCategory] = useState<CategoryKey>(null);
  const [search,   setSearch]   = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } =
    useNotifications({ category, search: search.trim() || null });

  const { markRead, markAllRead } = useNotificationActions();

  const handleMarkRead = useCallback(async (id: number) => {
    try { await markRead(id); } catch { /* silently ignore — notification is advisory */ }
  }, [markRead]);

  const handleMarkAll = useCallback(async () => {
    Alert.alert(
      'Mark all as read',
      'Mark all visible notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark all read',
          onPress: async () => {
            setMarkingAll(true);
            try { await markAllRead(); } finally { setMarkingAll(false); }
          },
        },
      ],
    );
  }, [markAllRead]);

  const unread = data?.unread ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <AppHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
      />
      <OfflineBanner />

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search title or body…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        {unread > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAll}
            disabled={markingAll}
          >
            {markingAll
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.markAllText}>Mark all read</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter tabs — matches desktop category filter */}
      <View style={styles.tabs}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={String(c.key)}
            style={[styles.tab, category === c.key && styles.tabActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={[styles.tabText, category === c.key && styles.tabTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <LoadingState message="Loading notifications…" />
      ) : isError ? (
        <ErrorState message="Could not load notifications" onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <NotifCard item={item} onPress={handleMarkRead} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.navy}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              message={search || category ? 'No notifications match your filters' : 'No notifications'}
            />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },
  markAllBtn: {
    backgroundColor: Colors.navy,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  markAllText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  tabText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.white,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: 32,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.navy,
  },
  cardLeft: {
    alignItems: 'center',
    marginRight: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.navy,
    marginTop: 6,
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  title: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  titleUnread: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  time: {
    fontSize: 11,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  body: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  module: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});
