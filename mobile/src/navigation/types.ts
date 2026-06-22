import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { PolesRequest } from '../types/api';

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

// ─── Supervisor tabs ─────────────────────────────────────────────────────────
export type SupervisorTabParamList = {
  TodayDashboard: undefined;
  MaterialRequest:undefined;
  CasualLabour:   undefined;
  VehicleFuel:    undefined;
  MyRequests:     undefined;
};

// ─── Harvesting leader tabs ──────────────────────────────────────────────────
export type HarvestTabParamList = {
  HarvestList:       undefined;
  LogTransportList:  undefined;
  MaterialRequest:   undefined;
  CasualLabour:      undefined;
  MyRequests:        undefined;
};

// ─── Sawmill leader tabs ─────────────────────────────────────────────────────
export type SawmillTabParamList = {
  SawmillList:     undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  MyRequests:      undefined;
};

// ─── Poles leader tabs ───────────────────────────────────────────────────────
export type PolesTabParamList = {
  PolesList:       undefined;
  PolesPurchase:   undefined;
  PolesDelivery:   undefined;
  PolesQC:         undefined;
  MyRequests:      undefined;
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
