// Central list of all API endpoint paths.
// Base URL is injected by the Axios client.
export const EP = {
  // Auth
  AUTH_LOGIN:         '/api/auth/login',
  AUTH_ME:            '/api/auth/me',
  AUTH_CHANGE_PW:     '/api/auth/change-password',

  // CEO
  CEO_OVERVIEW:       '/api/ceo/overview',
  CEO_POLES_REQUESTS: '/api/ceo/poles-requests',
  CEO_POLES_APPROVE:  (id: number) => `/api/ceo/poles-requests/${id}/approve`,
  CEO_POLES_REJECT:   (id: number) => `/api/ceo/poles-requests/${id}/reject`,
  CEO_MONTHLY_STATUS: '/api/ceo/monthly-status',
  CEO_MONTHLY_APPROVE:'/api/ceo/monthly-approve',

  // Harvest
  HARVEST_LIST:       '/api/harvest',
  HARVEST_CREATE:     '/api/harvest',

  // Log Transport
  LOG_TRANSPORT_LIST: '/api/log-transport',
  LOG_TRANSPORT_CREATE:'/api/log-transport',

  // Sawmill
  SAWMILL_LIST:       '/api/sawmill',
  SAWMILL_CREATE:     '/api/sawmill',

  // Poles
  POLES_LIST:         '/api/poles',
  POLES_CREATE:       '/api/poles',
  POLES_PURCHASE_LIST:'/api/poles/purchases',
  POLES_PURCHASE_CREATE:'/api/poles/purchases',
  POLES_DELIVERY_LIST:'/api/poles/deliveries',
  POLES_DELIVERY_CREATE:'/api/poles/deliveries',
  POLES_QC_LIST:      '/api/poles/qc',
  POLES_QC_CREATE:    '/api/poles/qc',

  // Material requests
  MATERIAL_LIST:      '/api/material-requests',
  MATERIAL_CREATE:    '/api/material-requests',
  MATERIAL_APPROVE:   (id: number) => `/api/material-requests/${id}/approve`,
  MATERIAL_REJECT:    (id: number) => `/api/material-requests/${id}/reject`,

  // Casual labour
  LABOUR_LIST:        '/api/casual-labour',
  LABOUR_CREATE:      '/api/casual-labour',
  LABOUR_APPROVE:     (id: number) => `/api/casual-labour/${id}/approve`,
  LABOUR_REJECT:      (id: number) => `/api/casual-labour/${id}/reject`,

  // Deliveries
  DELIVERY_LIST:      '/api/deliveries',
  DELIVERY_POD:       (id: number) => `/api/deliveries/${id}/pod`,
  DELIVERY_STATUS:    (id: number) => `/api/deliveries/${id}/status`,

  // Machine logs
  MACHINE_LOG_LIST:   '/api/machine-logs',
  MACHINE_LOG_CREATE: '/api/machine-logs',
  MACHINE_FUEL_ISSUED:'/api/machine-logs/fuel-issued',

  // Vehicle fuel
  VEHICLE_FUEL_LIST:  '/api/vehicle-fuel',
  VEHICLE_FUEL_CREATE:'/api/vehicle-fuel',

  // Workshop (fuel — machine fuel consumed)
  MACHINE_FUEL_LIST:  '/api/machine-logs',

  // My requests
  MY_REQUESTS:        '/api/my-requests',

  // Common lookups
  MACHINES_LIST:      '/api/machines',
  VEHICLES_LIST:      '/api/vehicles',
  WORKERS_LIST:       '/api/workers',
  ITEMS_LIST:         '/api/items',
} as const;
