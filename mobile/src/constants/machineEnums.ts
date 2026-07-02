export const MACHINE_STATUS    = ['Available', 'Running', 'Maintenance', 'Breakdown'] as const;
export const MACHINE_FUEL_TYPE = ['Diesel', 'Petroleum/Essence', 'DAT', 'Petrol', 'Chain Oil', 'Engine Oil'] as const;

export type MachineStatus   = typeof MACHINE_STATUS[number];
export type MachineFuelType = typeof MACHINE_FUEL_TYPE[number];
