import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert,
  Modal, TextInput, ActivityIndicator,
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
import { EmptyState }   from '../../components/EmptyState';
import { useAdminUsers, useDeleteUser, useResetPassword } from '../../hooks/useAdmin';
import { useAuthStore } from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import type { UserRow } from '../../types/api';
import type { UserRole } from '../../types/auth';
import { AdminStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const ROLE_COLORS: Record<string, string> = {
  admin:      Colors.error,
  ceo:        Colors.navy,
  operations: Colors.success,
  finance:    Colors.warning,
  logistics:  '#8B5CF6',
  sales:      Colors.orange,
};

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? '#6B7280';
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color }]}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function UserCard({
  user,
  myRole,
  myId,
  onEdit,
  onPermissions,
  onResetPw,
  onDelete,
}: {
  user:          UserRow;
  myRole:        UserRole | undefined;
  myId:          number   | undefined;
  onEdit:        () => void;
  onPermissions: () => void;
  onResetPw:     () => void;
  onDelete:      () => void;
}) {
  const canDelete = myRole === 'admin' && user.id !== myId;
  const hasCustom = user.user_permissions?.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userHandle}>@{user.username}</Text>
        </View>
        <View style={styles.cardBadges}>
          <View style={[styles.roleBadge, { backgroundColor: roleColor(user.role) }]}>
            <Text style={styles.roleBadgeText}>{user.role}</Text>
          </View>
          {!user.active && (
            <View style={[styles.statusBadge, { backgroundColor: Colors.error }]}>
              <Text style={styles.roleBadgeText}>Inactive</Text>
            </View>
          )}
          {hasCustom && (
            <View style={[styles.statusBadge, { backgroundColor: Colors.warning }]}>
              <Text style={styles.roleBadgeText}>Custom</Text>
            </View>
          )}
        </View>
      </View>

      {(user.department || user.workshop_name) ? (
        <Text style={styles.userSub}>
          {[user.department, user.workshop_name].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={16} color={Colors.navy} />
          <Text style={[styles.actionText, { color: Colors.navy }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onPermissions}>
          <Ionicons name="key-outline" size={16} color={Colors.success} />
          <Text style={[styles.actionText, { color: Colors.success }]}>Permissions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onResetPw}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.warning} />
          <Text style={[styles.actionText, { color: Colors.warning }]}>Reset PW</Text>
        </TouchableOpacity>
        {canDelete && (
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function UsersScreen() {
  const navigation = useNavigation<Nav>();
  const myRole     = useAuthStore((s) => s.user?.role as UserRole | undefined);
  const myId       = useAuthStore((s) => s.user?.id != null ? Number(s.user.id) : undefined);

  const { data, isLoading, isError, refetch, isRefetching } = useAdminUsers();
  const deleteUser  = useDeleteUser();
  const resetPw     = useResetPassword();

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting,   setResetting]   = useState(false);

  const kpi = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      total:    rows.length,
      active:   rows.filter((r) => r.active).length,
      inactive: rows.filter((r) => !r.active).length,
      custom:   rows.filter((r) => r.user_permissions?.length > 0).length,
    };
  }, [data]);

  function handleResetPw(user: UserRow) {
    setNewPassword('');
    setResetTarget(user);
  }

  function handleConfirmReset() {
    if (!resetTarget || !newPassword.trim()) return;
    setResetting(true);
    resetPw.mutate(
      { userId: resetTarget.id, newPassword: newPassword.trim() },
      {
        onSuccess: (res) => {
          setResetting(false);
          if (res.ok) {
            setResetTarget(null);
            Alert.alert('Done', 'Password reset successfully');
          } else {
            Alert.alert('Error', res.error ?? 'Failed');
          }
        },
        onError: () => {
          setResetting(false);
          Alert.alert('Error', 'Could not reset password. Please try again.');
        },
      },
    );
  }

  function handleDelete(user: UserRow) {
    Alert.alert(
      'Delete User',
      `Delete @${user.username}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteUser.mutate(user.id, {
              onSuccess: (res) => {
                if (!res.ok) Alert.alert('Error', res.error ?? 'Failed');
              },
            }),
        },
      ],
    );
  }

  if (isLoading) return <LoadingState message="Loading users…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Users"
        onBack={() => navigation.goBack()}
        actions={
          myRole && hasPermission(myRole, 'admin.users')
            ? [{ icon: 'add' as const, onPress: () => navigation.navigate('UserDetail', {}) }]
            : []
        }
      />

      {/* KPI row */}
      <View style={styles.kpiRow}>
        <KpiCard label="Total"    value={kpi.total}    color={Colors.navy} />
        <KpiCard label="Active"   value={kpi.active}   color={Colors.success} />
        <KpiCard label="Inactive" value={kpi.inactive} color={Colors.error} />
        <KpiCard label="Custom"   value={kpi.custom}   color={Colors.warning} />
      </View>

      {isError ? (
        <ErrorState message="Could not load users" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows ?? []).length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState icon="people-outline" title="No users found" subtitle="Create the first user with the + button." />
          }
          renderItem={({ item }) => (
            <UserCard
              user={item}
              myRole={myRole}
              myId={myId}
              onEdit={() => navigation.navigate('UserDetail', { userId: item.id })}
              onPermissions={() => navigation.navigate('UserPermissions', { userId: item.id, userName: item.name })}
              onResetPw={() => handleResetPw(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* Password Reset Modal — replaces Alert.prompt which is iOS-only */}
      <Modal
        visible={resetTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !resetting && setResetTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSub}>New password for @{resetTarget?.username}</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoFocus
              editable={!resetting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setResetTarget(null)}
                disabled={resetting}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, (!newPassword.trim() || resetting) && styles.modalBtnDisabled]}
                onPress={handleConfirmReset}
                disabled={!newPassword.trim() || resetting}
                activeOpacity={0.8}
              >
                {resetting
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.modalBtnConfirmText}>Reset Password</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  kpiRow: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  kpiCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center', gap: 2, borderTopWidth: 3, ...Shadow.sm,
  },
  kpiValue: { fontSize: Typography.lg, fontWeight: Typography.bold },
  kpiLabel: { fontSize: Typography.xs, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:    { flex: 1 },
  cardBadges:  { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
  userName:    { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  userHandle:  { fontSize: Typography.sm, color: Colors.textMuted },
  userSub:     { fontSize: Typography.sm, color: Colors.textSecondary },
  roleBadge:   { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  roleBadgeText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.white },

  actions:    { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  actionText: { fontSize: Typography.xs, fontWeight: Typography.medium },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  modalBox: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.lg, width: '100%', gap: Spacing.md, ...Shadow.sm,
  },
  modalTitle:  { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  modalSub:    { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: -Spacing.xs },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: Typography.base,
    color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  modalActions:        { flexDirection: 'row', gap: Spacing.sm },
  modalBtn:            { flex: 1, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel:      { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  modalBtnCancelText:  { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textSecondary },
  modalBtnConfirm:     { backgroundColor: Colors.navy },
  modalBtnConfirmText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  modalBtnDisabled:    { opacity: 0.45 },
});
