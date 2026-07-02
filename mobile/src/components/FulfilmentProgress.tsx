import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';

interface Props {
  ordered:    number;
  dispatched: number;
  accepted:   number;
  uom?:       string;
}

export function FulfilmentProgress({ ordered, dispatched, accepted, uom }: Props) {
  if (ordered <= 0) return null;
  const dispPct = Math.min(100, Math.round((dispatched / ordered) * 100));
  const accPct  = Math.min(100, Math.round((accepted  / ordered) * 100));
  const remaining = Math.max(0, ordered - accepted);

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Text style={s.meta}>
          <Text style={s.lbl}>Ord </Text>{ordered.toLocaleString()}
          {'  '}
          <Text style={[s.lbl, { color: Colors.navy }]}>Disp </Text>{dispatched.toLocaleString()}
          {'  '}
          <Text style={[s.lbl, { color: Colors.success }]}>Acc </Text>{accepted.toLocaleString()}
          {uom ? <Text style={s.uom}> {uom}</Text> : null}
        </Text>
        <Text style={[s.remaining, remaining > 0 ? { color: Colors.warning } : { color: Colors.success }]}>
          {remaining > 0 ? `${remaining.toLocaleString()} left` : 'Complete'}
        </Text>
      </View>
      <View style={s.track}>
        {/* dispatched (faint navy underlay) */}
        <View style={[s.barDisp, { width: `${dispPct}%` as any }]} />
        {/* accepted (solid green overlay) */}
        <View style={[s.barAcc,  { width: `${accPct}%`  as any }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 4 },
  row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 11, color: Colors.textMuted },
  lbl:  { color: Colors.textSecondary },
  uom:  { color: Colors.textMuted },
  remaining: { fontSize: 11, fontWeight: Typography.semibold },
  track:   { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  barDisp: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.navy, opacity: 0.35 },
  barAcc:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.success },
});
