import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart as GiftedBarChart } from 'react-native-gifted-charts';
import { Colors, Spacing, TextStyles } from '../theme';

// ── Stacked bar chart ─────────────────────────────────────────────────────────
// Used for 7-day production: each bar has a timber segment and a poles segment.

export interface StackedBarEntry {
  label:        string;
  timberUnits:  number;
  polesUnits:   number;
}

interface StackedBarChartProps {
  data:         StackedBarEntry[];
  barWidth?:    number;
  chartWidth?:  number;
}

export function StackedProductionChart({ data, barWidth = 28, chartWidth = 300 }: StackedBarChartProps) {
  const barData = data.map((d) => ({
    stacks: [
      { value: d.timberUnits, color: Colors.navy, marginBottom: 2 },
      { value: d.polesUnits,  color: Colors.success },
    ],
    label: d.label,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.navy }]} />
          <Text style={styles.legendText}>Timber</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>Poles</Text>
        </View>
      </View>
      <GiftedBarChart
        stackData={barData}
        barWidth={barWidth}
        width={chartWidth}
        noOfSections={4}
        barBorderRadius={3}
        xAxisThickness={0}
        yAxisThickness={0}
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        hideRules={false}
        rulesColor={Colors.border}
        rulesType="dashed"
        isAnimated
        animationDuration={400}
      />
    </View>
  );
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────
// Used for expenses by category.

export interface HorizontalBarEntry {
  label: string;
  value: number;
  color?: string;
}

interface HorizontalBarChartProps {
  data:  HorizontalBarEntry[];
  width?: number;
}

export function HorizontalExpenseChart({ data, width = 300 }: HorizontalBarChartProps) {
  const chartData = data.map((d, i) => ({
    value:  d.value,
    label:  d.label,
    frontColor: d.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return (
    <View style={styles.container}>
      <GiftedBarChart
        data={chartData}
        horizontal
        barWidth={18}
        width={width}
        noOfSections={4}
        barBorderRadius={3}
        xAxisThickness={0}
        yAxisThickness={0}
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        hideRules={false}
        rulesColor={Colors.border}
        rulesType="dashed"
        isAnimated
        animationDuration={400}
      />
    </View>
  );
}

const CATEGORY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4',
];

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    gap:           Spacing.md,
    marginBottom:  Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  legendDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },
  legendText: {
    ...TextStyles.caption,
    color: Colors.textMuted,
  },
  axisText: {
    ...TextStyles.caption,
    color:    Colors.textMuted,
    fontSize: 10,
  } as any,
});
