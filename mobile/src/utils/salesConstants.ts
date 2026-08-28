export const PAYMENT_TERMS = ['Cash', 'Net 7', 'Net 14', 'Net 30', 'Net 60', 'Custom'] as const;
export type PaymentTerm = typeof PAYMENT_TERMS[number];

// Nyanza Value-Added Production usability (ERP Enterprise Completion Phase 9)
// — was Timber/Poles only, so a QC-accepted manufactured product (pallets
// etc.) had no way to be sold: salesProductsForDropdown already returns
// every active product regardless of type, but this list gated which
// category a user could even select before that product ever became visible.
export const PRODUCT_TYPES    = ['Timber', 'Poles', 'Manufactured Product'] as const;
export const TIMBER_SUB_TYPES = ['Kiln-dried', 'CCA-treated', 'Untreated'] as const;
export const CURRENCIES        = ['RWF', 'USD', 'EUR', 'GBP'] as const;

// Returns ISO date string for net-day terms; null for Cash or Custom
export function computeDueDate(term: PaymentTerm): string | null {
  const NET: Partial<Record<PaymentTerm, number>> = {
    'Net 7': 7, 'Net 14': 14, 'Net 30': 30, 'Net 60': 60,
  };
  const days = NET[term];
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Status values that users can manually assign (from data.js salesUpdateStatus allowed list)
export const MANUAL_STATUSES = ['Pending', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'] as const;
