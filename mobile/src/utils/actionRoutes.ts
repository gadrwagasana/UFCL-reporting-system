import { PendingAction, PendingActionValue } from '../constants/dashboardEnums';

export interface ActionRoute {
  route:  string;
  params: Record<string, unknown>;
}

// Maps a PendingAction semantic value to a React Navigation route.
// Returns null when the action type has no dedicated mobile screen yet.
//
// ERP Remaining Departments Completion Program — 3 of these 7 route names
// (SalesOrderList, MaterialRequestList, StockTransferList, ChangeRequestList)
// did not match ANY registered route anywhere in navigation/types.ts (verified
// via a full-file grep) — every tap on the corresponding dashboard alert
// silently failed to navigate. Corrected to the real registered screen names
// (SalesOrdersList, MaterialRequestsList, StockTransfersList, Changes).
// DeliveryList/PolesDeliveryList/CasualLabourList were confirmed to already
// be real registered route names and are unchanged.
export function resolveActionRoute(action: PendingActionValue): ActionRoute | null {
  switch (action) {
    case PendingAction.DELIVERY_ASSIGNMENT:
      return { route: 'DeliveryList', params: { filter: 'unassigned' } };
    case PendingAction.SALES_CONFIRMATION:
      return { route: 'SalesOrdersList', params: { filter: 'pending' } };
    case PendingAction.MATERIAL_FULFILLMENT:
      return { route: 'MaterialRequestsList', params: { filter: 'pending' } };
    case PendingAction.LABOUR_REVIEW:
      return { route: 'CasualLabourList', params: { filter: 'pending' } };
    case PendingAction.POLES_QC:
      return { route: 'PolesDeliveryList', params: { filter: 'pending_qc' } };
    case PendingAction.STOCK_TRANSFER:
      return { route: 'StockTransfersList', params: { filter: 'pending' } };
    case PendingAction.CHANGE_REQUEST:
      return { route: 'Changes', params: {} };
    default:
      return null;
  }
}
