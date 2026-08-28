import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '../api/client';
import { EP } from '../api/endpoints';
import type { ProcurementSupplier, ProcurementSupplierContact, ProcurementSupplierContract } from '../types/api';

interface SuppliersResponse { ok: true; rows: ProcurementSupplier[] }
interface ContactsResponse { ok: true; rows: ProcurementSupplierContact[] }
interface ContractsResponse { ok: true; rows: ProcurementSupplierContract[] }
interface PerformanceResponse { ok: true; totalPos: number; totalReceipts: number; rejectRatePct: number }

export function useProcurementSuppliers(filters: { active?: boolean; category?: string; blacklisted?: boolean } = {}) {
  return useQuery<SuppliersResponse>({
    queryKey: ['procurement-suppliers', filters],
    queryFn:  () => get<SuppliersResponse>(EP.PROCUREMENT_SUPPLIERS, filters as Record<string, unknown>),
    staleTime: 60_000,
  });
}

export function useProcurementSupplierContacts(supplierId: number) {
  return useQuery<ContactsResponse>({
    queryKey: ['procurement-supplier-contacts', supplierId],
    queryFn:  () => get<ContactsResponse>(EP.PROCUREMENT_SUPPLIER_CONTACTS(supplierId)),
    enabled:  !!supplierId,
  });
}

export function useProcurementSupplierContracts(supplierId: number) {
  return useQuery<ContractsResponse>({
    queryKey: ['procurement-supplier-contracts', supplierId],
    queryFn:  () => get<ContractsResponse>(EP.PROCUREMENT_SUPPLIER_CONTRACTS(supplierId)),
    enabled:  !!supplierId,
  });
}

export function useProcurementSupplierPerformance(supplierId: number) {
  return useQuery<PerformanceResponse>({
    queryKey: ['procurement-supplier-performance', supplierId],
    queryFn:  () => get<PerformanceResponse>(EP.PROCUREMENT_SUPPLIER_PERFORMANCE(supplierId)),
    enabled:  !!supplierId,
  });
}

export function useProcurementSupplierActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['procurement-suppliers'] });

  return {
    async create(payload: Partial<ProcurementSupplier>) {
      await post(EP.PROCUREMENT_SUPPLIERS, payload);
      await invalidate();
    },
    async update(id: number, payload: Partial<ProcurementSupplier>) {
      await patch(EP.PROCUREMENT_SUPPLIER(id), payload);
      await invalidate();
    },
    async toggleBlacklist(id: number, blacklisted: boolean, reason: string) {
      await post(EP.PROCUREMENT_SUPPLIER_BLACKLIST(id), { blacklisted, reason });
      await invalidate();
    },
    // Generic lifecycle transition — activate/deactivate(suspend)/restore/
    // archive all call this with the target status string, matching the
    // single procurementSupplierSetStatus backend function (Phase 3B).
    async setStatus(id: number, status: string, reason: string) {
      await post(EP.PROCUREMENT_SUPPLIER_STATUS(id), { status, reason });
      await invalidate();
    },
    async remove(id: number) {
      await del(EP.PROCUREMENT_SUPPLIER(id));
      await invalidate();
    },
    async addContact(supplierId: number, payload: Partial<ProcurementSupplierContact>) {
      await post(EP.PROCUREMENT_SUPPLIER_CONTACTS(supplierId), payload);
      await qc.invalidateQueries({ queryKey: ['procurement-supplier-contacts', supplierId] });
    },
    async updateContact(supplierId: number, contactId: number, payload: Partial<ProcurementSupplierContact>) {
      await patch(EP.PROCUREMENT_SUPPLIER_CONTACT(contactId), payload);
      await qc.invalidateQueries({ queryKey: ['procurement-supplier-contacts', supplierId] });
    },
    async removeContact(supplierId: number, contactId: number) {
      await del(EP.PROCUREMENT_SUPPLIER_CONTACT(contactId));
      await qc.invalidateQueries({ queryKey: ['procurement-supplier-contacts', supplierId] });
    },
    async addContract(supplierId: number, payload: Partial<ProcurementSupplierContract>) {
      await post(EP.PROCUREMENT_SUPPLIER_CONTRACTS(supplierId), payload);
      await qc.invalidateQueries({ queryKey: ['procurement-supplier-contracts', supplierId] });
    },
    async updateContract(supplierId: number, contractId: number, payload: Partial<ProcurementSupplierContract>) {
      await patch(EP.PROCUREMENT_SUPPLIER_CONTRACT(contractId), payload);
      await qc.invalidateQueries({ queryKey: ['procurement-supplier-contracts', supplierId] });
    },
    // Contract deletion is intentionally unsupported — no backend function
    // exists for it (see SUPPLIER_VENDOR_PHASE3_AUDIT.md §1).
  };
}
