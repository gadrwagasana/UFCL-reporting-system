// Central list of all API endpoint paths.
// Base URL is injected by the Axios client.
export const EP = {
  // Auth
  AUTH_LOGIN:              '/api/auth/login',
  AUTH_ME:                 '/api/auth/me',

  // CEO
  CEO_OVERVIEW:            '/api/ceo/overview',
  CEO_POLES_REQUESTS:      '/api/ceo/poles-requests',
  // Single endpoint handles both approve and reject via {approve: boolean, rejectionReason?}
  CEO_POLES_APPROVE:       (id: number) => `/api/ceo/poles-requests/${id}/approve`,
  CEO_MONTHLY:             '/api/ceo/monthly',
  CEO_MONTHLY_APPROVE:     (monthKey: string) => `/api/ceo/monthly/${monthKey}/approve`,

  // Harvest
  HARVEST_LIST:            '/api/harvest',
  HARVEST_CREATE:          '/api/harvest',

  // Log Transport
  LOG_TRANSPORT_LIST:      '/api/log-transport',
  LOG_TRANSPORT_CREATE:    '/api/log-transport',

  // Sawmill
  SAWMILL_LIST:            '/api/sawmill',
  SAWMILL_CREATE:          '/api/sawmill',

  // Poles — purchase requests
  POLES_PURCHASE_LIST:     '/api/poles/purchase-requests',
  POLES_PURCHASE_CREATE:   '/api/poles/purchase-requests',
  // Poles — deliveries
  POLES_DELIVERY_LIST:     '/api/poles/deliveries',
  POLES_DELIVERY_CREATE:   '/api/poles/deliveries',
  POLES_DELIVERY_QC:       (id: number) => `/api/poles/deliveries/${id}/quality-check`,

  // Material requests
  // /approve handles both approve and reject — pass {action:'approve'|'reject', ...} in body
  MATERIAL_LIST:           '/api/material-requests',
  MATERIAL_CREATE:         '/api/material-requests',
  MATERIAL_APPROVE:        (id: number) => `/api/material-requests/${id}/approve`,

  // Casual labour
  // /review handles approve and reject — pass {status:'approved'|'rejected'} in body
  LABOUR_LIST:             '/api/casual-labour',
  LABOUR_CREATE:           '/api/casual-labour',
  LABOUR_REVIEW:           (id: number) => `/api/casual-labour/${id}/review`,

  // Deliveries
  DELIVERY_LIST:           '/api/deliveries',
  DELIVERY_POD:            (id: number) => `/api/deliveries/${id}/pod`,
  DELIVERY_STATUS:         (id: number) => `/api/deliveries/${id}/status`,

  // Machine logs
  MACHINE_LOG_LIST:        '/api/machine-logs',
  MACHINE_LOG_CREATE:      '/api/machine-logs',
  MACHINE_FUEL_ISSUED:     '/api/machine-logs/fuel-issued',

  // Machine fuel
  MACHINE_FUEL_LIST:       '/api/fuel/machine',
  MACHINE_FUEL_CREATE:     '/api/fuel/machine',

  // Vehicle fuel (logistics/admin only)
  VEHICLE_FUEL_LIST:       '/api/fuel/vehicle',
  VEHICLE_FUEL_CREATE:     '/api/fuel/vehicle',

  // My requests
  MY_REQUESTS:             '/api/my-requests',

  // Meta / lookup endpoints
  META_MACHINES:           '/api/meta/machines',
  META_MACHINE_FUEL_TARGETS: '/api/meta/machine-fuel-targets',
  META_MACHINE_LOG_CATEGORIES: '/api/meta/machine-log-categories',
  META_VEHICLES:           '/api/meta/vehicles',
  META_COMPARTMENTS:       '/api/meta/compartments',
  META_STOCK_ITEMS:        '/api/meta/stock-items',
  META_WAREHOUSES:         '/api/meta/warehouses',
  META_POLES_REQUESTS:     '/api/meta/poles-purchase-requests',
} as const;
