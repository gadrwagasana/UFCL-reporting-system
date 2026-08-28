import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, TextStyles, Radius } from '../theme';
import { StatusBadge } from './StatusBadge';
import { SEARCH_MODULE_ICON, SEARCH_MODULE_COLOR, SEARCH_MODULE_LABEL } from '../constants/searchModules';
import type { SearchResult } from '../types/api';

interface Props {
  result:   SearchResult;
  query?:   string;
  onPress?: () => void;
}

// Splits `text` into segments so the part matching `query` can be styled
// differently — case-insensitive, single first-match highlight.
function highlightSegments(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return [{ text, match: false }];
  const segments: { text: string; match: boolean }[] = [];
  if (idx > 0) segments.push({ text: text.slice(0, idx), match: false });
  segments.push({ text: text.slice(idx, idx + q.length), match: true });
  if (idx + q.length < text.length) segments.push({ text: text.slice(idx + q.length), match: false });
  return segments;
}

export function SearchResultCard({ result, query = '', onPress }: Props) {
  const iconName = SEARCH_MODULE_ICON[result.module];
  const iconBg   = SEARCH_MODULE_COLOR[result.module];
  const segments = highlightSegments(result.title, query);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.75 : 1} disabled={!onPress}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={Colors.textPrimary} />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {segments.map((seg, i) => (
              <Text key={i} style={seg.match ? styles.titleMatch : undefined}>{seg.text}</Text>
            ))}
          </Text>
          {result.status ? <StatusBadge status={result.status} size="sm" /> : null}
        </View>
        {result.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{result.subtitle}</Text> : null}
        {result.description ? <Text style={styles.description} numberOfLines={1}>{result.description}</Text> : null}
        <Text style={styles.module}>{SEARCH_MODULE_LABEL[result.module]}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  iconWrap: {
    width:          38,
    height:         38,
    borderRadius:   Radius.md,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    ...TextStyles.bodyMedium,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  titleMatch: {
    color: Colors.navy,
    fontWeight: '700',
    backgroundColor: '#fff3cd',
  },
  subtitle: {
    ...TextStyles.caption,
    color: Colors.textSecondary,
  },
  description: {
    ...TextStyles.caption,
    color: Colors.textMuted,
  },
  module: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
