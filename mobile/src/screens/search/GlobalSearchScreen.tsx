import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { SearchBar } from '../../components/SearchBar';
import { SearchResultCard } from '../../components/SearchResultCard';
import { RecentSearchCard } from '../../components/RecentSearchCard';
import { SearchSkeleton } from '../../components/SearchSkeleton';
import { EmptySearchState } from '../../components/EmptySearchState';
import { ErrorState } from '../../components/ErrorState';
import { FilterBottomSheet } from '../../components/FilterBottomSheet';
import { SearchResultDetailSheet } from '../../components/SearchResultDetailSheet';
import { useGlobalSearch, useGlobalSearchOverview } from '../../hooks/useGlobalSearch';
import {
  loadRecentSearches, saveRecentSearch, removeRecentSearch, clearRecentSearches,
  loadFavoriteSearches, saveFavoriteSearch, removeFavoriteSearch, FavoriteSearch,
} from '../../utils/storage';
import { SEARCH_MODULE_LABEL, SEARCH_MODULE_ICON, DIRECT_NAV_MODULE } from '../../constants/searchModules';
import { trackSearchEvent } from '../../utils/searchAnalytics';
import { Colors, Spacing, Typography, Radius, TextStyles } from '../../theme';
import type { SearchFilters, SearchModule, SearchResult } from '../../types/api';
import type { RootStackParamList } from '../../navigation/types';

const MIN_QUERY_LENGTH = 2;

// Modules a user is realistically allowed to browse from the landing state —
// mirrors the same permission-gated module list FilterBottomSheet builds from
// (availableModules, computed by the caller from the overview response) so we
// never suggest a module the user can't actually see results for.

export function GlobalSearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'GlobalSearch'>>();
  const contextModule = route.params?.contextModule;

  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [activeModule, setActiveModule] = useState<SearchModule | undefined>(contextModule);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<FavoriteSearch[]>([]);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    loadRecentSearches().then(setRecent);
    loadFavoriteSearches().then(setFavorites);
  }, []);

  const trimmed = query.trim();
  const isDeepMode = activeModule !== undefined;
  const isContextBase = !!contextModule && activeModule === contextModule;
  const showBackRow = isDeepMode && !isContextBase;
  const hasActiveFilters = Object.keys(filters).some((k) => k !== 'sort' && (filters as Record<string, unknown>)[k] != null);
  const isFavorited = trimmed.length > 0 && favorites.some((f) => f.query.toLowerCase() === trimmed.toLowerCase());

  const overview = useGlobalSearchOverview(isDeepMode ? '' : trimmed, filters);
  const deep = useGlobalSearch(trimmed, activeModule, filters);

  useEffect(() => {
    if (trimmed.length >= MIN_QUERY_LENGTH) trackSearchEvent('search_executed', { module: activeModule ?? 'everywhere' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, activeModule]);

  async function onSelectRecent(q: string) {
    setText(q);
    setQuery(q);
  }
  async function onRemoveRecent(q: string) {
    setRecent(await removeRecentSearch(q));
  }
  async function onClearHistory() {
    await clearRecentSearches();
    setRecent([]);
  }
  async function onToggleFavorite() {
    if (!trimmed) return;
    if (isFavorited) {
      const match = favorites.find((f) => f.query.toLowerCase() === trimmed.toLowerCase());
      if (match) setFavorites(await removeFavoriteSearch(match.id));
    } else {
      setFavorites(await saveFavoriteSearch(trimmed, { ...filters, module: activeModule }));
    }
  }
  function onSelectFavorite(fav: FavoriteSearch) {
    setText(fav.query);
    setQuery(fav.query);
    setFilters(fav.filters);
    setActiveModule(fav.filters.module ?? contextModule);
  }
  async function onRemoveFavorite(id: string) {
    setFavorites(await removeFavoriteSearch(id));
  }

  async function onResultPress(result: SearchResult) {
    if (trimmed) setRecent(await saveRecentSearch(trimmed));
    trackSearchEvent('result_selected', { module: result.module, id: result.id });

    const directNav = DIRECT_NAV_MODULE[result.module];
    if (directNav) {
      const { screen, params } = directNav(result);
      navigation.navigate(screen, params);
    } else {
      setPreviewResult(result);
    }
  }

  function openModule(mod: SearchModule) {
    setActiveModule(mod);
  }
  function backToOverview() {
    setActiveModule(undefined);
  }
  function selectSuggestedModule(mod: SearchModule) {
    setText('');
    setQuery('');
    setActiveModule(mod);
  }

  const groupedSections = useMemo(() => {
    if (!overview.data) return [];
    const byModule = new Map<SearchModule, SearchResult[]>();
    for (const r of overview.data.results) {
      if (!byModule.has(r.module)) byModule.set(r.module, []);
      byModule.get(r.module)!.push(r);
    }
    return Array.from(byModule.entries()).map(([mod, results]) => ({
      module: mod,
      results,
      total: overview.data!.moduleCounts[mod] ?? results.length,
    }));
  }, [overview.data]);

  const availableModules = useMemo(
    () => (overview.data ? (Object.keys(overview.data.moduleCounts) as SearchModule[]) : []),
    [overview.data],
  );

  const deepResults = useMemo(
    () => deep.data?.pages.flatMap((p) => p.results) ?? [],
    [deep.data],
  );

  const placeholder = activeModule
    ? `Search ${SEARCH_MODULE_LABEL[activeModule]}…`
    : 'Search everywhere…';

  let body: React.ReactNode;

  if (!isDeepMode && trimmed.length < MIN_QUERY_LENGTH) {
    const hasAnything = favorites.length > 0 || recent.length > 0;
    body = hasAnything ? (
      <FlatList
        data={[{ kind: 'body' as const }]}
        keyExtractor={() => 'landing'}
        renderItem={() => (
          <View>
            {favorites.length > 0 ? (
              <View>
                <Text style={styles.sectionHeader}>Favorite searches</Text>
                {favorites.map((f) => (
                  <View key={f.id} style={styles.favRow}>
                    <TouchableOpacity style={styles.favTouchable} onPress={() => onSelectFavorite(f)} activeOpacity={0.75}>
                      <Ionicons name="star" size={16} color={Colors.orange} />
                      <Text style={styles.favText} numberOfLines={1}>{f.query}</Text>
                      {f.filters.module ? (
                        <Text style={styles.favModule}>{SEARCH_MODULE_LABEL[f.filters.module]}</Text>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onRemoveFavorite(f.id)} hitSlop={8}>
                      <Ionicons name="close" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {recent.length > 0 ? (
              <View>
                <View style={styles.recentHeader}>
                  <Text style={styles.recentTitle}>Recent searches</Text>
                  <TouchableOpacity onPress={onClearHistory} hitSlop={8}>
                    <Text style={styles.clearHistory}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {recent.map((q) => (
                  <RecentSearchCard key={q} query={q} onPress={() => onSelectRecent(q)} onRemove={() => onRemoveRecent(q)} />
                ))}
              </View>
            ) : null}

            <Text style={styles.sectionHeader}>Browse a module</Text>
            <View style={styles.moduleGrid}>
              {(Object.keys(SEARCH_MODULE_LABEL) as SearchModule[]).map((mod) => (
                <TouchableOpacity key={mod} style={styles.moduleChip} onPress={() => selectSuggestedModule(mod)} activeOpacity={0.75}>
                  <Ionicons name={SEARCH_MODULE_ICON[mod]} size={14} color={Colors.textSecondary} />
                  <Text style={styles.moduleChipText}>{SEARCH_MODULE_LABEL[mod]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      />
    ) : (
      <EmptySearchState variant="start" />
    );
  } else if (isDeepMode) {
    if (deep.isLoading) {
      body = <SearchSkeleton />;
    } else if (deep.isError) {
      body = <ErrorState message="Couldn't load results." onRetry={() => deep.refetch()} />;
    } else if (deepResults.length === 0) {
      body = <EmptySearchState variant="no-results" query={trimmed} />;
    } else {
      body = (
        <FlatList
          data={deepResults}
          keyExtractor={(r) => `${r.module}-${r.id}`}
          renderItem={({ item }) => (
            <SearchResultCard result={item} query={trimmed} onPress={() => onResultPress(item)} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (deep.hasNextPage && !deep.isFetchingNextPage) deep.fetchNextPage(); }}
          ListFooterComponent={deep.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footerLoader} color={Colors.navy} />
          ) : null}
        />
      );
    }
  } else {
    if (overview.isLoading) {
      body = <SearchSkeleton />;
    } else if (overview.isError) {
      body = <ErrorState message="Couldn't load results." onRetry={() => overview.refetch()} />;
    } else if (groupedSections.length === 0) {
      body = <EmptySearchState variant="no-results" query={trimmed} />;
    } else {
      body = (
        <FlatList
          data={groupedSections}
          keyExtractor={(s) => s.module}
          renderItem={({ item }) => (
            <View>
              <Text style={styles.sectionHeader}>{SEARCH_MODULE_LABEL[item.module]}</Text>
              {item.results.map((r) => (
                <SearchResultCard key={`${r.module}-${r.id}`} result={r} query={trimmed} onPress={() => onResultPress(r)} />
              ))}
              {item.total > item.results.length ? (
                <TouchableOpacity style={styles.seeAll} onPress={() => openModule(item.module)}>
                  <Text style={styles.seeAllText}>See all {item.total} in {SEARCH_MODULE_LABEL[item.module]}</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.navy} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Search" onBack={() => navigation.goBack()} hideSearch />

      {contextModule ? (
        <View style={styles.scopeRow}>
          <TouchableOpacity
            style={[styles.scopeChip, isContextBase && styles.scopeChipActive]}
            onPress={() => setActiveModule(contextModule)}
            activeOpacity={0.75}
          >
            <Text style={[styles.scopeChipText, isContextBase && styles.scopeChipTextActive]}>
              Search {SEARCH_MODULE_LABEL[contextModule]}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeChip, activeModule === undefined && styles.scopeChipActive]}
            onPress={() => setActiveModule(undefined)}
            activeOpacity={0.75}
          >
            <Text style={[styles.scopeChipText, activeModule === undefined && styles.scopeChipTextActive]}>
              Search Everywhere
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <View style={styles.searchBarFlex}>
          <SearchBar
            value={text}
            onChangeText={setText}
            onDebouncedChange={setQuery}
            onFilterPress={() => setFilterSheetOpen(true)}
            filterActive={hasActiveFilters}
            placeholder={placeholder}
            autoFocus
          />
        </View>
        {trimmed.length > 0 ? (
          <TouchableOpacity style={styles.starBtn} onPress={onToggleFavorite} hitSlop={8}>
            <Ionicons name={isFavorited ? 'star' : 'star-outline'} size={20} color={isFavorited ? Colors.orange : Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showBackRow ? (
        <TouchableOpacity style={styles.backRow} onPress={backToOverview} hitSlop={8}>
          <Ionicons name="arrow-back" size={16} color={Colors.navy} />
          <Text style={styles.backText}>All results</Text>
          <Text style={styles.backModule}>· {SEARCH_MODULE_LABEL[activeModule as SearchModule]}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.body}>{body}</View>

      <FilterBottomSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onApply={(f) => { setFilters(f); trackSearchEvent('filter_applied', f as Record<string, unknown>); }}
        availableModules={availableModules}
      />

      <SearchResultDetailSheet result={previewResult} onClose={() => setPreviewResult(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  body: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBarFlex: { flex: 1 },
  starBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  scopeChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.card,
  },
  scopeChipActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  scopeChipText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  scopeChipTextActive: { color: Colors.white },
  recentHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  recentTitle: { ...TextStyles.captionMedium, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  clearHistory: { fontSize: Typography.sm, color: Colors.navy, fontWeight: Typography.medium },
  sectionHeader: {
    ...TextStyles.captionMedium,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  favRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.base,
  },
  favTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  favText: { ...TextStyles.body, color: Colors.textPrimary, flex: 1 },
  favModule: { fontSize: Typography.xs, color: Colors.textMuted },
  moduleGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs,
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.md,
  },
  moduleChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.card,
  },
  moduleChipText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  seeAll: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  seeAllText: { fontSize: Typography.sm, color: Colors.navy, fontWeight: Typography.medium },
  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm,
  },
  backText: { fontSize: Typography.sm, color: Colors.navy, fontWeight: Typography.semibold },
  backModule: { fontSize: Typography.sm, color: Colors.textMuted },
  footerLoader: { paddingVertical: Spacing.md },
});
