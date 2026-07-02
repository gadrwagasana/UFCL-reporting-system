import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type {
  PolesRequest, PolesDelivery, MaterialRequest, CasualLabourRequest,
  HarvestEntry, LogTransportEntry, DailyLog,
  VatInboundEntry, VatEntry,
  DeliveryOrder, FuelLog, MachineFuelLog, MachineLog,
  Customer, Product, Vehicle, Machine, Workshop, Compartment,
  StockItem, WarehouseRef,
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

// ─── Products stack ──────────────────────────────────────────────────────────
export type ProductsStackParamList = {
  ProductsList: undefined;
  ProductForm:  { product?: Product };
};

// ─── Compartments stack ───────────────────────────────────────────────────────
export type CompartmentsStackParamList = {
  CompartmentsList: undefined;
  CompartmentForm:  { compartment?: Compartment };
};

// ─── Timber Inventory stack ───────────────────────────────────────────────────
export type TimberInventoryStackParamList = {
  TimberInventoryDashboard: undefined;
};

// ─── Stock Management stacks ──────────────────────────────────────────────────
export type StockCatalogStackParamList = {
  StockCatalogList: undefined;
  StockItemForm:    { item?: StockItem };
  StockCategories:  undefined;
};
export type StockInventoryStackParamList = {
  StockInventoryList: undefined;
};
export type StockMovementsStackParamList = {
  StockMovementsList: undefined;
  StockMovementForm:  { items: StockItem[]; warehouses: WarehouseRef[]; userWorkshopId?: number };
};

// ─── Workshop Overview stack ──────────────────────────────────────────────────
export type WorkshopOverviewStackParamList = {
  WorkshopOverview: undefined;
};

// ─── Workshop Management stack ────────────────────────────────────────────────
export type WorkshopManagementStackParamList = {
  WorkshopsList: undefined;
  WorkshopForm:  { workshop?: Workshop };
};

// ─── Machines stack ───────────────────────────────────────────────────────────
export type MachinesStackParamList = {
  MachinesList:                undefined;
  MachineDetail:               { machineId: number };
  MachineForm:                 { machine?: Machine };
  MachineMaintScheduleCreate:  { machineId: number; machineName: string };
  MachineCategories:           undefined;
};

// ─── Vehicles stack ───────────────────────────────────────────────────────────
export type VehiclesStackParamList = {
  VehiclesList:             undefined;
  VehicleDetail:            { vehicleId: number };
  VehicleForm:              { vehicle?: Vehicle };
  VehicleFuelLogCreate:     { vehicleId: number; registration: string };
  VehicleMaintenanceCreate: { vehicleId: number; registration: string };
};

// ─── Customers stack ─────────────────────────────────────────────────────────
export type CustomersStackParamList = {
  CustomersList: undefined;
  CustomerForm:  { customer?: Customer };
};

// ─── CEO / Admin tabs ─────────────────────────────────────────────────────────
export type CeoTabParamList = {
  Dashboard:          undefined;
  CeoOverview:        undefined;
  CeoApprovals:       undefined;
  Customers:          undefined;
  Products:           undefined;
  Vehicles:           undefined;
  Machines:           undefined;
  WorkshopOverview:   undefined;
  WorkshopManagement: undefined;
  Compartments:       undefined;
  StockCatalog:       undefined;
  StockInventory:     undefined;
  StockMovements:     undefined;
  TimberInventory:    undefined;
  Notifications:      undefined;
  Profile:            undefined;
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
  TodayDashboard:  undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  Compartments:    undefined;
  StockMovements:  undefined;
  TimberInventory: undefined;
  MyRequests:      undefined;
  Profile:         undefined;
};

// ─── Harvesting leader tabs ──────────────────────────────────────────────────
export type HarvestTabParamList = {
  HarvestList:       undefined;
  LogTransportList:  undefined;
  MaterialRequest:   undefined;
  CasualLabour:      undefined;
  StockMovements:    undefined;
  MyRequests:        undefined;
  Profile:           undefined;
};

// ─── Sawmill leader tabs ─────────────────────────────────────────────────────
export type SawmillTabParamList = {
  SawmillList:     undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  StockMovements:  undefined;
  MyRequests:      undefined;
  Profile:         undefined;
};

// ─── Poles leader tabs ───────────────────────────────────────────────────────
export type PolesTabParamList = {
  PolesList:       undefined;
  PolesPurchase:   undefined;
  PolesDelivery:   undefined;
  PolesQC:         undefined;
  MaterialRequest: undefined;
  StockMovements:  undefined;
  MyRequests:      undefined;
  Profile:         undefined;
};

// ─── VAT leader tabs ─────────────────────────────────────────────────────────
export type VatTabParamList = {
  VatInbound:      undefined;
  VatEntries:      undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  StockMovements:  undefined;
  MyRequests:      undefined;
  Profile:         undefined;
};

// ─── Harvest Supervisor tabs ──────────────────────────────────────────────────
export type HarvestSupervisorTabParamList = {
  HarvestList:      undefined;
  LogTransportList: undefined;
  Profile:          undefined;
};

// ─── Sawmill Supervisor tabs ──────────────────────────────────────────────────
export type SawmillSupervisorTabParamList = {
  SawmillList: undefined;
  Profile:     undefined;
};

// ─── Poles Supervisor tabs ────────────────────────────────────────────────────
export type PolesSupervisorTabParamList = {
  PolesList:    undefined;
  PolesDelivery: undefined;
  Profile:      undefined;
};

// ─── VAT Supervisor tabs ──────────────────────────────────────────────────────
export type VatSupervisorTabParamList = {
  VatInbound: undefined;
  VatEntries: undefined;
  Profile:    undefined;
};

// ─── Mechanician tabs ────────────────────────────────────────────────────────
export type MechanicianTabParamList = {
  MachineLogList:  undefined;
  MachineFuelList: undefined;
  MyRequests:      undefined;
};

// ─── Operations tabs ─────────────────────────────────────────────────────────
export type OperationsTabParamList = {
  Dashboard:          undefined;
  PendingReviews:     undefined;
  MaterialReview:     undefined;
  LabourReview:       undefined;
  Customers:          undefined;
  Products:           undefined;
  Machines:           undefined;
  WorkshopOverview:   undefined;
  WorkshopManagement: undefined;
  Compartments:       undefined;
  StockCatalog:       undefined;
  StockInventory:     undefined;
  StockMovements:     undefined;
  TimberInventory:    undefined;
  MyRequests:         undefined;
};

// ─── Logistics tabs ──────────────────────────────────────────────────────────
export type LogisticsTabParamList = {
  Dashboard:           undefined;
  LogisticsDashboard:  undefined;
  DeliveryList:        undefined;
  Vehicles:            undefined;
  Machines:            undefined;
  WorkshopOverview:    undefined;
  WorkshopManagement:  undefined;
  StockCatalog:        undefined;
  StockInventory:      undefined;
  StockMovements:      undefined;
  TimberInventory:     undefined;
  VehicleFuel:         undefined;
  MyRequests:          undefined;
};

// ─── Sales tabs ──────────────────────────────────────────────────────────────
export type SalesTabParamList = {
  Dashboard:       undefined;
  DeliveryStatus:  undefined;
  Customers:       undefined;
  Products:        undefined;
  MyRequests:      undefined;
};

// ─── Storekeeper tabs ────────────────────────────────────────────────────────
export type StorekeeperTabParamList = {
  Dashboard:          undefined;
  WorkshopOverview:   undefined;
  WorkshopManagement: undefined;
  StockCatalog:       undefined;
  StockInventory:     undefined;
  StockMovements:     undefined;
  MaterialReview:     undefined;
  MyRequests:         undefined;
};

// ─── Finance tabs ─────────────────────────────────────────────────────────────
export type FinanceTabParamList = {
  Overview:    undefined;
  MyRequests:  undefined;
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

// ─── Delivery stack (Logistics) ───────────────────────────────────────────────
export type DeliveryStackParamList = {
  DeliveriesList:  undefined;
  DeliveryCreate:  undefined;
  DeliveryDetail:  { order: DeliveryOrder };
  DeliveryStatus:  { order: DeliveryOrder };
  PODList:         undefined;
  PODCapture:      { order: DeliveryOrder };
  PODDetail:       { order: DeliveryOrder };
};

export type DeliveryStackScreenProps<T extends keyof DeliveryStackParamList> =
  NativeStackScreenProps<DeliveryStackParamList, T>;

// ─── Vehicle Fuel stack (Supervisor) ─────────────────────────────────────────
export type VehicleFuelStackParamList = {
  VehicleFuelList:   undefined;
  VehicleFuelCreate: undefined;
  VehicleFuelDetail: { entry: FuelLog };
};

export type VehicleFuelStackScreenProps<T extends keyof VehicleFuelStackParamList> =
  NativeStackScreenProps<VehicleFuelStackParamList, T>;

// ─── Machine Fuel stack (Mechanician) ────────────────────────────────────────
export type MachineFuelStackParamList = {
  MachineFuelList:   undefined;
  MachineFuelCreate: undefined;
  MachineFuelDetail: { entry: MachineFuelLog };
};

export type MachineFuelStackScreenProps<T extends keyof MachineFuelStackParamList> =
  NativeStackScreenProps<MachineFuelStackParamList, T>;

// ─── Machine Log stack (Mechanician) ─────────────────────────────────────────
export type MachineLogStackParamList = {
  MachineLogList:   undefined;
  MachineLogCreate: undefined;
  MachineLogDetail: { entry: MachineLog };
};

export type MachineLogStackScreenProps<T extends keyof MachineLogStackParamList> =
  NativeStackScreenProps<MachineLogStackParamList, T>;
