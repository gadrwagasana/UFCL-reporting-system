import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { AppHeader }    from '../../components/AppHeader';
import { get }          from '../../api/client';
import { EP }           from '../../api/endpoints';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type ExportKey = 'products' | 'sales' | 'daily' | 'logistics' | 'audit';

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

async function buildProductsCsv(): Promise<string> {
  const res = await get<any>(EP.PRODUCTS_LIST());
  const rows = ['Type,Size,Active,Added by,Date'];
  for (const r of res.rows ?? [])
    rows.push([csvEscape(r.type), csvEscape(r.size), r.active, csvEscape(r.by ?? ''), csvEscape(r.date)].join(','));
  return rows.join('\n');
}

async function buildSalesCsv(): Promise<string> {
  const res = await get<any>(EP.SALES_LIST);
  const rows = ['Order number,Customer,Product type,Product size,Qty,Unit price (RWF),Status'];
  for (const r of res.rows ?? [])
    rows.push([csvEscape(r.order_number), csvEscape(r.customer_name), csvEscape(r.product_type), csvEscape(r.product_size), r.quantity, Number(r.unit_price), csvEscape(r.status)].join(','));
  return rows.join('\n');
}

async function buildDailyCsv(): Promise<string> {
  const res = await get<any>(EP.SAWMILL_LIST);
  const rows = ['Date,Machine,Product size,Timber units,Timber waste,Poles units,Poles waste,Downtime hrs,Supervisor'];
  for (const r of res.rows ?? [])
    rows.push([csvEscape(r.date), csvEscape(r.machine ?? ''), csvEscape(r.product_size ?? ''), r.timber_units ?? 0, r.timber_waste ?? 0, r.poles_units ?? 0, r.poles_waste ?? 0, r.downtime_hours ?? 0, csvEscape(r.supervisor ?? '')].join(','));
  return rows.join('\n');
}

async function buildLogisticsCsv(): Promise<string> {
  const res = await get<any>(EP.STOCK_INVENTORY);
  const rows = ['Category,Name,SKU,UoM,Unit cost (RWF),Stock,Min stock'];
  for (const r of res.rows ?? [])
    rows.push([csvEscape(r.category), csvEscape(r.name), csvEscape(r.sku ?? ''), csvEscape(r.uom), Number(r.unit_cost), r.stock, r.min_stock].join(','));
  return rows.join('\n');
}

async function buildAuditCsv(): Promise<string> {
  const res = await get<any>('/api/meta/audit?limit=500');
  const rows = ['Time,Full Name,Username,Role,Module,Action Type,Action'];
  for (const r of res.rows ?? [])
    rows.push([csvEscape(r.time ?? r.created_at), csvEscape(r.full_name ?? r.user_name ?? ''), csvEscape(r.username ?? ''), csvEscape(r.role ?? ''), csvEscape(r.module ?? ''), csvEscape(r.action_type ?? ''), csvEscape(r.action ?? '')].join(','));
  return rows.join('\n');
}

const EXPORTS: { key: ExportKey; title: string; description: string; icon: string; build: () => Promise<string> }[] = [
  { key: 'products',  title: 'Products',       description: 'Product catalogue with type, size and status',       icon: 'cube-outline',      build: buildProductsCsv  },
  { key: 'sales',     title: 'Sales Orders',   description: 'All sales orders with customer and quantity data',   icon: 'cart-outline',      build: buildSalesCsv     },
  { key: 'daily',     title: 'Daily Logs',     description: 'Sawmill daily production logs',                     icon: 'clipboard-outline', build: buildDailyCsv     },
  { key: 'logistics', title: 'Logistics Items', description: 'Spare parts and materials inventory',               icon: 'layers-outline',    build: buildLogisticsCsv },
  { key: 'audit',     title: 'Audit Trail',    description: 'Recent system audit log entries',                    icon: 'shield-outline',    build: buildAuditCsv     },
];

export function ExportScreen() {
  const [loading, setLoading] = useState<ExportKey | null>(null);

  async function handleExport(entry: typeof EXPORTS[number]) {
    setLoading(entry.key);
    try {
      const csv = await entry.build();
      await Share.share({
        message: csv,
        title:   `${entry.title}.csv`,
      });
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Export failed', err?.message ?? 'Unknown error');
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Exports" dark />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.intro}>
          Share live data as CSV via the native share sheet. Data reflects the current state of the database.
        </Text>
        {EXPORTS.map(entry => (
          <TouchableOpacity
            key={entry.key}
            style={[s.card, loading === entry.key && { opacity: 0.6 }]}
            onPress={() => handleExport(entry)}
            disabled={loading !== null}
            activeOpacity={0.75}
          >
            <View style={s.icon}>
              <Ionicons name={entry.icon as never} size={22} color={Colors.navy} />
            </View>
            <View style={s.body}>
              <Text style={s.title}>{entry.title}</Text>
              <Text style={s.desc}>{entry.description}</Text>
            </View>
            {loading === entry.key ? (
              <Text style={s.loadingText}>Preparing…</Text>
            ) : (
              <Ionicons name="share-outline" size={18} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  scroll:      { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  intro:       { fontSize: Typography.sm, color: Colors.textMuted, lineHeight: 18 },
  card:        { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, ...Shadow.sm },
  icon:        { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.navy + '14', alignItems: 'center', justifyContent: 'center' },
  body:        { flex: 1, gap: 2 },
  title:       { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  desc:        { fontSize: Typography.xs, color: Colors.textMuted },
  loadingText: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
});
