import React from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { useAuthStore }  from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import { ReportsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ReportsStackParamList, 'ReportsHome'>;

type ReportEntry = {
  key:         keyof ReportsStackParamList;
  title:       string;
  description: string;
  icon:        string;
  permission:  import('../../utils/permissions').Permission;
};

const REPORTS: ReportEntry[] = [
  { key: 'WeeklyCost',   title: 'Weekly Cost',            description: 'Cost vs budget by category this week',       icon: 'cash-outline',          permission: 'reports.weekly_cost'  },
  { key: 'WeeklyPerf',   title: 'Weekly Performance',     description: 'Production output and downtime metrics',     icon: 'bar-chart-outline',     permission: 'reports.weekly_perf'  },
  { key: 'KpiScorecard', title: 'KPI Scorecard',          description: 'Monthly budget targets per expense category', icon: 'ribbon-outline',        permission: 'reports.kpi'          },
  { key: 'Executive',    title: 'Executive Dashboard',     description: 'Revenue, trends, top machines and drivers',  icon: 'stats-chart-outline',   permission: 'reports.executive'    },
  { key: 'BI',           title: 'Business Intelligence',  description: 'Predictive analytics, risks and recommendations', icon: 'trending-up-outline', permission: 'reports.bi'         },
  { key: 'Monthly',      title: 'Monthly Dashboard',      description: 'Monthly production, sales and expense summary', icon: 'calendar-outline',   permission: 'reports.monthly'      },
  { key: 'Export',       title: 'Exports',                description: 'Share data as CSV via the native share sheet', icon: 'share-outline',        permission: 'reports.export'       },
  { key: 'EpmHome',     title: 'Enterprise Performance', description: 'KPI scorecards, action plans and trends across all departments', icon: 'analytics-outline', permission: 'reports.epm' },
  { key: 'Sage',        title: 'Sage Reconciliation',    description: 'Monthly expense summary for Sage accounting reconciliation', icon: 'calculator-outline', permission: 'reports.sage' },
];

function ReportCard({ item, onPress }: { item: ReportEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardIcon}>
        <Ionicons name={item.icon as never} size={22} color={Colors.navy} />
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardTitle}>{item.title}</Text>
        <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export function ReportsHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const role       = useAuthStore(s => s.user?.role ?? '');

  const visible = REPORTS.filter(r => hasPermission(role as any, r.permission));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Reports" searchModule="reports" dark />
      <FlatList
        data={visible}
        keyExtractor={item => item.key}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <ReportCard item={item} onPress={() => navigation.navigate(item.key as any)} />
        )}
        ListHeaderComponent={
          <Text style={s.subtitle}>Select a report to view</Text>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  list:      { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  subtitle:  { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing.xs },
  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, ...Shadow.sm },
  cardIcon:  { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.navy + '14', alignItems: 'center', justifyContent: 'center' },
  cardBody:  { flex: 1, gap: 2 },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardDesc:  { fontSize: Typography.xs, color: Colors.textMuted },
});
