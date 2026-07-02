import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put } from '../api/client';
import { EP } from '../api/endpoints';
import {
  CustomerListResponse,
  CustomerDropdownResponse,
  CustomerPendingApproval,
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
