import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, patch } from '../api/client';
import { EP } from '../api/endpoints';
import {
  CustomerListResponse,
  CustomerDropdownResponse,
  CustomerPendingApproval,
  CustomerOrdersResponse,
} from '../types/api';

export function useCustomerList() {
  return useQuery<CustomerListResponse>({
    queryKey:  ['customers-list'],
    queryFn:   () => get<CustomerListResponse>(EP.CUSTOMERS_LIST),
    staleTime: 2 * 60_000,
  });
}

export function useCustomerDropdown() {
  return useQuery<CustomerDropdownResponse>({
    queryKey:  ['customers-dropdown'],
    queryFn:   () => get<CustomerDropdownResponse>(EP.CUSTOMERS_DROPDOWN),
    staleTime: 5 * 60_000,
  });
}

interface CustomerPayload {
  name:            string;
  contact_person?: string;
  phone?:          string;
  email?:          string;
  address?:        string;
  tin?:            string;
  notes?:          string;
}

export function useCustomerCreate() {
  const qc = useQueryClient();

  async function createCustomer(payload: CustomerPayload): Promise<void> {
    await post(EP.CUSTOMERS_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['customers-list'] });
    await qc.invalidateQueries({ queryKey: ['customers-dropdown'] });
  }

  return { createCustomer };
}

export function useCustomerUpdate() {
  const qc = useQueryClient();

  async function updateCustomer(
    id: number,
    payload: CustomerPayload,
  ): Promise<{ pendingApproval: true; level: string; message: string } | void> {
    const result = await put<CustomerPendingApproval>(EP.CUSTOMERS_UPDATE(id), payload);
    if (result && (result as CustomerPendingApproval).pendingApproval) {
      return result as CustomerPendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['customers-list'] });
    await qc.invalidateQueries({ queryKey: ['customers-dropdown'] });
  }

  return { updateCustomer };
}

// Sales Enterprise Phase 1 — closes the same gap as desktop's new
// Deactivate/Reactivate button: customers.active existed in the schema and
// was displayed but had no write path on either platform.
export function useCustomerToggle() {
  const qc = useQueryClient();

  async function toggleCustomer(id: number, reason: string): Promise<{ active: boolean }> {
    const result = await patch<{ ok: true; active: boolean }>(EP.CUSTOMERS_TOGGLE(id), { reason });
    await qc.invalidateQueries({ queryKey: ['customers-list'] });
    await qc.invalidateQueries({ queryKey: ['customers-dropdown'] });
    return { active: result.active };
  }

  return { toggleCustomer };
}

// ERP Final Enterprise Completion Gate — Customer History: confirmed no
// Customer Detail/order-history view existed on either platform.
export function useCustomerOrders(customerId: number) {
  return useQuery<CustomerOrdersResponse>({
    queryKey:  ['customer-orders', customerId],
    queryFn:   () => get<CustomerOrdersResponse>(EP.CUSTOMERS_ORDERS(customerId)),
    staleTime: 30_000,
    enabled:   customerId > 0,
  });
}
