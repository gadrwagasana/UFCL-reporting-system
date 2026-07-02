export const PAYMENT_TERMS = ['Cash', 'Net 7', 'Net 14', 'Net 30', 'Net 60', 'Custom'] as const;
export type PaymentTerm = typeof PAYMENT_TERMS[number];

export const PRODUCT_TYPES    = ['Timber', 'Poles'] as const;
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
