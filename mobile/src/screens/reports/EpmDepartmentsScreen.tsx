import React from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useEpmDepartments } from '../../hooks/useEpm';
import type { ReportsStackParamList } from '../../navigation/types';
import type { DeptScorecard } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;

const RISK_COLOR = { high: Colors.error, medium: Colors.warning, low: Colors.success };

function DeptCard({ d, onPress }: { d: DeptScorecard; onPress: () => void }) {
  const scoreColor = d.score >= 80 ? Colors.success : d.score >= 60 ? Colors.warning : Colors.error;
  const riskColor  = RISK_COLOR[d.risk_level] || Colors.textMuted;
  return (
    <TouchableOpacity style={[s.card, { borderTopColor: d.color || Colors.navy }]} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          <Ionicons name={(d.icon?.replace('ti-', '') || 'grid') as never} size={18} color={d.color || Colors.navy} />
          <Text style={s.deptName}>{d.department}</Text>
        </View>
        <View style={[s.scoreCircle, { borderColor: scoreColor }]}>
          <Text style={[s.scoreNum, { color: scoreColor }]}>{d.score}</Text>
        </View>
      </View>
      <View style={s.badgeRow}>
        <View style={[s.badge, { backgroundColor: Colors.successBg }]}>
          <Text style={[s.badgeText, { color: Colors.success }]}>{d.on_track} ✓</Text>
        </View>
        <View style={[s.badge, { backgroundColor: Colors.warningBg }]}>
          <Text style={[s.badgeText, { color: Colors.warning }]}>{d.at_risk} !</Text>
        </View>
        <View style={[s.badge, { backgroundColor: Colors.errorBg }]}>
          <Text style={[s.badgeText, { color: Colors.error }]}>{d.off_track} ✗</Text>
        </View>
      </View>
      <View style={s.cardFoot}>
        <Text style={[s.riskLabel, { color: riskColor }]}>Risk: {d.risk_level}</Text>
        <Text style={s.actionsLabel}>{d.open_actions} open plans</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export function EpmDepartmentsScreen() {
  const navigation = useNavigation<Nav>();
  const { data: res, isLoading, isRefetching, refetch } = useEpmDepartments();

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Department Scorecards" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  const scorecards = res?.ok ? res.scorecards : [];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Department Scorecards" onBack={() => navigation.goBack()} />
      <FlatList
        data={scorecards}
        keyExtractor={d => d.department}
        numColumns={2}
        columnWrapperStyle={{ gap: Spacing.sm }}
        renderItem={({ item }) => (
          <DeptCard
            d={item}
            onPress={() => navigation.navigate('EpmDepartmentKpis', { department: item.department })}
          />
        )}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="business-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyText}>No department data.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:   { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  card:        { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, borderTopWidth: 3, ...Shadow.sm },
  cardTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  cardLeft:    { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  deptName:    { fontSize: 12, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  scoreCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreNum:    { fontSize: 13, fontWeight: Typography.bold },
  badgeRow:    { flexDirection: 'row', gap: 4, marginBottom: Spacing.xs },
  badge:       { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8 },
  badgeText:   { fontSize: 10, fontWeight: '700' },
  cardFoot:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  riskLabel:   { fontSize: 10, fontWeight: '600', flex: 1 },
  actionsLabel:{ fontSize: 10, color: Colors.textMuted },

  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: 64 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
});
