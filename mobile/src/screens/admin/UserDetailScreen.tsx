import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Switch, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { useAdminUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../../hooks/useAdmin';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../types/auth';
import { AdminStackParamList, AdminStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav   = NativeStackNavigationProp<AdminStackParamList>;
type Route = AdminStackScreenProps<'UserDetail'>['route'];

const ALL_ROLES: UserRole[] = [
  'admin', 'ceo', 'operations', 'sales', 'sales-staff', 'showroom-staff',
  'finance', 'logistics', 'logistics-officer', 'supervisor', 'storekeeper',
  'storekeeper-assistant', 'mechanician', 'harvesting-leader', 'sawmill-leader',
  'poles-leader', 'vat-leader', 'harvesting-supervisor', 'sawmill-supervisor',
  'poles-supervisor', 'vat-supervisor',
];

const WORKSHOP_ROLES = new Set([
  'supervisor', 'storekeeper', 'storekeeper-assistant', 'mechanician',
  'harvesting-leader', 'sawmill-leader', 'poles-leader', 'vat-leader',
  'sales-staff', 'showroom-staff',
]);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function UserDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const userId     = route.params?.userId;
  const isEdit     = userId !== undefined;

  const myRole = useAuthStore((s) => s.user?.role as UserRole | undefined);
  const myId   = useAuthStore((s) => s.user?.id);

  const { data, isLoading } = useAdminUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const existing = data?.rows.find((r) => r.id === userId);
  const workshops = data?.workshops ?? [];

  const [name,       setName]       = useState('');
  const [username,   setUsername]   = useState('');
  const [password,   setPassword]   = useState('');
  const [role,       setRole]       = useState<UserRole>('supervisor');
  const [department, setDepartment] = useState('');
  const [workshopId, setWorkshopId] = useState<number | null>(null);
  const [active,     setActive]     = useState(true);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setUsername(existing.username);
      setRole(existing.role as UserRole);
      setDepartment(existing.department ?? '');
      setWorkshopId(existing.workshop_id);
      setActive(existing.active);
    }
  }, [existing]);

  const needsWorkshop = WORKSHOP_ROLES.has(role);

  async function handleSave() {
    if (!name.trim()) return Alert.alert('Validation', 'Name is required');
    if (!isEdit && !username.trim()) return Alert.alert('Validation', 'Username is required');
    if (!isEdit && !password.trim()) return Alert.alert('Validation', 'Password is required');
    if (needsWorkshop && !workshopId) return Alert.alert('Validation', `Role "${role}" requires a workshop`);

    setSaving(true);
    try {
      if (isEdit) {
        const res = await updateUser.mutateAsync({
          userId: userId!,
          name: name.trim(),
          role,
          department: department.trim() || undefined,
          workshop_id: workshopId,
          active,
        });
        if (res.ok) navigation.goBack();
        else        Alert.alert('Error', res.error ?? 'Update failed');
      } else {
        const res = await createUser.mutateAsync({
          username: username.trim(),
          name:     name.trim(),
          role,
          department: department.trim() || undefined,
          password:   password.trim(),
          workshop_id: workshopId,
        });
        if (res.ok) navigation.goBack();
        else        Alert.alert('Error', res.error ?? 'Create failed');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!isEdit || myRole !== 'admin' || myId === userId) return;
    Alert.alert(
      'Delete User',
      `Delete @${existing?.username}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () =>
            deleteUser.mutate(userId!, {
              onSuccess: (res) => {
                if (res.ok) navigation.goBack();
                else        Alert.alert('Error', res.error ?? 'Delete failed');
              },
            }),
        },
      ],
    );
  }

  if (isEdit && isLoading) return <LoadingState message="Loading user…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={isEdit ? 'Edit User' : 'Create User'} showBack />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!isEdit && (
          <Field label="Username">
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="e.g. jdoe"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>
        )}

        <Field label="Full Name">
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={Colors.textMuted}
          />
        </Field>

        {!isEdit && (
          <Field label="Password">
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Initial password"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>
        )}

        <Field label="Role">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {ALL_ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, role === r && styles.chipActive]}
                onPress={() => { setRole(r); setWorkshopId(null); }}
              >
                <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Field>

        <Field label="Department (optional)">
          <TextInput
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="e.g. Forestry"
            placeholderTextColor={Colors.textMuted}
          />
        </Field>

        {needsWorkshop && workshops.length > 0 && (
          <Field label="Workshop *">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {workshops.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.chip, workshopId === w.id && styles.chipActive]}
                  onPress={() => setWorkshopId(w.id)}
                >
                  <Text style={[styles.chipText, workshopId === w.id && styles.chipTextActive]}>{w.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>
        )}

        {isEdit && (
          <Field label="Active">
            <Switch value={active} onValueChange={setActive} trackColor={{ true: Colors.success }} />
          </Field>
        )}

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Create User'}</Text>
          }
        </TouchableOpacity>

        {isEdit && myRole === 'admin' && myId !== userId && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={styles.deleteBtnText}>Delete User</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  field:   { gap: Spacing.xs },
  label:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.card,
  },
  chips:        { gap: Spacing.sm, paddingVertical: 4 },
  chip:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:     { fontSize: Typography.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },

  saveBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, paddingVertical: Spacing.md,
  },
  deleteBtnText: { color: Colors.error, fontSize: Typography.sm, fontWeight: Typography.medium },
});
