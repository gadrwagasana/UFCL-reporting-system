import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type {
  PolesRequest, PolesDelivery, MaterialRequest, CasualLabourRequest,
  HarvestEntry, LogTransportEntry, DailyLog,
  VatInboundEntry, VatEntry,
} from '../types/api';

// ─── Root stack ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Splash: undefined;
  Auth:   undefined;
  Main:   undefined;
};

// ─── Auth stack ───────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
};

// ─── CEO Approvals stack (nested in CEO Approvals tab) ───────────────────────
export type CeoApprovalsStackParamList = {
  PendingApprovals: undefined;
  ApprovalDetail:   { item: PolesRequest };
};

// ─── CEO / Admin tabs ─────────────────────────────────────────────────────────
export type CeoTabParamList = {
  CeoOverview:  undefined;
  CeoApprovals: undefined;
  Profile:      undefined;
};

// ─── Material Requests stack (shared across role navigators) ─────────────────
export type MaterialRequestsStackParamList = {
  MaterialRequestsList:  undefined;
  MaterialRequestCreate: undefined;
  MaterialRequestDetail: { item: MaterialRequest };
};

// ─── Casual Labour stack (shared across role navigators) ─────────────────────
export type CasualLabourStackParamList = {
  CasualLabourList:   undefined;
  CasualLabourCreate: undefined;
  CasualLabourDetail: { item: CasualLabourRequest };
};

// ─── Supervisor tabs ─────────────────────────────────────────────────────────
export type SupervisorTabParamList = {
  TodayDashboard: undefined;
  MaterialRequest: undefined;
  CasualLabour:   undefined;
  VehicleFuel:    undefined;
  MyRequests:     undefined;
  Profile:        undefined;
};

// ─── Harvesting leader tabs ──────────────────────────────────────────────────
export type HarvestTabParamList = {
  HarvestList:       undefined;
  LogTransportList:  undefined;
  MaterialRequest:   undefined;
  CasualLabour:      undefined;
  MyRequests:        undefined;
  Profile:           undefined;
};

// ─── Sawmill leader tabs ─────────────────────────────────────────────────────
export type SawmillTabParamList = {
  SawmillList:     undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  MyRequests:      undefined;
  Profile:         undefined;
};

// ─── Poles leader tabs ───────────────────────────────────────────────────────
export type PolesTabParamList = {
  PolesList:       undefined;
  PolesPurchase:   undefined;
  PolesDelivery:   undefined;
  PolesQC:         undefined;
  MyRequests:      undefined;
  Profile:         undefined;
};

// ─── VAT leader tabs ─────────────────────────────────────────────────────────
export type VatTabParamList = {
  VatInbound:      undefined;
  VatEntries:      undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  MyRequests:      undefined;
  Profile:         undefined;
};

// ─── Mechanician tabs ────────────────────────────────────────────────────────
export type MechanicianTabParamList = {
  MachineLogList:  undefined;
  MachineFuelList: undefined;
  MyRequests:      undefined;
};

// ─── Operations tabs ─────────────────────────────────────────────────────────
export type OperationsTabParamList = {
  PendingReviews:  undefined;
  MaterialReview:  undefined;
  LabourReview:    undefined;
  MyRequests:      undefined;
};

// ─── Logistics tabs ──────────────────────────────────────────────────────────
export type LogisticsTabParamList = {
  DeliveryList:    undefined;
  MyRequests:      undefined;
};

// ─── Sales tabs ──────────────────────────────────────────────────────────────
export type SalesTabParamList = {
  DeliveryStatus:  undefined;
  MyRequests:      undefined;
};

// ─── Storekeeper tabs ────────────────────────────────────────────────────────
export type StorekeeperTabParamList = {
  MaterialReview:  undefined;
  MyRequests:      undefined;
};

// ─── Convenience screen prop types ───────────────────────────────────────────
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type CeoTabScreenProps<T extends keyof CeoTabParamList> =
  BottomTabScreenProps<CeoTabParamList, T>;

export type CeoApprovalsStackScreenProps<T extends keyof CeoApprovalsStackParamList> =
  NativeStackScreenProps<CeoApprovalsStackParamList, T>;

export type MaterialRequestsStackScreenProps<T extends keyof MaterialRequestsStackParamList> =
  NativeStackScreenProps<MaterialRequestsStackParamList, T>;

export type CasualLabourStackScreenProps<T extends keyof CasualLabourStackParamList> =
  NativeStackScreenProps<CasualLabourStackParamList, T>;

// ─── Harvest stack ────────────────────────────────────────────────────────────
export type HarvestStackParamList = {
  HarvestList:   undefined;
  HarvestCreate: undefined;
  HarvestDetail: { entry: HarvestEntry };
};

export type HarvestStackScreenProps<T extends keyof HarvestStackParamList> =
  NativeStackScreenProps<HarvestStackParamList, T>;

// ─── Log Transport stack ──────────────────────────────────────────────────────
export type LogTransportStackParamList = {
  LogTransportList:   undefined;
  LogTransportCreate: undefined;
  LogTransportDetail: { entry: LogTransportEntry };
};

export type LogTransportStackScreenProps<T extends keyof LogTransportStackParamList> =
  NativeStackScreenProps<LogTransportStackParamList, T>;

// ─── Sawmill Production stack ─────────────────────────────────────────────────
export type SawmillStackParamList = {
  SawmillProductionList:   undefined;
  SawmillProductionCreate: undefined;
  SawmillProductionDetail: { entry: DailyLog };
};

export type SawmillStackScreenProps<T extends keyof SawmillStackParamList> =
  NativeStackScreenProps<SawmillStackParamList, T>;

// ─── Poles Production stack ───────────────────────────────────────────────────
export type PolesProductionStackParamList = {
  PolesProductionList:   undefined;
  PolesProductionCreate: undefined;
  PolesProductionDetail: { entry: DailyLog };
};

export type PolesProductionStackScreenProps<T extends keyof PolesProductionStackParamList> =
  NativeStackScreenProps<PolesProductionStackParamList, T>;

// ─── Poles Purchase stack ─────────────────────────────────────────────────────
export type PolesPurchaseStackParamList = {
  PolesPurchaseList:   undefined;
  PolesPurchaseCreate: undefined;
};

export type PolesPurchaseStackScreenProps<T extends keyof PolesPurchaseStackParamList> =
  NativeStackScreenProps<PolesPurchaseStackParamList, T>;

// ─── Poles Delivery stack ─────────────────────────────────────────────────────
export type PolesDeliveryStackParamList = {
  PolesDeliveryList:   undefined;
  PolesDeliveryCreate: undefined;
};

export type PolesDeliveryStackScreenProps<T extends keyof PolesDeliveryStackParamList> =
  NativeStackScreenProps<PolesDeliveryStackParamList, T>;

// ─── Poles QC stack ───────────────────────────────────────────────────────────
export type PolesQCStackParamList = {
  PolesQCList:   undefined;
  PolesQCDetail: { delivery: PolesDelivery };
};

export type PolesQCStackScreenProps<T extends keyof PolesQCStackParamList> =
  NativeStackScreenProps<PolesQCStackParamList, T>;

// ─── VAT Inbound stack ────────────────────────────────────────────────────────
export type VatInboundStackParamList = {
  VatInboundList:  undefined;
  VatIntakeCreate: { transferId: number; productSize: string; available: number };
};

export type VatInboundStackScreenProps<T extends keyof VatInboundStackParamList> =
  NativeStackScreenProps<VatInboundStackParamList, T>;

// ─── VAT Entries stack ────────────────────────────────────────────────────────
export type VatEntriesStackParamList = {
  VatProcessingList: undefined;
  VatDetail:         { entry: VatEntry };
};

export type VatEntriesStackScreenProps<T extends keyof VatEntriesStackParamList> =
  NativeStackScreenProps<VatEntriesStackParamList, T>;
