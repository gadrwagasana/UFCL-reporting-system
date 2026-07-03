import React from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { useAdminRoles } from '../../hooks/useAdmin';
import type { RoleDefinition } from '../../types/api';
import { AdminStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

function RoleCard({ role, onPress }: { role: RoleDefinition; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardLeft}>
        <Text style={styles.roleName}>{role.label ?? role.role}</Text>
        <Text style={styles.roleKey}>({role.role})</Text>
        {role.description ? (
          <Text style={styles.roleDesc} numberOfLines={2}>{role.description}</Text>
        ) : null}
        <View style={styles.meta}>
          <Text style={styles.metaText}>{role.permissions?.length ?? 0} pages</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{role.responsibilities?.length ?? 0} responsibilities</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export function RolesScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, refetch, isRefetching } = useAdminRoles();

  if (isLoading) return <LoadingState message="Loading roles…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Role Definitions" onBack={() => navigation.goBack()} />

      {isError ? (
        <ErrorState message="Could not load roles" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => item.role}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          renderItem={({ item }) => (
            <RoleCard
              role={item}
              onPress={() => navigation.navigate('RoleDetail', { role: item.role })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm,
  },
  cardLeft:  { flex: 1, gap: 4 },
  roleName:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  roleKey:   { fontSize: Typography.xs, color: Colors.textMuted },
  roleDesc:  { fontSize: Typography.sm, color: Colors.textSecondary },
  meta:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  metaText:  { fontSize: Typography.xs, color: Colors.textMuted },
  metaDot:   { fontSize: Typography.xs, color: Colors.textMuted },
});
