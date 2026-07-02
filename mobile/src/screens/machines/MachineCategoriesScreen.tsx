import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, Alert,
  TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import {
  useMachineCategories,
  useMachineCategoryCreate,
  useMachineCategoryUpdate,
  useMachineCategoryDelete,
} from '../../hooks/useMachines';
import { MachineCategory } from '../../types/api';
import { MachinesStackParamList } from '../../navigation/types';
import { useOfflineStore } from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MachinesStackParamList, 'MachineCategories'>;

function CategoryRow({
  item,
  onEdit,
  onDelete,
}: {
  item: MachineCategory;
  onEdit: (cat: MachineCategory) => void;
  onDelete: (cat: MachineCategory) => void;
}) {
  return (
    <View style={styles.catRow}>
      <View style={styles.catInfo}>
        <Text style={styles.catName}>{item.name}</Text>
        {item.description ? <Text style={styles.catDesc}>{item.description}</Text> : null}
      </View>
      <View style={styles.catActions}>
        <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={18} color={Colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(item)} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function MachineCategoriesScreen() {
  const navigation = useNavigation<NavProp>();
  const { isOnline } = useOfflineStore();

  const { data, isLoading, isError, refetch, isRefetching } = useMachineCategories();
  const { createCategory } = useMachineCategoryCreate();
  const { updateCategory } = useMachineCategoryUpdate();
  const { deleteCategory } = useMachineCategoryDelete();

  const cats = data?.rows ?? [];

  // Create form state
  const [newName, setNewName]     = useState('');
  const [newDesc, setNewDesc]     = useState('');
  const [creating, setCreating]   = useState(false);

  // Edit form state
  const [editingCat, setEditingCat]   = useState<MachineCategory | null>(null);
  const [editName,   setEditName]     = useState('');
  const [editDesc,   setEditDesc]     = useState('');
  const [saving,     setSaving]       = useState(false);

  async function handleCreate() {
    if (!isOnline) { Alert.alert('Online Required', 'Creating categories requires a connection.'); return; }
    if (!newName.trim()) { Alert.alert('Required', 'Category name is required.'); return; }
    setCreating(true);
    try {
      await createCategory({ name: newName.trim(), description: newDesc.trim() || null });
      setNewName('');
      setNewDesc('');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not create category.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(cat: MachineCategory) {
    setEditingCat(cat);
    setEditName(cat.name);
    setEditDesc(cat.description ?? '');
  }

  function cancelEdit() {
    setEditingCat(null);
    setEditName('');
    setEditDesc('');
  }

  async function handleUpdate() {
    if (!editingCat) return;
    if (!isOnline) { Alert.alert('Online Required', 'Saving requires a connection.'); return; }
    if (!editName.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    setSaving(true);
    try {
      await updateCategory(editingCat.id, { name: editName.trim(), description: editDesc.trim() || null });
      cancelEdit();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update category.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(cat: MachineCategory) {
    if (!isOnline) { Alert.alert('Online Required', 'Deleting requires a connection.'); return; }
    Alert.alert(
      'Delete Category',
      `Delete "${cat.name}"? This will fail if any machines are using this category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not delete category.');
            }
          },
        },
      ]
    );
  }

  if (isLoading) return <LoadingState message="Loading categories…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load categories" onRetry={refetch} fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Machine Categories" dark onBack={() => navigation.goBack()} />

      <FlatList
        data={cats}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <EmptyState icon="pricetag-outline" title="No categories" subtitle="Add your first category below." />
        }
        renderItem={({ item }) => (
          <>
            {editingCat?.id === item.id ? (
              <View style={styles.editCard}>
                <Text style={styles.editTitle}>Edit Category</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Category name *"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.textInput}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder="Description (optional)"
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.editBtns}>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.btnDisabled]}
                    onPress={handleUpdate}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving
                      ? <ActivityIndicator color={Colors.white} size="small" />
                      : <Text style={styles.saveBtnText}>Save</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} activeOpacity={0.8}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <CategoryRow item={item} onEdit={startEdit} onDelete={confirmDelete} />
            )}
          </>
        )}
        ListFooterComponent={
          <View style={styles.createCard}>
            <Text style={styles.createTitle}>Add New Category</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Category name *"
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              style={styles.textInput}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Description (optional)"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity
              style={[styles.saveBtn, (creating || !isOnline) && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={creating || !isOnline}
              activeOpacity={0.8}
            >
              {creating
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.saveBtnText}>Add Category</Text>}
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  catRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  catInfo:    { flex: 1, gap: 2 },
  catName:    { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  catDesc:    { fontSize: Typography.xs, color: Colors.textMuted },
  catActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn:    { padding: Spacing.xs },

  editCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.navy, ...Shadow.sm,
  },
  editTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.navy },
  editBtns:  { flexDirection: 'row', gap: Spacing.sm },

  createCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, marginTop: Spacing.sm, ...Shadow.sm,
  },
  createTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },

  textInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    fontSize: Typography.sm, color: Colors.textPrimary,
    backgroundColor: Colors.bg,
  },

  saveBtn:      { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', flex: 1 },
  saveBtnText:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
  cancelBtn:    { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', flex: 1 },
  cancelBtnText:{ fontSize: Typography.sm, color: Colors.textSecondary },
  btnDisabled:  { opacity: 0.5 },
});
