import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, TextStyles, Radius } from '../theme';
import { getActivityIcon, getActivityColor } from '../utils/activityTypes';
import { ActivityTypeValue } from '../constants/dashboardEnums';

interface RecentRowProps {
  id:        number | string;
  left:      string;
  right?:    string;
  sub?:      string;
  iconType:  ActivityTypeValue | 'default';
  onPress?:  () => void;
}

export function RecentRow({ left, right, sub, iconType, onPress }: RecentRowProps) {
  const iconName = getActivityIcon(iconType);
  const iconBg   = getActivityColor(iconType);

  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={18} color={Colors.textPrimary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.left} numberOfLines={1}>{left}</Text>
        {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right ? <Text style={styles.right}>{right}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} /> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: Spacing.xs,
    gap:             Spacing.sm,
  },
  iconWrap: {
    width:          34,
    height:         34,
    borderRadius:   Radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  content: {
    flex: 1,
  },
  left: {
    ...TextStyles.body,
    color: Colors.textPrimary,
  },
  sub: {
    ...TextStyles.caption,
    color:     Colors.textMuted,
    marginTop: 1,
  },
  right: {
    ...TextStyles.bodyMedium,
    color:      Colors.textPrimary,
    flexShrink: 0,
  },
});
