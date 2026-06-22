import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useAuth }      from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import { roleLabel }    from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

interface InfoRowProps { icon: string; label: string; value: string }
function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as never} size={18} color={Colors.textMuted} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const isOfflineSession = useAuthStore((s) => s.isOfflineSession);
  const [modalVisible, setModalVisible] = useState(false);
  const [loggingOut, setLoggingOut]     = useState(false);

  const initials    = user ? getInitials(user.name) : '?';
  const displayRole = user ? roleLabel(user.role) : '—';
  const userId      = user ? String(user.id) : '—';

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      Alert.alert('Error', 'Could not sign out. Please try again.');
    } finally {
      setLoggingOut(false);
      setModalVisible(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Profile" dark />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Offline amber banner */}
        {isOfflineSession && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning} />
            <Text style={styles.offlineBannerText}>Offline Mode — session restored from cache</Text>
          </View>
        )}

        {/* Avatar + name + role */}
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.name ?? '—'}</Text>

          {/* Role badge pill */}
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{displayRole}</Text>
          </View>

          {user?.workshopName ? (
            <View style={styles.workshopRow}>
              <Ionicons name="business-outline" size={14} color={Colors.textOnDarkMuted} />
              <Text style={styles.workshopText}>{user.workshopName}</Text>
            </View>
          ) : null}
        </View>

        {/* Info section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.divider} />
          <InfoRow icon="person-outline"    label="User ID"   value={userId} />
          <View style={styles.rowDivider} />
          <InfoRow icon="shield-outline"    label="Role"      value={displayRole} />
          {user?.workshopName ? (
            <>
              <View style={styles.rowDivider} />
              <InfoRow icon="business-outline" label="Workshop" value={user.workshopName} />
            </>
          ) : null}
          <View style={styles.rowDivider} />
          <InfoRow
            icon="wifi-outline"
            label="Session"
            value={isOfflineSession ? 'Offline (restored)' : 'Online'}
          />
        </View>

        {/* Danger zone */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App version */}
        <Text style={styles.version}>UFCL Mobile v1.0 — Sprint 1</Text>
      </ScrollView>

      {/* Logout confirmation modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalBody}>
              You will need to enter your credentials again.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setModalVisible(false)}
                disabled={loggingOut}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={handleLogout}
                disabled={loggingOut}
                activeOpacity={0.8}
              >
                {loggingOut
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.modalBtnDangerText}>Sign Out</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  offlineBannerText: {
    fontSize: Typography.sm,
    color: Colors.warning,
    fontWeight: Typography.medium,
    flex: 1,
  },

  heroCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  avatarText: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.white,
  },
  userName: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textOnDark,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xxs,
  },
  roleBadgeText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textOnDark,
  },
  workshopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xxs,
  },
  workshopText: {
    fontSize: Typography.sm,
    color: Colors.textOnDarkMuted,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.sm,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoIcon: { marginRight: Spacing.md },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 34,
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  logoutText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.error,
  },

  version: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    ...Shadow.lg,
  },
  modalTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalBody: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: Typography.base * 1.45,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnCancelText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  modalBtnDanger: {
    backgroundColor: Colors.error,
  },
  modalBtnDangerText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
});
