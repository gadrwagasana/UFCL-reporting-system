export const WORKSHOP_TYPES = [
  'Sawmill Workshop',
  'Logging Equipment Workshop',
  'Vehicle Workshop',
  'Pole Treatment Workshop',
  'Electrical Workshop',
  'Central Warehouse',
] as const;

export type WorkshopType = typeof WORKSHOP_TYPES[number];
