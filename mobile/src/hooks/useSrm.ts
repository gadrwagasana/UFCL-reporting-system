import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { get, post, patch, del, upload, downloadFile } from '../api/client';
import { EP } from '../api/endpoints';
import type {
  ProcurementSupplierContract, SrmComplianceListItem, SrmComplianceMatrixRow,
  SrmDocument, SrmCommunication, SrmImprovementPlan, SrmDashboard, SrmReportResult, SrmReportType,
} from '../types/api';

interface ContractsResponse    { ok: true; rows: ProcurementSupplierContract[] }
interface ComplianceListResp   { ok: true; rows: SrmComplianceListItem[] }
interface ComplianceMatrixResp { ok: true; rows: SrmComplianceMatrixRow[] }
interface DocumentsResponse    { ok: true; rows: SrmDocument[] }
interface CommunicationsResp   { ok: true; rows: SrmCommunication[] }
interface ImprovementPlansResp { ok: true; rows: SrmImprovementPlan[] }
type DashboardResponse = { ok: true } & SrmDashboard;

// ── Contracts (cross-supplier register + governance) ─────────────────────────
export function useSrmContractsRegister(filters: { status?: string; category?: string; search?: string } = {}) {
  return useQuery<ContractsResponse>({
    queryKey: ['srm-contracts-register', filters],
    queryFn:  () => get<ContractsResponse>(EP.SRM_CONTRACTS_REGISTER, filters as Record<string, unknown>),
    staleTime: 60_000,
  });
}

// ── Compliance ────────────────────────────────────────────────────────────────
export function useSrmComplianceList(supplierId: number) {
  return useQuery<ComplianceListResp>({
    queryKey: ['srm-compliance-list', supplierId],
    queryFn:  () => get<ComplianceListResp>(EP.SRM_COMPLIANCE_LIST(supplierId)),
    enabled:  !!supplierId,
  });
}

export function useSrmComplianceRegister(filters: { status?: string; search?: string } = {}) {
  return useQuery<ComplianceMatrixResp>({
    queryKey: ['srm-compliance-register', filters],
    queryFn:  () => get<ComplianceMatrixResp>(EP.SRM_COMPLIANCE_REGISTER, filters as Record<string, unknown>),
    staleTime: 60_000,
  });
}

// ── Documents ─────────────────────────────────────────────────────────────────
export function useSrmDocuments(supplierId: number) {
  return useQuery<DocumentsResponse>({
    queryKey: ['srm-documents', supplierId],
    queryFn:  () => get<DocumentsResponse>(EP.SRM_DOCUMENTS_LIST(supplierId)),
    enabled:  !!supplierId,
  });
}

export function useSrmDocumentsRegister(filters: { documentType?: string; search?: string } = {}) {
  return useQuery<DocumentsResponse>({
    queryKey: ['srm-documents-register', filters],
    queryFn:  () => get<DocumentsResponse>(EP.SRM_DOCUMENTS_REGISTER, filters as Record<string, unknown>),
    staleTime: 60_000,
  });
}

// ── Communications ────────────────────────────────────────────────────────────
export function useSrmCommunications(supplierId: number) {
  return useQuery<CommunicationsResp>({
    queryKey: ['srm-communications', supplierId],
    queryFn:  () => get<CommunicationsResp>(EP.SRM_COMMUNICATIONS_LIST(supplierId)),
    enabled:  !!supplierId,
  });
}

export function useSrmCommunicationsRegister(filters: { communicationType?: string; search?: string } = {}) {
  return useQuery<CommunicationsResp>({
    queryKey: ['srm-communications-register', filters],
    queryFn:  () => get<CommunicationsResp>(EP.SRM_COMMUNICATIONS_REGISTER, filters as Record<string, unknown>),
    staleTime: 60_000,
  });
}

// ── Improvement Plans ─────────────────────────────────────────────────────────
export function useSrmImprovementPlans(supplierId: number) {
  return useQuery<ImprovementPlansResp>({
    queryKey: ['srm-improvement-plans', supplierId],
    queryFn:  () => get<ImprovementPlansResp>(EP.SRM_IMPROVEMENT_PLANS_LIST(supplierId)),
    enabled:  !!supplierId,
  });
}

export function useSrmImprovementPlansRegister(filters: { status?: string; search?: string } = {}) {
  return useQuery<ImprovementPlansResp>({
    queryKey: ['srm-improvement-plans-register', filters],
    queryFn:  () => get<ImprovementPlansResp>(EP.SRM_IMPROVEMENT_PLANS_REGISTER, filters as Record<string, unknown>),
    staleTime: 60_000,
  });
}

// ── Executive dashboard + reports ─────────────────────────────────────────────
export function useSrmDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: ['srm-dashboard'],
    queryFn:  () => get<DashboardResponse>(EP.SRM_DASHBOARD),
    staleTime: 60_000,
  });
}

export function useSrmReport(reportType: SrmReportType | null, filters: Record<string, unknown> = {}) {
  return useQuery<SrmReportResult>({
    queryKey: ['srm-report', reportType, filters],
    queryFn:  () => get<SrmReportResult>(EP.SRM_REPORT(reportType as string), filters),
    enabled:  !!reportType,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────────
export function useSrmActions() {
  const qc = useQueryClient();

  return {
    async approveContract(contractId: number, reason: string) {
      await post(EP.SRM_CONTRACT_APPROVE(contractId), { reason });
      await qc.invalidateQueries({ queryKey: ['srm-contracts-register'] });
    },
    async renewContract(contractId: number, payload: Partial<ProcurementSupplierContract>) {
      await post(EP.SRM_CONTRACT_RENEW(contractId), payload);
      await qc.invalidateQueries({ queryKey: ['srm-contracts-register'] });
    },

    async upsertCompliance(supplierId: number, payload: Partial<SrmComplianceListItem>) {
      await post(EP.SRM_COMPLIANCE_UPSERT(supplierId), payload);
      await qc.invalidateQueries({ queryKey: ['srm-compliance-list', supplierId] });
      await qc.invalidateQueries({ queryKey: ['srm-compliance-register'] });
      await qc.invalidateQueries({ queryKey: ['srm-dashboard'] });
    },

    async createCommunication(supplierId: number, payload: Partial<SrmCommunication>) {
      await post(EP.SRM_COMMUNICATION_CREATE(supplierId), payload);
      await qc.invalidateQueries({ queryKey: ['srm-communications', supplierId] });
      await qc.invalidateQueries({ queryKey: ['srm-communications-register'] });
    },
    async updateCommunication(supplierId: number, communicationId: number, payload: Partial<SrmCommunication>) {
      await patch(EP.SRM_COMMUNICATION_UPDATE(communicationId), payload);
      await qc.invalidateQueries({ queryKey: ['srm-communications', supplierId] });
      await qc.invalidateQueries({ queryKey: ['srm-communications-register'] });
    },

    async createImprovementPlan(supplierId: number, payload: Partial<SrmImprovementPlan>) {
      await post(EP.SRM_IMPROVEMENT_PLAN_CREATE(supplierId), payload);
      await qc.invalidateQueries({ queryKey: ['srm-improvement-plans', supplierId] });
      await qc.invalidateQueries({ queryKey: ['srm-improvement-plans-register'] });
      await qc.invalidateQueries({ queryKey: ['srm-dashboard'] });
    },
    async updateImprovementPlan(supplierId: number, planId: number, payload: Partial<SrmImprovementPlan>) {
      await patch(EP.SRM_IMPROVEMENT_PLAN_UPDATE(planId), payload);
      await qc.invalidateQueries({ queryKey: ['srm-improvement-plans', supplierId] });
      await qc.invalidateQueries({ queryKey: ['srm-improvement-plans-register'] });
      await qc.invalidateQueries({ queryKey: ['srm-dashboard'] });
    },

    async uploadDocument(supplierId: number, file: { uri: string; name: string; mimeType?: string | null }, meta: {
      document_type?: string; contract_id?: number; compliance_id?: number; expiry_date?: string; notes?: string;
    }) {
      const form = new FormData();
      // RN's FormData accepts this { uri, name, type } shape directly — it is
      // not a spec-compliant web File/Blob, hence the `as any` cast.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
      if (meta.document_type) form.append('document_type', meta.document_type);
      if (meta.contract_id != null) form.append('contract_id', String(meta.contract_id));
      if (meta.compliance_id != null) form.append('compliance_id', String(meta.compliance_id));
      if (meta.expiry_date) form.append('expiry_date', meta.expiry_date);
      if (meta.notes) form.append('notes', meta.notes);
      await upload(EP.SRM_DOCUMENT_UPLOAD(supplierId), form);
      await qc.invalidateQueries({ queryKey: ['srm-documents', supplierId] });
      await qc.invalidateQueries({ queryKey: ['srm-documents-register'] });
      await qc.invalidateQueries({ queryKey: ['srm-dashboard'] });
    },
    async downloadDocument(documentId: number, filename: string) {
      const localUri = await downloadFile(EP.SRM_DOCUMENT_FILE(documentId), filename);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(localUri);
      return localUri;
    },
    async deleteDocument(supplierId: number, documentId: number, reason?: string) {
      await del(EP.SRM_DOCUMENT_DELETE(documentId), { reason });
      await qc.invalidateQueries({ queryKey: ['srm-documents', supplierId] });
      await qc.invalidateQueries({ queryKey: ['srm-documents-register'] });
    },
  };
}
