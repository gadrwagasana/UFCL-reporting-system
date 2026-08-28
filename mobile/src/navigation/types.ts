import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type {
  PolesRequest, PolesDelivery, MaterialRequest, CasualLabourRequest,
  HarvestEntry, HarvestPlan, LogTransportEntry, DailyLog,
  VapBatch, PoleBatchOutputLine, PendingPoleQCItem,
  DeliveryOrder, FuelLog, MachineFuelLog, MachineLog, MaintenanceRecord,
  Customer, Product, Vehicle, Machine, Workshop, Compartment,
  StockItem, WarehouseRef, SalesOrder, SearchModule,
  ProcurementSupplier, ProcurementRequisition, ProcurementRequisitionItem,
  TransportCompany, TransportJob, CasualWorker, AttendanceRecord,
} from '../types/api';

// ─── Root stack ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Splash:        undefined;
  Auth:          undefined;
  Main:          undefined;
  GlobalSearch:  { contextModule?: SearchModule } | undefined;
  // ERP Enterprise Completion Phase 3 (Workstream 11) — registered at root
  // level, same as GlobalSearch, so every role's AppHeader bell can reach it
  // regardless of which per-role tab navigator is currently mounted. Before
  // this, NotificationsScreen was reachable only as a CeoNavigator tab —
  // every other role had no way to view notifications on mobile at all.
  Notifications: undefined;
  // ERP Enterprise Completion Phase 4 — same root-level pattern, reachable
  // via a role-conditional AppHeader icon (shown only to LEADER_APPROVERS/
  // MANAGER_APPROVERS-tier roles) rather than being added to ~10 separate
  // per-role tab navigators.
  Governance: undefined;
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

// ─── Stock Transfers stack ────────────────────────────────────────────────────
export type StockTransfersStackParamList = {
  StockTransfersList:      undefined;
  StockTransferNewRequest: undefined;
  StockTransferDispatch:   { transferId: number; remaining: number; itemName: string; uom: string; vehicles: import('../types/api').TransferVehicle[] };
  StockTransferDetail:     { transferId: number };
};

// ─── Sales Orders stack ───────────────────────────────────────────────────────
export type SalesOrdersStackParamList = {
  SalesOrdersList:      undefined;
  SalesOrderCreate:     undefined;
  SalesOrderEdit:       { order: SalesOrder };
  // Master Professionalization Phase C1 — no detail/drill-down screen
  // existed at all; every screen re-derived a row from the already-fetched
  // list (Gap Register — Sales Orders had the weakest usability score of
  // any department audited).
  SalesOrderDetail:     { orderId: number; orderNumber?: string };
  SalesOrderDeliver:    { orderId: number; orderNumber: string; customerName: string };
  SalesCustomerCreate:  undefined;
  // Sales Enterprise Phase 2 (Priority 4/10) — CustomerDetail/CustomerForm
  // nested here too (stack push, not a new tab), same "reuse the screen
  // as-is under a different stack" pattern MyRequestsStackParamList already
  // established for MaterialRequestCreateScreen. Gives sales-staff/showroom-
  // staff (who no longer see the Customers tab, see SalesNavigator.tsx) a
  // "View Customer" path from a sales order, and gives 'sales' a second,
  // more convenient path to the same screens it already has via Customers.
  CustomerDetail:       { customerId: number; customerName: string };
  CustomerForm:         { customer?: Customer };
};

// ─── Dispatch stack ───────────────────────────────────────────────────────────
export type DispatchStackParamList = {
  DispatchList:       undefined;
  DispatchNewRequest: undefined;
};

// ─── Transport Carriers / Transport Jobs stacks (Phase 1 Logistics fix) ──────
export type TransportCarriersStackParamList = {
  TransportCarriersList: undefined;
  TransportCarrierForm:  { company?: TransportCompany };
};
export type TransportCarriersStackScreenProps<T extends keyof TransportCarriersStackParamList> =
  NativeStackScreenProps<TransportCarriersStackParamList, T>;

export type TransportJobsStackParamList = {
  TransportJobsList: undefined;
  TransportJobForm:  { job?: TransportJob };
};
export type TransportJobsStackScreenProps<T extends keyof TransportJobsStackParamList> =
  NativeStackScreenProps<TransportJobsStackParamList, T>;

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
  // Phase 1 Workshop parity fix
  MachineKpiPerformance:       undefined;
};

// ─── Vehicles stack ───────────────────────────────────────────────────────────
export type VehiclesStackParamList = {
  VehiclesList:             undefined;
  VehicleDetail:            { vehicleId: number };
  VehicleForm:              { vehicle?: Vehicle };
  VehicleFuelLogCreate:     { vehicleId: number; registration: string };
  VehicleMaintenanceCreate: { vehicleId: number; registration: string; record?: MaintenanceRecord };
};

// ─── Customers stack ─────────────────────────────────────────────────────────
export type CustomersStackParamList = {
  CustomersList:  undefined;
  CustomerForm:   { customer?: Customer };
  // ERP Final Enterprise Completion Gate — Customer History.
  // Sales Enterprise Phase 2 — takes only the id/name (not the full Customer
  // object) so it can be opened from contexts that only have a sales order's
  // denormalized customer_id/customer_name, like the Sales Orders list; the
  // screen itself fetches the full customer record via useCustomerOrders.
  CustomerDetail: { customerId: number; customerName: string };
};

// ─── Admin stack ─────────────────────────────────────────────────────────────
export type AdminStackParamList = {
  AdminHome:              undefined;
  SecGov:                 undefined;
  Audit:                  undefined;
  Users:                  undefined;
  UserDetail:             { userId?: number };
  UserPermissions:        { userId: number; userName: string };
  Roles:                  undefined;
  RoleDetail:             { role: string };
  Trash:                  undefined;
  Changes:                undefined;
  // Automation Center (Module 17A)
  AutomationHome:         undefined;
  AutomationRules:        undefined;
  // Master Professionalization Phase C3 — ruleKey now optional: omitting it
  // puts this screen in create mode (mirrors the Sales Order Form's existing
  // create/edit dual-mode pattern rather than a second screen).
  AutomationRuleDetail:   { ruleKey?: string };
  AutomationEscalations:  undefined;
  AutomationHistory:      undefined;
  AutomationJobs:         undefined;
};

export type AdminStackScreenProps<T extends keyof AdminStackParamList> =
  NativeStackScreenProps<AdminStackParamList, T>;

// ─── MyRequests stack (wraps MyRequestsScreen + ChangesScreen for non-admin roles) ──
export type MyRequestsStackParamList = {
  MyRequestsMain: undefined;
  Changes:        undefined;
  // ERP Enterprise Cross-Department Verification — Logistics is the only one
  // of 6 material-request-eligible departments (Mechanician/Harvesting/
  // Sawmill/Poles/Nyanza/Logistics) whose mobile navigator never mounted the
  // full MaterialRequestsStack (list+create+detail), only this read-only
  // timeline — despite 'logistics' holding the same backend 'material-
  // requests' permission the other 5 already use. Nested here (stack push,
  // not a new tab — LogisticsNavigator already has 16), reusing
  // MaterialRequestCreateScreen exactly as-is (it only ever calls
  // navigation.goBack(), so nesting it under a different stack than its own
  // MaterialRequestsStackParamList type declares is safe).
  MaterialRequestCreate: undefined;
};

export type MyRequestsStackScreenProps<T extends keyof MyRequestsStackParamList> =
  NativeStackScreenProps<MyRequestsStackParamList, T>;

// ─── Reports stack ────────────────────────────────────────────────────────────
export type ReportsStackParamList = {
  ReportsHome:         undefined;
  WeeklyCost:          undefined;
  WeeklyPerf:          undefined;
  KpiScorecard:        undefined;
  Executive:           undefined;
  BI:                  undefined;
  Monthly:             undefined;
  Export:              undefined;
  // EPM (Module 17B)
  EpmHome:             undefined;
  EpmDepartments:      undefined;
  EpmDepartmentKpis:   { department: string };
  EpmKpis:             undefined;
  EpmActionPlans:      undefined;
  EpmTrends:           undefined;
  // Sage Reconciliation (Module 17C)
  Sage:                undefined;
};

export type ReportsStackScreenProps<T extends keyof ReportsStackParamList> =
  NativeStackScreenProps<ReportsStackParamList, T>;

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
  StockTransfers:     undefined;
  Dispatch:           undefined;
  SalesOrders:        undefined;
  Deliveries:         undefined;
  Reports:            undefined;
  Procurement:        undefined;
  Admin:              undefined;
  // ERP Enterprise Completion Phase 3 (Workstream 11) — ceo is one of only
  // two roles (with operations) that can review Casual Labour requests
  // (casualLabourRequestsReview); CeoNavigator previously had no path to
  // this screen at all, on any tab.
  CasualLabour:       undefined;
  // Finance Enterprise Phase 2 — ceo/operations/admin all hold the
  // 'finance-center' permission alongside the 'finance' role, so the Finance
  // Control Center stack (Dashboard + Approval Center) is reused here too,
  // same "one shared stack, multiple navigators" pattern as CasualLabour.
  FinanceCenter:      undefined;
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
  // HR Enterprise Phase 1 — Casuals (casual worker registry), nested here
  // (stack push, not a new tab) same "reuse the existing shared stack"
  // pattern MyRequestsStackParamList established for MaterialRequestCreate.
  // Reachable only via a role-gated header button on CasualLabourListScreen
  // (admin/ceo/operations/supervisor — the roles that actually hold the
  // 'casuals' permission; harvesting-leader/sawmill-leader/vat-leader, who
  // also mount this same shared stack for Casual Labour Requests, never see
  // the button, so this doesn't repeat the broken-visible-tab bug found and
  // fixed in Sales Enterprise Phase 2's SalesNavigator).
  CasualsList:        undefined;
  CasualForm:         { casual?: CasualWorker };
  // HR Enterprise Phase 2 — Attendance, nested here too, same pattern and
  // same role-gated entry point convention as Casuals above.
  AttendanceChecklist: undefined;
  AttendanceHistory:   undefined;
  AttendanceEdit:      { record: AttendanceRecord };
  // Payroll Enterprise Phase 2 — nested here too, same "reuse the shared
  // stack via a role-gated header button" pattern as Casuals/Attendance
  // above ('payroll.manage', matching data.js's PAYROLL_ROLES). Deliberately
  // narrow mobile scope (review/approve/inspect) — rate-setting, period
  // create/calculate, and adjustment creation remain desktop-only, per the
  // brief's "do not force complex payroll administration onto mobile."
  PayrollPeriodsList: undefined;
  PayrollPeriodDetail: { periodId: number };
  PayrollLineDetail:   { lineId: number };
};

// ─── Maintenance Jobs stack (Mechanician Phase 3, shared across role navigators) ──
export type MaintenanceJobsStackParamList = {
  // Mechanician Phase 4 — optional initialStatus lets the dashboard's KPI
  // tiles deep-link straight into a pre-filtered list, mirroring desktop.
  MaintenanceJobsList:   { initialStatus?: string } | undefined;
  MaintenanceJobDetail:  { jobId: number };
  MaintenanceJobCreate:  undefined;
  // Stabilization Phase 5 (F-28)
  MaintenanceWaitingForParts: undefined;
};

// ─── Supervisor tabs ─────────────────────────────────────────────────────────
export type SupervisorTabParamList = {
  TodayDashboard:  undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  Compartments:    undefined;
  StockMovements:  undefined;
  TimberInventory: undefined;
  StockTransfers:  undefined;
  Reports:         undefined;
  Procurement:     undefined;
  MyRequests:      undefined;
  // Mechanician Phase 3 — shared maintenance job lifecycle stack.
  MaintenanceJobs: undefined;
  Profile:         undefined;
};

// ─── Harvesting leader tabs ──────────────────────────────────────────────────
export type HarvestTabParamList = {
  HarvestList:       undefined;
  LogTransportList:  undefined;
  MaterialRequest:   undefined;
  CasualLabour:      undefined;
  StockMovements:    undefined;
  Reports:           undefined;
  MyRequests:        undefined;
  Profile:           undefined;
};

// ─── Sawmill leader tabs ─────────────────────────────────────────────────────
export type SawmillTabParamList = {
  SawmillList:     undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  StockMovements:  undefined;
  Reports:         undefined;
  MyRequests:      undefined;
  // Mechanician Phase 3 — shared maintenance job lifecycle stack.
  MaintenanceJobs: undefined;
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
  Reports:         undefined;
  MyRequests:      undefined;
  // Mechanician Phase 3 — shared maintenance job lifecycle stack.
  MaintenanceJobs: undefined;
  Profile:         undefined;
};

// ─── VAT leader tabs ─────────────────────────────────────────────────────────
export type VatTabParamList = {
  VatInbound:      undefined;
  VatEntries:      undefined;
  MaterialRequest: undefined;
  CasualLabour:    undefined;
  StockMovements:  undefined;
  // Stock & Inventory Phase 4 (audit finding M-15/M-16) / ERP UI/UX
  // Completion Phase 8 — vat-leader holds the backend 'stock-transfers'
  // permission but had no navigation entry point to reach it at all.
  StockTransfers:  undefined;
  Reports:         undefined;
  MyRequests:      undefined;
  Profile:         undefined;
};

// ─── Harvest Supervisor tabs ──────────────────────────────────────────────────
export type HarvestSupervisorTabParamList = {
  HarvestList:      undefined;
  LogTransportList: undefined;
  Reports:          undefined;
  Profile:          undefined;
};

// ─── Sawmill Supervisor tabs ──────────────────────────────────────────────────
export type SawmillSupervisorTabParamList = {
  SawmillList: undefined;
  Reports:     undefined;
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
  // Stock & Inventory Phase 4 (audit finding M-15/M-16) / ERP UI/UX
  // Completion Phase 8 — vat-supervisor holds the backend 'stock-transfers'
  // permission but had no navigation entry point to reach it at all.
  StockTransfers: undefined;
  Profile:    undefined;
};

// ─── Mechanician tabs ────────────────────────────────────────────────────────
// Mechanician Phase 1 (Priority 4) — MachineLogList/MachineFuelList removed:
// this role had never held 'machine-logs'/'machine-fuel'/'machines' at the
// time, so those two tabs were 100% dead navigation. Replaced with the real
// Material Requests workflow (Priority 1/2 fix) plus a tailored dashboard.
// MyRequests dropped too — covered by MechanicianDashboard's own section.
//
// Mechanician Phase 2 (Priority 1/5) — this role now genuinely holds
// 'machine-logs'/'machine-fuel' (see MECHANICIAN_PHASE2_OPERATIONAL_AUDIT.md),
// so MachineLog/MachineFuel are restored — no longer dead, now real. New
// MaintSchedule tab added for the same reason (read-only for this role; see
// MachineMaintScheduleListScreen's own comment on why create/edit stays
// desktop-only for now).
export type MechanicianTabParamList = {
  MechanicianDashboard: undefined;
  MaterialRequest:      undefined;
  MachineLog:           undefined;
  MachineFuel:          undefined;
  MaintSchedule:        undefined;
  // Mechanician Phase 3 — the genuine maintenance job lifecycle (receive
  // work, diagnose, work, request parts, test, close).
  MaintenanceJobs:      undefined;
};

// ─── Operations tabs ─────────────────────────────────────────────────────────
export type OperationsTabParamList = {
  Dashboard:          undefined;
  PendingReviews:     undefined;
  MaterialReview:     undefined;
  LabourReview:       undefined;
  Customers:          undefined;
  Products:           undefined;
  Dispatch:           undefined;
  Machines:           undefined;
  WorkshopOverview:   undefined;
  WorkshopManagement: undefined;
  Compartments:       undefined;
  StockCatalog:       undefined;
  StockInventory:     undefined;
  StockMovements:     undefined;
  TimberInventory:    undefined;
  StockTransfers:     undefined;
  SalesOrders:        undefined;
  Reports:            undefined;
  // Finance Enterprise Phase 2 — operations holds 'finance-center' too.
  FinanceCenter:      undefined;
  Admin:              undefined;
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
  StockTransfers:      undefined;
  Dispatch:            undefined;
  VehicleFuel:         undefined;
  // Phase 1 Logistics fix — no mobile presence existed for these before now.
  TransportCarriers:   undefined;
  TransportJobs:       undefined;
  MyRequests:          undefined;
};

// ─── Sales tabs ──────────────────────────────────────────────────────────────
export type SalesTabParamList = {
  Dashboard:       undefined;
  SalesOrders:     undefined;
  DeliveryStatus:  undefined;
  Customers:       undefined;
  Products:        undefined;
  MyRequests:      undefined;
  Showroom:        undefined; // showroom-staff only — Timber Lifecycle Phase 3
  // Stock & Inventory Phase 4 (audit finding M-15/M-16) / ERP UI/UX
  // Completion Phase 8 — showroom-staff only (same conditional convention
  // as Showroom above); holds the backend 'stock-transfers' permission but
  // had no navigation entry point to reach it at all.
  StockTransfers:  undefined;
};

// ─── Storekeeper tabs ────────────────────────────────────────────────────────
export type StorekeeperTabParamList = {
  Dashboard:          undefined;
  WorkshopOverview:   undefined;
  WorkshopManagement: undefined;
  StockCatalog:       undefined;
  StockInventory:     undefined;
  StockMovements:     undefined;
  StockTransfers:     undefined;
  MaterialReview:     undefined;
  Reports:            undefined;
  MyRequests:         undefined;
};

// ─── Finance tabs ─────────────────────────────────────────────────────────────
export type FinanceTabParamList = {
  Overview:      undefined;
  // Finance Enterprise Phase 2 — the new Finance Control Center stack
  // (Dashboard + Approval Center); 'Overview' above remains the pre-existing
  // generic operational dashboard, unchanged.
  FinanceCenter: undefined;
  Reports:       undefined;
  Procurement:   undefined;
  MyRequests:    undefined;
};

// ─── Finance Control Center stack (Finance Enterprise Phase 2, shared across
// the finance/ceo/operations/admin navigators — same "one shared stack,
// multiple navigators" pattern as CasualLabourStack) ───────────────────────
export type FinanceCenterStackParamList = {
  FinanceDashboard: undefined;
  FinanceApprovals: undefined;
  FinanceInventory: undefined;
  FinanceStockCounts: undefined;
  FinanceStockCountDetail: { sessionId: number };
  FinanceExceptions: undefined;
  FinanceExceptionDetail: { caseId: number };
};

// ─── Procurement stack (shared across role navigators — Finance/Supervisor/Ceo
// get it as one tab; Procurement Officer/Manager/Department Manager get it as
// their whole app via ProcurementNavigator) ───────────────────────────────────
export type ProcurementStackParamList = {
  ProcurementDashboard: undefined;
  SuppliersList:        undefined;
  SupplierDetail:       { supplierId: number };
  SupplierForm:         { supplier?: ProcurementSupplier };
  SupplierComparison:   { supplierIds?: number[] } | undefined;
  RequisitionsList:     undefined;
  RequisitionDetail:    { requisitionId: number };
  // Procurement Exception Management Phase 2 — `items` carries the
  // requisition's current line items when editing (the requisition row
  // itself doesn't include them); omitted for a fresh "New Requisition".
  RequisitionForm:      { requisition?: ProcurementRequisition; items?: ProcurementRequisitionItem[] };
  RfqList:              undefined;
  RfqDetail:            { rfqId: number };
  RfqCreate:            { requisitionId: number };
  // Optional preset — Phase 5B's Workshop Analysis drill-down passes this to
  // land pre-filtered without a new detail screen (per the approved design).
  PurchaseOrdersList:   { workshopId?: number; workshopName?: string } | undefined;
  PurchaseOrderDetail:  { poId: number };
  GoodsReceiptList:     undefined;
  GoodsReceiptCreate:   { poId: number };
  GoodsReceiptDetail:   { receiptId: number };
  InvoicesList:         undefined;
  InvoiceDetail:        { invoiceId: number };
  ProcurementReports:   undefined;
  ProcurementSettings:  undefined;
  // Supplier Relationship Management (SRM) — Phase 4
  SrmDashboard:         undefined;
  ContractRegister:     undefined;
  ComplianceCenter:     undefined;
};

// ─── Procurement Officer / Manager / Department Manager tabs ─────────────────
export type ProcurementTabParamList = {
  Procurement: undefined;
  Profile:     undefined;
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

export type MaintenanceJobsStackScreenProps<T extends keyof MaintenanceJobsStackParamList> =
  NativeStackScreenProps<MaintenanceJobsStackParamList, T>;

export type CasualLabourStackScreenProps<T extends keyof CasualLabourStackParamList> =
  NativeStackScreenProps<CasualLabourStackParamList, T>;

export type FinanceCenterStackScreenProps<T extends keyof FinanceCenterStackParamList> =
  NativeStackScreenProps<FinanceCenterStackParamList, T>;

// ─── Harvest stack ────────────────────────────────────────────────────────────
export type HarvestStackParamList = {
  HarvestList:   undefined;
  // Harvesting Phase 1 (Workstream 1) — optional `entry` puts the screen in edit mode.
  HarvestCreate: { entry?: HarvestEntry } | undefined;
  HarvestDetail: { entry: HarvestEntry };
  // Harvesting Phase 1 (Workstream 2)
  HarvestDashboard: undefined;
  // Harvesting Phase 2 (Workstream 1) — Harvest Planning
  HarvestPlanList: undefined;
  HarvestPlanForm: { plan?: HarvestPlan } | undefined;
  // Harvesting Phase 3 (Workstreams 1-3)
  HarvestOperations: undefined;
  HarvestDelays:     undefined;
  HarvestDelayForm:  undefined;
  // Enterprise Timber Lifecycle Integration Program — Phase 1
  HarvestWaste:      undefined;
};

export type HarvestStackScreenProps<T extends keyof HarvestStackParamList> =
  NativeStackScreenProps<HarvestStackParamList, T>;

// ─── Log Transport stack ──────────────────────────────────────────────────────
export type LogTransportStackParamList = {
  LogTransportList:   undefined;
  // Remediation Phase 2 — optional `entry` puts the create screen into edit mode
  LogTransportCreate: { entry?: LogTransportEntry } | undefined;
  LogTransportDetail: { entry: LogTransportEntry };
};

export type LogTransportStackScreenProps<T extends keyof LogTransportStackParamList> =
  NativeStackScreenProps<LogTransportStackParamList, T>;

// ─── Sawmill Production stack ─────────────────────────────────────────────────
export type SawmillStackParamList = {
  SawmillProductionList:   undefined;
  // Sawmill Phase 1 (Workstream 3) — optional `entry` puts the screen in edit mode.
  SawmillProductionCreate: { entry?: DailyLog } | undefined;
  SawmillProductionDetail: { entry: DailyLog };
  // Sawmill Phase 1 (Workstream 5) — reuses the existing Timber Inventory screen, reached via a stack push instead of a new tab.
  SawmillTimberInventory:  undefined;
  // Sawmill Phase 3 (Workstream 4) — Sawmill Manager Dashboard, reached the same way (stack push, not a new tab).
  SawmillDashboard:        undefined;
};

export type SawmillStackScreenProps<T extends keyof SawmillStackParamList> =
  NativeStackScreenProps<SawmillStackParamList, T>;

// ─── Poles Production stack ───────────────────────────────────────────────────
export type PolesProductionStackParamList = {
  PolesProductionList:   undefined;
  PolesProductionCreate: undefined;
  PolesProductionDetail: { entry: DailyLog };
  // Pole Production Phase 1 — the new batch+output-lines capability, reached
  // via a stack push from PolesProductionScreen (same "extra screens live in
  // the existing stack, not a new tab" pattern SawmillStackParamList already
  // established for SawmillTimberInventory/SawmillDashboard above).
  PoleBatchList:    undefined;
  PoleBatchCreate:  undefined;
  PoleBatchInspect: { output: PoleBatchOutputLine };
  // Pole Production Phase 2 — Purchased Finished Poles, same "stack push,
  // not a new tab" pattern as the Phase 1 screens above. PoleRejectionHolds
  // also closes the mobile gap Phase 1 documented (manufactured-pole
  // rejection holds had no mobile screen either) — one screen, both sources.
  PurchasedPoleQC:        undefined;
  PurchasedPoleQCInspect: { item: PendingPoleQCItem };
  PoleRejectionHolds:     undefined;
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
// Nyanza Value-Added Production Completion Phase — was a "pick a received
// transfer, then create an intake entry for it" 2-step flow; input material
// is now chosen directly from available stock at batch-creation time (see
// useVatAvailableInputs), so there's no longer a separate list-then-create
// step — VatInboundList (the root screen of this stack, VatInboundScreen.tsx)
// now directly renders the batch-creation form.
export type VatInboundStackParamList = {
  VatInboundList: undefined;
};

export type VatInboundStackScreenProps<T extends keyof VatInboundStackParamList> =
  NativeStackScreenProps<VatInboundStackParamList, T>;

// ─── VAT Entries stack ────────────────────────────────────────────────────────
export type VatEntriesStackParamList = {
  VatProcessingList: undefined;
  VatDetail:         { batch: VapBatch };
};

export type VatEntriesStackScreenProps<T extends keyof VatEntriesStackParamList> =
  NativeStackScreenProps<VatEntriesStackParamList, T>;

// ─── Delivery stack (Logistics) ───────────────────────────────────────────────
export type DeliveryStackParamList = {
  DeliveriesList:  undefined;
  DeliveryCreate:  undefined;
  DeliveryEdit:    { order: DeliveryOrder };
  DeliveryDetail:  { order: DeliveryOrder };
  DeliveryStatus:  { order: DeliveryOrder };
  PODList:         undefined;
  PODCapture:      { order: DeliveryOrder };
  PODDetail:       { order: DeliveryOrder };
};

export type DeliveryStackScreenProps<T extends keyof DeliveryStackParamList> =
  NativeStackScreenProps<DeliveryStackParamList, T>;

// ─── Sales Dashboard stack (ERP Final Enterprise Completion Gate) ────────────
export type SalesDashboardStackParamList = {
  SalesDashboard: undefined;
  SalesHistory:   undefined;
};

export type SalesDashboardStackScreenProps<T extends keyof SalesDashboardStackParamList> =
  NativeStackScreenProps<SalesDashboardStackParamList, T>;

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
  // Stabilization Phase 5 (F-21) — optional `entry` puts the screen in edit mode.
  MachineFuelCreate: { entry?: MachineFuelLog } | undefined;
  MachineFuelDetail: { entry: MachineFuelLog };
};

export type MachineFuelStackScreenProps<T extends keyof MachineFuelStackParamList> =
  NativeStackScreenProps<MachineFuelStackParamList, T>;

// ─── Machine Log stack (Mechanician) ─────────────────────────────────────────
export type MachineLogStackParamList = {
  MachineLogList:   undefined;
  // Remediation Phase 3 — optional `entry` puts the create screen into edit mode
  MachineLogCreate: { entry?: MachineLog } | undefined;
  MachineLogDetail: { entry: MachineLog };
};

export type MachineLogStackScreenProps<T extends keyof MachineLogStackParamList> =
  NativeStackScreenProps<MachineLogStackParamList, T>;
