# UFCL ERP — Enterprise Design System Guide

Version 1.0 — Enterprise UI/UX Standardization Program, Phase 1 (Design System & Workspace Foundation)

This is the enforceable reference for UI/UX on both platforms (Electron desktop, React Native mobile) going forward. It documents what already existed and was genuinely consistent, what was broken or duplicated and has now been fixed/consolidated, what new shared pieces this phase built, and — explicitly — what is still fragmented and intentionally deferred to a future phase rather than silently ignored.

Phase 1 is a **Foundation** phase: it fixes real bugs, consolidates genuine duplication, and builds the missing shared pieces that already had proven demand (2+ real call sites). It does **not** retrofit every screen in every department onto a rebuilt system — see "Known Remaining Fragmentation" at the end of this document for the honest list of what that would still take.

---

## 1. Status Badges

### Desktop

Single shared renderer: `badgeHtml(metaMap, status, fallbackMeta)` (`renderer/app.js`). Every status-meta registry uses the shape `{ cls, label, icon? }` — `icon` is optional; omit it to render a plain badge with no icon (this is how registries that never had icons, like machine-due-status, keep their exact prior look).

Color classes (`renderer/styles.css`): `.badge` base + `.bg` (green) `.br` (red) `.ba` (amber) `.bb` (blue) `.bp` (purple) `.bt` (teal) `.bn` (neutral gray). These 7 are the entire color vocabulary — don't invent a new one-off color for a new status; pick the closest semantic bucket.

Registries (all render via `badgeHtml`):

| Registry | Domain | Call sites |
|---|---|---|
| `PROC_STATUS_META` | Procurement (requisitions/POs/RFQs/receipts/invoices/suppliers) | `procStatusBadge()`, 23+ |
| `MAINT_JOB_STATUS_META` | Maintenance jobs | `_mjStatusBadge()`, 7+ |
| `STOCK_TRANSFER_STATUS_META` / `STOCK_TRANSFER_LIST_STATUS_META` | Stock transfers | `stockTransferStatusBadge()` |
| `MATERIAL_REQUEST_STATUS_META` | Material requests | local `statusBadge` closure, `renderMaterialRequests` |
| `POLES_STATUS_META` | Poles delivery/QC | local `statusBadge` closure, `renderDailyPoles` |
| `MACHINE_DUE_STATUS_META` | Machine maintenance due-status | local `statusBadge` closure, `renderMachineMaintenance` |

**Adding a new status badge:** add an entry to the domain-appropriate registry (or create a new one next to the others if it's a genuinely new domain) and call `badgeHtml(YOUR_META, status, fallback)`. Do not hand-roll a new ternary/ad-hoc object map — that's exactly the duplication this phase removed.

**Why domains stay separate instead of one giant map:** the same English word can mean different things (and want different colors) in different domains — e.g. Stock Transfer's `completed` is green, but folding it into `PROC_STATUS_META` (where `completed` is teal, a different concept) would silently recolor one of them. Keep a registry per domain; share the renderer, not the vocabulary.

### Mobile

Single component: `StatusBadge` (`mobile/src/components/StatusBadge.tsx`), covering ~60 status keys across every module (Procurement, Delivery, Stock Transfer, Sales Order, etc.) via one `resolveColors()` switch + one `PROC_STATUS_ICON` map + a small `LABEL_OVERRIDES` table for the handful of statuses whose display label isn't a mechanical derivation from the raw status string (e.g. `'closed (short)'` → `'Closed Short'`).

`DeliveryStatusBadge`, `TransferStatusBadge`, and `SalesOrderStatusBadge` were near-duplicate components (translucent-background bordered pill, vs. `StatusBadge`'s solid-fill pill) — **deleted this phase**; their status vocabularies were merged into `StatusBadge`. All 8 call sites now import `StatusBadge` directly. This was a genuine, intentional visual standardization (translucent-bordered → solid-fill), not an accidental side effect — every other status badge in the app already used the solid-fill look.

**Adding a new status:** add a `case` to `resolveColors()` (lowercase key) and, if the default label derivation (`capitalize first letter, replace _/- with spaces`) doesn't produce the right display text, add an entry to `LABEL_OVERRIDES`.

---

## 2. KPI Tiles / Cards

Desktop and mobile each have **two** established KPI-display idioms, and they are visually distinct by design — this phase gives each a shared renderer/component, it does not merge them into one shape.

### Desktop

**`.mc` grid tile** (small card, `.mclbl`/`.mcval`/`.mcsub`) — the majority idiom (70+ `render*` functions, 241+ raw `.cards`/`.mc` occurrences before this phase). Shared helper: **`kpiTileHtml({ icon, label, value, valueColor, valueStyle, borderColor, sub, subCls, trend, cls, id, data })`** (`renderer/app.js`).

- `sub`/`trend` accept pre-rendered HTML (e.g. the output of a local `trendBadge()` closure) — the helper doesn't recompute trend logic, callers keep full control.
- For click-through tiles: pass `id` and wire `$(id).onclick = ...` after the innerHTML assignment (the convention every dynamic element in this file already follows), **or** pass `cls`/`data` for the `querySelectorAll`-group delegation pattern (e.g. `.mj-kpi-link[data-status]`, used by the Mechanician dashboard to route a whole KPI row through one delegated click handler).
- `valueStyle` is the escape hatch for one-off value styling (e.g. a smaller font size on a wide numeric value) — matches `kpiTileHtml`'s general philosophy: additive escape hatches over new variants.

Reference migrations this phase (visually unchanged, same markup, routed through the helper instead of hand-typed): **Mechanician Dashboard** (`renderMechanicianDashboard`, both KPI rows) and **Inventory Dashboard** (`renderInventory`, Executive KPIs row).

**`.kpi-card` grid tile** (`.kpi-lbl`/`.kpi-val`/`.kpi-sub`, modifier classes `.kpi-amber`/`.kpi-blue`/`.kpi-green`) — used exclusively and consistently throughout the entire **Procurement module** (dashboard, supplier intelligence, SRM, executive dashboard — 88+ occurrences). This is a real, separate, internally-consistent idiom, not an accident — `.kpi-card` has its own CSS (`renderer/styles.css:449`, top-border accent pseudo-element, `--r-lg` radius) that visibly differs from `.mc` (`--r-md` radius, no accent). **Do not force Procurement screens onto `kpiTileHtml`/`.mc`** — that would be a real, visible re-skin of an already-consistent module, not a safe drop-in. If/when the two idioms are ever unified app-wide, that's a deliberate future design decision (see "Known Remaining Fragmentation"), not a Foundation-phase change.

### Mobile

**`KpiCard`** (`mobile/src/components/KpiCard.tsx`) now supports two variants:

- **`variant="row"`** (default, unchanged from before this phase) — full-width list-row card with icon, value, title, optional trend/badge/chevron. 8 existing call sites, untouched.
- **`variant="tile"`** (new this phase) — compact grid tile, matching the `MiniKpi`/`statTileAlt` local components that Mechanician and Procurement dashboards had each hand-rolled independently. Two sizes: `tileSize="sm"` (default; matches Mechanician's original proportions — `Radius.md`, `Typography.base` value) and `tileSize="md"` (matches Procurement's original proportions — `Radius.lg`, `Typography.lg` value). The two sizes are kept distinct **on purpose** — forcing either dashboard onto the other's proportions would have been a visible, unrequested size change with no design decision behind it.
- `warn`/`danger` booleans color the value text (amber / red) for at-a-glance status, matching what both original components did.
- `style`/`valueStyle` are escape hatches for the rare one-off override (e.g. Procurement's wider "Total Spend" tile, `style={{ flex: 1.4 }}`) — same philosophy as desktop's `kpiTileHtml`.

Reference migrations this phase: **`MechanicianDashboardScreen`** (both KPI grids, fully migrated, local `MiniKpi` component deleted) and **`ProcurementDashboardScreen`** (Supplier Intelligence KPI block, 8 tiles, fully migrated). Procurement's **Executive Dashboard** KPI block (`exec.kpis.*`, further down the same screen) was intentionally **not** migrated this phase — it has more per-tile style overrides than the Supplier Intelligence block and migrating it well deserves its own pass rather than being rushed as a second data point for a pattern already proven by the first migration. See "Known Remaining Fragmentation."

---

## 3. Buttons

### Desktop

Three classes, already disciplined before this phase (163/368/3 call sites respectively) — **no changes needed**:

- `.bp1` — primary, solid green fill, white text.
- `.bs1` — secondary, transparent fill, gray border/text.
- `.bdanger` — soft danger, light-red fill, dark-red text/border (small inline actions). For a *strong* destructive confirm (e.g. delete), the existing convention is `.bp1` with an inline red background override (see `confirmDelete()`) — not a fourth class.

### Mobile

**New this phase**: `Button` (`mobile/src/components/Button.tsx`) — the app's first shared button component. Before this phase, all 131 screens used raw `TouchableOpacity` with independent inline styles.

Five variants, matching desktop's semantics:

| Variant | Matches | Look |
|---|---|---|
| `primary` | `.bp1` | solid `Colors.green`, white text |
| `secondary` | `.bs1` | transparent, `Colors.border` border, muted text |
| `danger` | desktop's solid-red confirm-delete pattern | solid `Colors.error`, white text |
| `outline` | — (new) | transparent, colored border + text (default navy) |
| `ghost` | — (new) | transparent, no border, colored text only |

Props: `label`, `onPress`, `variant`, `size` (`sm`/`md`), `icon` (Ionicons name), `disabled`, `loading` (shows a spinner in place of the label), `fullWidth`, `color` (override the bg for solid variants / border+text for outline-family variants — the escape hatch for a screen with an established bespoke accent, e.g. a navy or success-green action button, so adopting `Button` doesn't force an unrelated color change).

Reference migrations this phase: **`DeliveryDetailScreen`** ("Update Status" → `color={Colors.navy}`, "Record POD" → `color={Colors.success}`) and **`CasualLabourCreateScreen`** ("Submit Request"/"Save Offline", plain `primary` — this one needed no `color` override at all, since its original styling already matched the default primary palette exactly).

---

## 4. Detail Overlay Tabs (documentation-only this phase)

Desktop's `.smo-tabs`/`.smo-tab` tabbed-overlay pattern is used by exactly 4 modules today, each with its own locally-scoped `TAB_META`:

| Module | Tabs |
|---|---|
| Material Request | Overview · Items · Linked Transfer · History |
| Vehicle | Overview · Maintenance · Fuel · Assignments · Audit History |
| Maintenance Job | Overview · Timeline · Labour · Parts · External Repair · Production Impact · Audit History |
| Supplier | Overview · Contracts · Compliance · Documents · Communications · Improvements · Intelligence |

**Recommended vocabulary for future tabbed overlays** (per the original brief): `Overview` / `Details` / `History` / `Timeline` / `Related Records` / `Attachments` (when applicable). All 4 existing modules already lead with `Overview` and most end with a history/audit tab — the recommendation formalizes what's already the de facto convention rather than inventing a new one.

**Not retrofitted this phase**: the 130+ flat, single-scroll overlays elsewhere in the app. Whether any given overlay should become tabbed is a per-module UX decision (does it have genuinely distinct sections worth separating?), not a mechanical conversion — exactly how each of the 4 existing tabbed overlays was scoped as its own feature decision, not a batch conversion.

---

## 5. Workspace Layout (documentation-only this phase)

Recommended standard shape for future dashboard/workspace screens, both platforms:

```
Header → KPI Strip → Alerts → Quick Actions → Activity Timeline → Primary Workspace → Supporting Widgets → Data Table
```

This isn't a new invention — it's the shape the Mechanician Phase 4 dashboard redesign (desktop and mobile) already converged on independently earlier this session. Documenting it here just makes it the explicit standard for whoever builds the next dashboard, instead of something they'd have to reverse-engineer from reading the Mechanician screen.

Not every screen needs every section — a detail screen has no KPI strip, a report screen has no quick actions. Use the sections that apply, in this relative order.

---

## 6. Alerts

### Desktop

**New this phase**: `alertHtml(type, message, dismissible)` (`renderer/app.js`), generalizing the ad-hoc `.lerr` error banner and a hand-typed amber "pending approvals" banner that had been duplicated at 4+ call sites. Four severities, reusing the existing badge/token color palette so Alerts stay visually consistent with everything else:

| Type | Color |
|---|---|
| `critical` | red (`--red-l` / `#991B1B`) |
| `warning` | amber (`--amber-l` / `#92400E`) |
| `info` | blue (`--blue-l` / `--blue`) |
| `success` | green (`--g-light` / `--g-dark`) |

`dismissible=true` adds a close icon wired with a plain inline DOM handler (`this.closest('.ent-alert').remove()`) — no global function reference needed, consistent with the small inline-`onclick` patterns already used elsewhere in this file (e.g. `event.stopPropagation()` on table row checkboxes).

The pre-existing `.lerr` class and the hand-typed amber banners were **not** retrofitted onto `alertHtml()` this phase (that's a mechanical, low-risk follow-up, not something requiring a design decision — left as tracked future work rather than expanding this phase's diff for no functional gain).

### Mobile

**New this phase**: `AlertBanner` (`mobile/src/components/AlertBanner.tsx`). `Toast` (`mobile/src/components/Toast.tsx`) does **not** cover this case — `Toast` is a transient, auto-hiding (~2.6s), non-dismissible, floating overlay for success/error feedback after an action; `AlertBanner` is a persistent, inline, optionally-dismissible banner for page-level context (e.g. "150 units remaining on this SO"), the mobile equivalent of desktop's `alertHtml()`.

Same 4 severities (`critical`/`warning`/`info`/`success`), using the existing `Colors.errorBg`/`warningBg`/`infoBg`/`successBg` theme tokens (already defined, previously unused for this purpose). `dismissible` renders a close icon that sets local `dismissed` state.

Reference migration this phase: **`DeliveryDetailScreen`**'s "remaining SO units" warning, previously a one-off local `warnBanner` style — now `<AlertBanner type="warning" message={...} />`.

---

## 7. Quick Actions (documentation-only, not built)

The original brief asked for a context-aware Quick Actions panel per screen. **Not built this phase** — there is no existing analog anywhere in the app to extend safely, and inventing a novel cross-department mechanism without a driving use case is exactly the kind of scope creep a Foundation phase should avoid. Recommended for a future phase once a specific screen's requirements make the right shape concrete (a fixed action bar? a floating action button with a menu? per-role action sets?) — those are real design questions this phase deliberately didn't answer speculatively.

---

## 8. Tables, Overlays, Charts (already consistent — no changes this phase)

Confirmed via audit to already be genuinely shared, not duplicated:

- **Tables**: `procFilterBarHtml` / `applyProcListFilters` / `wireSortableTable` (25/25/32 call sites). Not universal — 5+ screens (notifications, warehouses, logistics pickers, EPM KPIs) have their own filtering, which is appropriate given their differing needs, not an oversight.
- **Overlays**: `openOverlay`/`closeOverlay` (136/70 call sites) — universal, no exceptions found.
- **Charts**: `_svgLine`/`_svgBar`/`_svgDualBar`/`_svgSparkline`/`_svgGauge`/`_svgForecast` (25/12/6/8/3/6 call sites) — the sole charting mechanism app-wide, no external library, no duplication found.

---

## 9. Design Tokens

### Desktop (`renderer/styles.css`, `:root`)

Pre-existing (39 tokens): color (`--g-dark`/`--g-mid`/`--g-soft`/`--amber`/`--red`/`--blue`/`--purple`/`--teal`/…), radius (`--r-sm`/`--r-md`/`--r-lg`/`--r-xl`), shadow (`--sh`/`--sh-md`), font-family (`--ff`/`--fm`).

**New this phase** (purely additive — no existing hardcoded value was changed, so zero visual-regression risk):

```css
--sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px;
--fs-xs:11px; --fs-sm:12px; --fs-md:13px; --fs-lg:15px; --fs-xl:18px;
```

Before this phase there was no spacing or font-size scale at all — 130+ call sites hardcode raw `font-size:Npx`. New/touched code should prefer these tokens; **existing hardcoded values were not retrofitted** (that's the same kind of large, low-value mechanical sweep as the `.lerr` retrofit above — tracked future work, not done here).

### Mobile (`mobile/src/theme/`)

Already comprehensive and consistently imported everywhere checked — `colors.ts`, `spacing.ts` (`Spacing`/`Radius`/`Shadow`/`Layout`), `typography.ts` (`Typography`/`TextStyles`). No gaps found; no changes made this phase.

---

## 10. Known Remaining Fragmentation (explicit future work, not silently dropped)

This phase was scoped as Foundation, not a full retrofit. What's genuinely still fragmented, in priority order if a future phase picks this up:

1. **Desktop's two KPI-tile idioms** (`.mc` vs `.kpi-card`) are not unified — Procurement uses one, everything else uses the other. Unifying them is a real design decision (which one wins? does Procurement's top-border accent get adopted app-wide, or dropped?) deliberately not made unilaterally in this phase.
2. **App-wide `kpiTileHtml`/`KpiCard`/`Button` retrofit** — this phase proved each new helper/component on 2 reference call sites; the other ~68 `.mc`-hand-typing functions, 6+ remaining `.kpi-card` screens, and 129 remaining raw-`TouchableOpacity` mobile screens were not touched. Each is a low-risk, high-volume mechanical migration — appropriate for a dedicated follow-up sweep, not something to rush through inside a phase that also had bug fixes and new-component design to do carefully.
3. **Procurement's Executive Dashboard KPI block** (mobile) — same `KpiCard variant="tile"` pattern already proven on the Supplier Intelligence block above it in the same screen; not migrated this phase (see §2).
4. **The `.lerr` class and the 4+ hand-typed amber banners** (desktop) — not retrofitted onto `alertHtml()`.
5. **130+ hardcoded `font-size:Npx` values** (desktop) — not retrofitted onto the new `--fs-*` tokens.
6. **130+ flat (non-tabbed) desktop overlays** — not evaluated for whether they should adopt `.smo-tabs`; that's a per-module UX call, not a mechanical one.
7. **Quick Actions pattern** — not designed or built at all; needs a concrete driving use case first.

None of the above blocks anything — they're independent, additive follow-ups whenever the business wants to invest in them.
