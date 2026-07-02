// Central list of all API endpoint paths.
// Base URL is injected by the Axios client.
export const EP = {
  // Auth
  AUTH_LOGIN:              '/api/auth/login',
  AUTH_ME:                 '/api/auth/me',

  // Dashboard — general stats (multi-role) + logistics warehouse view
  DASHBOARD_STATS:         '/api/dashboard/stats',
  LOGISTICS_DASHBOARD:     '/api/logistics/dashboard',

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

  // VAT (value-added timber)
  VAT_INBOUND:             '/api/vat/inbound',
  VAT_LIST:                '/api/vat',
  VAT_CREATE:              '/api/vat',

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
  DELIVERY_CREATE:         '/api/deliveries',
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

  // Notifications
  NOTIFICATIONS_LIST:      '/api/notifications',
  NOTIFICATIONS_POLL:      '/api/notifications/poll',
  NOTIFICATIONS_MARK_READ: (id: number) => `/api/notifications/${id}/read`,
  NOTIFICATIONS_MARK_ALL:  '/api/notifications/read-all',

  // Products
  PRODUCTS_LIST:          (filter?: string) => `/api/products${filter ? `?filter=${filter}` : ''}`,
  PRODUCTS_CREATE:        '/api/products',
  PRODUCTS_UPDATE:        (id: number) => `/api/products/${id}`,
  PRODUCTS_TOGGLE:        (id: number) => `/api/products/${id}/toggle`,
  PRODUCTS_ACTIVE:        (type: string) => `/api/products/active?type=${type}`,
  PRODUCTS_SALES_DROPDOWN:'/api/products/sales-dropdown',

  // Vehicles
  VEHICLES_LIST:                '/api/vehicles',
  VEHICLES_DETAIL:              (id: number) => `/api/vehicles/${id}`,
  VEHICLES_CREATE:              '/api/vehicles',
  VEHICLES_UPDATE:              (id: number) => `/api/vehicles/${id}`,
  VEHICLES_DELETE:              (id: number) => `/api/vehicles/${id}`,
  VEHICLES_FUEL_LOG_CREATE:     (id: number) => `/api/vehicles/${id}/fuel-logs`,
  VEHICLES_FUEL_LOG_DELETE:     (logId: number) => `/api/vehicles/fuel-logs/${logId}`,
  VEHICLES_MAINTENANCE_CREATE:  (id: number) => `/api/vehicles/${id}/maintenance`,
  VEHICLES_MAINTENANCE_DELETE:  (recordId: number) => `/api/vehicles/maintenance/${recordId}`,
  VEHICLES_TRANSPORT_DROPDOWN:  '/api/vehicles/transport-dropdown',

  // Machines (registry)
  MACHINES_LIST:                   '/api/machines',
  MACHINES_DETAIL:                 (id: number) => `/api/machines/${id}`,
  MACHINES_CREATE:                 '/api/machines',
  MACHINES_UPDATE:                 (id: number) => `/api/machines/${id}`,
  MACHINES_CATEGORIES:             '/api/machines/categories',
  MACHINES_CATEGORY_UPDATE:        (catId: number) => `/api/machines/categories/${catId}`,
  MACHINES_CATEGORY_DELETE:        (catId: number) => `/api/machines/categories/${catId}`,
  MACHINES_MAINT_SCHEDULE_CREATE:  (id: number) => `/api/machines/${id}/maint-schedules`,

  // Stock Transfers
  STOCK_TRANSFERS_LIST:     '/api/stock-transfers',
  STOCK_TRANSFERS_CREATE:   '/api/stock-transfers',
  STOCK_TRANSFERS_APPROVE:  (id: number) => `/api/stock-transfers/${id}/approve`,
  STOCK_TRANSFERS_DISPATCH: (id: number) => `/api/stock-transfers/${id}/dispatch`,
  STOCK_TRANSFERS_RECEIVE:  (id: number) => `/api/stock-transfers/${id}/receive`,
  STOCK_TRANSFERS_HISTORY:  (id: number) => `/api/stock-transfers/${id}/history`,

  // Dispatch
  DISPATCH_LIST:   '/api/dispatch',
  DISPATCH_CREATE: '/api/dispatch',
  DISPATCH_REVIEW: (id: number) => `/api/dispatch/${id}`,
  DISPATCH_DELETE: (id: number) => `/api/dispatch/${id}`,

  // Timber Inventory
  TIMBER_INVENTORY: '/api/timber-inventory',

  // Stock Management
  STOCK_ITEMS:                   '/api/stock',
  STOCK_ITEMS_CREATE:            '/api/stock',
  STOCK_ITEMS_UPDATE:            (id: number) => `/api/stock/${id}`,
  STOCK_ITEMS_DELETE:            (id: number) => `/api/stock/${id}`,
  STOCK_CATEGORIES:              '/api/stock/categories',
  STOCK_CATEGORIES_CREATE:       '/api/stock/categories',
  STOCK_CATEGORIES_DELETE:       (id: number) => `/api/stock/categories/${id}`,
  STOCK_INVENTORY:               '/api/stock/inventory',
  STOCK_MOVEMENTS:               '/api/stock/movements',
  STOCK_MOVEMENTS_CREATE:        '/api/stock/movements',
  STOCK_MOVEMENTS_DELETE:        (id: number) => `/api/stock/movements/${id}`,

  // Compartments
  COMPARTMENTS_LIST:   '/api/compartments',
  COMPARTMENTS_CREATE: '/api/compartments',
  COMPARTMENTS_UPDATE: (id: number) => `/api/compartments/${id}`,
  COMPARTMENTS_DELETE: (id: number) => `/api/compartments/${id}`,

  // Workshops
  WORKSHOPS_OVERVIEW:          '/api/workshops/overview',
  WORKSHOPS_LIST:              '/api/workshops',
  WORKSHOPS_CREATE:            '/api/workshops',
  WORKSHOPS_UPDATE:            (id: number) => `/api/workshops/${id}`,
  WORKSHOPS_DELETE:            (id: number) => `/api/workshops/${id}`,
  WORKSHOPS_TRANSFER_APPROVE:  (movementId: number) => `/api/workshops/transfers/${movementId}/approve`,

  // Customers
  CUSTOMERS_LIST:     '/api/customers',
  CUSTOMERS_CREATE:   '/api/customers',
  CUSTOMERS_UPDATE:   (id: number) => `/api/customers/${id}`,
  CUSTOMERS_DROPDOWN: '/api/customers/dropdown',

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
