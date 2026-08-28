import React from 'react';
import { EmptyState } from './EmptyState';

interface Props {
  variant: 'start' | 'too-short' | 'no-results';
  query?:  string;
}

export function EmptySearchState({ variant, query }: Props) {
  if (variant === 'start') {
    return (
      <EmptyState
        icon="search-outline"
        title="Search everything"
        subtitle="Find sales orders, deliveries, customers, vehicles, machines and more — all in one place."
      />
    );
  }
  if (variant === 'too-short') {
    return (
      <EmptyState
        icon="search-outline"
        title="Keep typing…"
        subtitle="Enter at least 2 characters to search."
      />
    );
  }
  return (
    <EmptyState
      icon="file-tray-outline"
      title="No results"
      subtitle={query ? `Nothing matched "${query}". Try a different term or adjust your filters.` : 'Try a different search term or adjust your filters.'}
    />
  );
}
