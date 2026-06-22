import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '../theme';
import { useOfflineStore } from '../stores/offlineStore';

export function OfflineBanner() {
  const isOnline   = useOfflineStore((s) => s.isOnline);
  const isSyncing  = useOfflineStore((s) => s.isSyncing);
  const pending    = useOfflineStore((s) => s.queue.filter((i) => i.status === 'pending').length);
  const insets     = useSafeAreaInsets();

  if (isOnline && !isSyncing && pending === 0) return null;

  const text = !isOnline
    ? 'You are offline — changes will sync when reconnected'
    : isSyncing
    ? `Syncing ${pending} item${pending !== 1 ? 's' : ''}…`
    : null;

  if (!text) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top > 0 ? Spacing.xs : Spacing.sm }]}>
      <Ionicons name={isOnline ? 'sync-outline' : 'cloud-offline-outline'} size={16} color={Colors.white} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.orange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  text: {
    color: Colors.white,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    flexShrink: 1,
  },
});
