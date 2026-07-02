// Mirror of mobile-api/constants/dashboardEnums.js — kept in sync manually.
// Server is the source of truth; mobile only renders using these values.

export const TrendDirection = {
  UP:        'up',
  DOWN:      'down',
  UNCHANGED: 'unchanged',
} as const;
export type TrendDirectionValue = typeof TrendDirection[keyof typeof TrendDirection];

export const ActivityType = {
  SALES_ORDER:        'sales_order',
  DELIVERY:           'delivery',
  HARVEST_LOG:        'harvest_log',
  SAWMILL_LOG:        'sawmill_log',
  POLES_LOG:          'poles_log',
  MATERIAL_REQUEST:   'material_request',
  CASUAL_LABOUR:      'casual_labour',
  MACHINE_LOG:        'machine_log',
  FUEL_LOG:           'fuel_log',
  STOCK_MOVEMENT_IN:  'stock_movement_in',
  STOCK_MOVEMENT_OUT: 'stock_movement_out',
  USER_LOGIN:         'user_login',
  CHANGE_REQUEST:     'change_request',
  APPROVAL:           'approval',
} as const;
export type ActivityTypeValue = typeof ActivityType[keyof typeof ActivityType];

export const PendingAction = {
  DELIVERY_ASSIGNMENT: 'delivery_assignment',
  SALES_CONFIRMATION:  'sales_confirmation',
  MATERIAL_FULFILLMENT:'material_fulfillment',
  LABOUR_REVIEW:       'labour_review',
  POLES_QC:            'poles_qc',
  STOCK_TRANSFER:      'stock_transfer',
  CHANGE_REQUEST:      'change_request',
} as const;
export type PendingActionValue = typeof PendingAction[keyof typeof PendingAction];

export const Priority = {
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
} as const;
export type PriorityValue = typeof Priority[keyof typeof Priority];

export const DowntimeStatus = {
  REVIEW_REQUIRED: 'review_required',
  WITHIN_TARGET:   'within_target',
} as const;
export type DowntimeStatusValue = typeof DowntimeStatus[keyof typeof DowntimeStatus];
