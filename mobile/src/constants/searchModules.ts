import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { SearchModule, SearchResult } from '../types/api';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const SEARCH_MODULE_LABEL: Record<SearchModule, string> = {
  sales:              'Sales Orders',
  deliveries:         'Deliveries',
  dispatch:           'Dispatch',
  stock_transfers:    'Stock Transfers',
  inventory:          'Inventory',
  timber:             'Timber',
  poles:              'Poles',
  workshop:           'Workshop',
  machines:           'Machines',
  fuel:               'Fuel',
  material_requests:  'Material Requests',
  purchase_requests:  'Purchase Requests',
  labour:             'Labour',
  production:         'Production',
  reports:            'Reports',
  customers:          'Customers',
  products:           'Products',
  vehicles:           'Vehicles',
  users:              'Users',
  audit_logs:         'Audit Logs',
  change_requests:    'Change Requests',
  notifications:      'Notifications',
};

export const SEARCH_MODULE_ICON: Record<SearchModule, IoniconName> = {
  sales:              'cart-outline',
  deliveries:         'car-outline',
  dispatch:           'send-outline',
  stock_transfers:    'swap-vertical-outline',
  inventory:          'layers-outline',
  timber:             'leaf-outline',
  poles:              'podium-outline',
  workshop:           'business-outline',
  machines:           'settings-outline',
  fuel:               'flame-outline',
  material_requests:  'cube-outline',
  purchase_requests:  'bag-handle-outline',
  labour:             'people-outline',
  production:         'construct-outline',
  reports:            'stats-chart-outline',
  customers:          'people-circle-outline',
  products:           'pricetag-outline',
  vehicles:           'car-sport-outline',
  users:              'person-outline',
  audit_logs:         'shield-checkmark-outline',
  change_requests:    'git-pull-request-outline',
  notifications:      'notifications-outline',
};

// Pastel tint behind each result's icon — same palette family as utils/activityTypes.ts
export const SEARCH_MODULE_COLOR: Record<SearchModule, string> = {
  sales:              '#dbeafe',
  deliveries:         '#d1fae5',
  dispatch:           '#e0f2fe',
  stock_transfers:    '#ede9fe',
  inventory:          '#fef9c3',
  timber:             '#dcfce7',
  poles:              '#ede9fe',
  workshop:           '#f3f4f6',
  machines:           '#e0f2fe',
  fuel:               '#fce7f3',
  material_requests:  '#ffedd5',
  purchase_requests:  '#ffedd5',
  labour:             '#fee2e2',
  production:         '#fef9c3',
  reports:            '#dbeafe',
  customers:          '#dbeafe',
  products:           '#fef9c3',
  vehicles:           '#d1fae5',
  users:              '#f3f4f6',
  audit_logs:         '#ede9fe',
  change_requests:    '#ede9fe',
  notifications:      '#fce7f3',
};

// Best-effort direct-to-detail navigation. Only modules with a real self-fetching
// detail screen (a `useXDetail(id)` hook backed by a real `GET /:id` endpoint) go
// here — everything else falls back to SearchResultDetailSheet, a read-only
// preview built from the result's own fields, rather than navigating to a screen
// that either doesn't exist or needs a full object we don't have. See the
// redesign plan's punch-list for exactly which modules are in which bucket.
// Takes the full result (not just id) because 'production' needs its
// workshop_type field to pick the right one of three list screens.
export const DIRECT_NAV_MODULE: Partial<Record<SearchModule, (result: SearchResult) => { screen: string; params: Record<string, unknown> }>> = {
  vehicles: (r) => ({ screen: 'VehicleDetail', params: { vehicleId: Number(r.id) } }),
  machines: (r) => ({ screen: 'MachineDetail', params: { machineId: Number(r.id) } }),
  // daily_logs has no single destination — Harvest logs have no workshop (or a
  // non-Timber/Poles one), Timber/Poles logs belong to their own production
  // list. Lands on the list (best effort), not a specific row — none of the
  // three screens has per-record navigation today either.
  production: (r) => ({
    screen: r.workshop_type === 'Timber' ? 'SawmillProductionList'
      : r.workshop_type === 'Poles' ? 'PolesProductionList'
      : 'HarvestList',
    params: {},
  }),
};

export const SEARCH_SORT_OPTIONS: Array<{ value: 'newest' | 'oldest' | 'relevance' | 'alphabetical'; label: string }> = [
  { value: 'newest',       label: 'Newest' },
  { value: 'oldest',       label: 'Oldest' },
  { value: 'relevance',    label: 'Relevance' },
  { value: 'alphabetical', label: 'Alphabetical' },
];
