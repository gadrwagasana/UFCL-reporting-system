import { PendingAction, PendingActionValue } from '../constants/dashboardEnums';

export interface ActionRoute {
  route:  string;
  params: Record<string, unknown>;
}

// Maps a PendingAction semantic value to a React Navigation route.
// Returns null when the action type has no dedicated mobile screen yet.
export function resolveActionRoute(action: PendingActionValue): ActionRoute | null {
  switch (action) {
    case PendingAction.DELIVERY_ASSIGNMENT:
      return { route: 'DeliveryList', params: { filter: 'unassigned' } };
    case PendingAction.SALES_CONFIRMATION:
      return { route: 'SalesOrderList', params: { filter: 'pending' } };
    case PendingAction.MATERIAL_FULFILLMENT:
      return { route: 'MaterialRequestList', params: { filter: 'pending' } };
    case PendingAction.LABOUR_REVIEW:
      return { route: 'CasualLabourList', params: { filter: 'pending' } };
    case PendingAction.POLES_QC:
      return { route: 'PolesDeliveryList', params: { filter: 'pending_qc' } };
    case PendingAction.STOCK_TRANSFER:
      return { route: 'StockTransferList', params: { filter: 'pending' } };
    case PendingAction.CHANGE_REQUEST:
      return { route: 'ChangeRequestList', params: {} };
    default:
      return null;
  }
}
