import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { useStockCategories, useStockCategoryCreate, useStockCategoryDelete } from '../../hooks/useStock';
import { useOfflineStore } from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

export function StockCategoriesScreen() {
  const navigation  = useNavigation();
  const { isOnline } = useOfflineStore();
  const { data, isLoading, isError, refetch } = useStockCategories();
  const { createCategory } = useStockCategoryCreate();
  const { deleteCategory } = useStockCategoryDelete();

  const [newName, setNewName] = useState('');
  const [adding,  setAdding]  = useState(false);

  const cats = data?.rows ?? [];

  async function handleAdd() {
    if (!newName.trim()) return;
    if (!isOnline) { Alert.alert('Online Required', 'Adding categories requires a connection.'); return; }
    setAdding(true);
    try {
      await createCategory(newName.trim());
      setNewName('');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not add category.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!isOnline) { Alert.alert('Online Required', 'Deleting requires a connection.'); return; }
    Alert.alert(
      'Delete Category',
      `Delete "${name}"? This fails if any active items still use it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(id);
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
      <AppHeader title="Stock Categories" dark onBack={() => navigation.goBack()} />

      <FlatList
        data={cats}
        keyExtractor={c => String(c.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="pricetag-outline" title="No custom categories" subtitle="Add your first category below." />
        }
        renderItem={({ item }) => (
          <View style={styles.catRow}>
            <Text style={styles.catName}>{item.name}</Text>
            <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.delBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="New category name…"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <TouchableOpacity
              style={[styles.addBtn, (!newName.trim() || adding) && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!newName.trim() || adding}
              activeOpacity={0.8}
            >
              {adding
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Ionicons name="add" size={20} color={Colors.white} />}
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.xs, paddingBottom: Spacing.xxxl },

  catRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    ...Shadow.sm,
  },
  catName: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },
  delBtn:  { padding: Spacing.xs },

  addRow: {
    flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.sm, ...Shadow.sm,
  },
  input: {
    flex: 1, fontSize: Typography.sm, color: Colors.textPrimary,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
  },
  addBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
});
