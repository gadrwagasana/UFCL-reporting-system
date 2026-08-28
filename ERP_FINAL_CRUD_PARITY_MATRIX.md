# ERP Final Enterprise Completion Gate — CRUD Parity Matrix

Legend: **PASS** · **PARTIAL** (real, disclosed gap — see Gap Register id) · **N/A** (not applicable to this entity's lifecycle) · **INT** (Intentional by design)

---

## CEO / Executive / Operations

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Executive Dashboard | N/A | PASS | N/A | N/A | N/A | PASS | PASS |
| CEO Overview | N/A | PASS | N/A | N/A | N/A | PASS | PASS |
| Poles Purchase Requests (CEO approval) | PASS | PASS | N/A | N/A | PASS (CEO-exclusive) | PASS | PASS |
| Governance Queue (pending edits/deletions) | N/A | PASS | N/A | N/A | PASS | PASS | PASS |

## Procurement

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Purchase Requisition | PASS | PASS (WI fixed B-04) | PASS | N/A (cancel) | PASS (multi-stage + Return-for-Revision) | PASS | PASS |
| Purchase Order | PASS | PASS (WI fixed B-04) | PASS | N/A | PASS (+ Close-with-Shortage) | PASS | PASS |
| RFQ / Quotation | PASS | PASS | N/A | N/A | N/A (select) | PASS | PASS |
| Supplier | PASS | PASS | PASS | PASS (governed) | PASS (blacklist/status) | PASS | PASS |
| Supplier Contact | PASS | PASS | PASS (audit fixed C-05) | PASS (audit fixed C-05) | N/A | PASS | PASS |
| Supplier Contract | PASS | PASS | PASS | PASS | N/A | PASS | PASS |
| Supplier Compliance | PASS | PASS | PASS | N/A | N/A | PASS | PASS |
| Supplier Documents | PASS | PASS | N/A | PASS (deactivate) | N/A | PASS (via SRM report tab) | PASS (via SRM report tab) |
| Goods Receipt | PASS | PASS (WI fixed B-04) | N/A | N/A | N/A (QC gate for Poles) | PASS | PASS |

## Harvesting

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Harvest Log | PASS | PASS | PASS (WI fixed B-05) | PASS (WI fixed B-05) | PASS (governed) | PASS | PASS |
| Harvest Plan | PASS | PASS | PASS (WI fixed B-05) | PASS (WI fixed B-05) | N/A | PASS | PASS |
| Harvest Waste | PASS | PASS | N/A (INT — immutable) | N/A | N/A | PASS | PASS |
| Log Transport | PASS | PASS | PASS (WI + revalidation fixed B-05/C-01) | PASS (WI fixed B-05; mobile route added C-07) | PASS (governed) | PASS | PASS |
| Harvest Delays | PASS | PASS | N/A | N/A | N/A | PASS | PASS |

## Sawmill

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Daily Production Log | PASS | PASS | PASS (WI fixed B-05) | PASS (WI fixed B-05) | PASS (governed) | PASS | PASS |
| Production Offcut | PASS | PASS | N/A (status machine) | N/A | N/A | PASS | PASS |
| Quality Inspection | PASS | PASS | N/A (INT — immutable) | N/A | N/A | PASS | PASS |
| Rejection Hold / Resolution | PASS | PASS | N/A (INT — immutable) | N/A | PASS (Rework/Downgrade/Return/Firewood/Scrap/Disposal) | PASS | PASS |

## Pole Production

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Pole Production Batch | PASS | PASS | N/A (INT — no update fn, by design) | PASS | N/A | PASS | PASS |
| Purchased Finished Poles (QC gate) | PASS | PASS | N/A | N/A | PASS (QC) | PASS | PASS |
| Rejection/Resolution (both sources) | PASS | PASS | N/A | N/A | PASS (Rework Path-A-only by design; Downgrade/Firewood/Scrap generic) | PASS | PARTIAL (F-04, Disposal-only inline) |

## Nyanza / VAT

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| VAT Production Batch | PASS | PASS | PASS (**crash bug fixed B-02** + WI fixed B-03) | PASS (**crash bug fixed B-02** + WI fixed B-03) | N/A | PASS | PARTIAL (INT — Update is desktop metadata-only by design) |
| VAT Output / QC | PASS | PASS | N/A (INT) | N/A | PASS (QC) | PASS | PASS |
| Rejection/Resolution | PASS | PASS | N/A | N/A | PASS (shared engine) | PASS | PASS |

## Showroom

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Showroom Inventory (view) | N/A | PASS | N/A | N/A | N/A | PASS (**NAV permission fixed C-06**) | PASS |
| Showroom Damage Report | PASS | PASS | N/A (INT — immediate write-down) | N/A | N/A | PASS | PASS |
| Resolution (damage) | PASS | PASS | N/A | N/A | PASS (shared engine) | PASS | PARTIAL (Disposal-only inline, same as F-04) |

## Inventory / Stock

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Product / Stock Catalog | PASS | PASS | PASS | PASS (usage-guarded) | N/A | PASS | PASS |
| Warehouses | PASS | PASS | PASS | PASS (usage-guarded) | N/A | PASS | PASS |
| Stock Levels / Movements | PASS | PASS | N/A | PASS (**reversal logging fixed C-02**) | N/A | PASS | PASS |
| Stock Transfer | PASS | PASS | N/A (status lifecycle) | N/A | PASS (full lifecycle, concurrency-safe) | PASS | PASS |
| Inventory Adjustment | PASS (request-based) | PASS | N/A (INT — immutable request) | N/A | PASS | PASS | PASS |

## Sales

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Sales Order | PASS | PASS | PASS | PASS | N/A | PASS | PASS |
| Customer | PASS | PASS | PASS | PASS (deactivate) | N/A | PASS | PASS |
| Customer History | N/A | **PASS (built this phase)** | N/A | N/A | N/A | PASS | PASS |
| Sales Dashboard | N/A | **PASS (built this phase)** | N/A | N/A | N/A | PASS | PASS |
| Sales Reporting | N/A | **PASS (built this phase)** | N/A | N/A | N/A | PASS (+ CSV export) | PARTIAL (F-02, no CSV export) |
| Delivery Order | PASS | PASS | PASS | PASS | PASS (POD) | PASS | PASS |

## Logistics

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Material Request | PASS | PASS | N/A (INT — lifecycle-driven) | N/A | PASS | PASS | PASS |
| Stock Transfer | (see Inventory above) | | | | | | |
| Dispatch Request | PASS | PASS | N/A (INT) | PASS (governed) | PASS | PASS | PASS |
| Transport Job | PASS | PASS (**WI fixed B-01**) | PASS (**WI fixed B-01**) | PASS (**WI fixed B-01**) | N/A | PASS | PASS |
| Transport Company | PASS | PASS | PASS | PASS | N/A | PASS | PASS |

## Fleet & Equipment

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Vehicle | PASS | PASS | PASS | PASS (governed) | N/A | PASS | PASS |
| Vehicle Fuel Log | PASS | PASS | N/A (INT — no update fn) | PASS (governed) | N/A | PASS | PASS |
| Vehicle Maintenance Record | PASS | PASS | PASS (governed) | PASS (governed) | N/A | PASS | PASS |
| Machine Registry | PASS | PASS | PASS | PASS | N/A | PASS | PASS |
| Machine Maintenance Schedule | PASS | PASS | PASS | PASS | N/A | PASS | PARTIAL (F-01, backend REST parity added, UI intentionally desktop-only) |
| Machine Fuel Log | PASS | PASS | PASS | PASS | N/A | PASS | PASS |

## Mechanician / Maintenance

| Entity | Create | Read | Edit | Delete | Approve | Desktop | Mobile |
|---|---|---|---|---|---|---|---|
| Maintenance Job | PASS | PASS | N/A (INT — 10-state lifecycle machine) | N/A | N/A (state transitions) | PASS | PASS |
| Job Labour | PASS (auto) | PASS | N/A | N/A | N/A | PASS | PASS |
| Spare Parts (via Material Request) | (see Logistics) | | | | | | |

---

## Summary

**All entities have a working Create→Read→(Edit/Delete where applicable)→Approval/QC path on both platforms.** This phase's fixes closed 9 Workshop Isolation gaps (marked above) and 1 previously-undiscovered crash bug (VAT Production Batch Update/Delete). Remaining PARTIAL ratings are all explicitly classified Intentional (F-series in the Gap Register) with a documented reason — none is a silent gap. See `ERP_FINAL_ENTERPRISE_COMPLETION_GAP_REGISTER.md` for the full classification and `ERP_FINAL_ENTERPRISE_COMPLETION_CHANGELOG.md` for exact fix evidence.
