'use strict';

const TrendDirection = Object.freeze({
  UP:        'up',
  DOWN:      'down',
  UNCHANGED: 'unchanged',
});

const DowntimeStatus = Object.freeze({
  REVIEW_REQUIRED: 'review_required',
  WITHIN_TARGET:   'within_target',
});

const Priority = Object.freeze({
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
});

const ActivityType = Object.freeze({
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
});

const PendingAction = Object.freeze({
  DELIVERY_ASSIGNMENT:  'delivery_assignment',
  SALES_CONFIRMATION:   'sales_confirmation',
  MATERIAL_FULFILLMENT: 'material_fulfillment',
  LABOUR_REVIEW:        'labour_review',
  POLES_QC:             'poles_qc',
  STOCK_TRANSFER:       'stock_transfer',
  CHANGE_REQUEST:       'change_request',
});

module.exports = { TrendDirection, DowntimeStatus, Priority, ActivityType, PendingAction };
