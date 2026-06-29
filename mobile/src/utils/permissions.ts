import { UserRole } from '../types/auth';

// What each role can do on mobile — READ is always granted to the role's own data.
// WRITE permissions must be explicitly listed.

export type Permission =
  | 'harvest.write'
  | 'logtransport.write'
  | 'sawmill.write'
  | 'poles.write'
  | 'poles.purchase'
  | 'poles.delivery'
  | 'poles.qc'
  | 'vat.write'
  | 'material.request'
  | 'material.review'
  | 'labour.write'
  | 'labour.review'
  | 'machine.log'
  | 'fuel.vehicle'
  | 'fuel.machine'
  | 'delivery.update'
  | 'ceo.approve'
  | 'monthly.approve';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin:                  ['ceo.approve', 'monthly.approve', 'material.review', 'labour.review', 'delivery.update'],
  ceo:                    ['ceo.approve', 'monthly.approve'],
  operations:             ['material.review', 'labour.review'],
  sales:                  ['delivery.update'],
  'sales-staff':          ['delivery.update'],
  finance:                [],
  logistics:              ['delivery.update', 'fuel.vehicle'],
  'logistics-officer':    ['delivery.update'],
  supervisor:             ['material.request', 'labour.write'],
  storekeeper:            ['material.review'],
  'storekeeper-assistant':['material.request'],
  mechanician:            ['machine.log', 'fuel.machine'],
  'harvesting-leader':    ['harvest.write', 'logtransport.write', 'material.request', 'labour.write'],
  'sawmill-leader':       ['sawmill.write', 'material.request', 'labour.write'],
  'poles-leader':         ['poles.write', 'poles.purchase', 'poles.delivery', 'poles.qc', 'material.request', 'labour.write'],
  'vat-leader':           ['vat.write', 'material.request', 'labour.write'],
  'harvesting-supervisor': ['harvest.write', 'logtransport.write'],
  'sawmill-supervisor':    ['sawmill.write'],
  'poles-supervisor':      ['poles.write', 'poles.delivery'],
  'vat-supervisor':        ['vat.write'],
};

export function hasPermission(role: UserRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// Which nav groups this role sees on the bottom tab bar
export type NavGroup =
  | 'ceo-overview'
  | 'harvest'
  | 'sawmill'
  | 'poles'
  | 'logistics'
  | 'sales'
  | 'operations'
  | 'workshop'
  | 'machines'
  | 'my-requests';

export const ROLE_NAV_GROUPS: Record<UserRole, NavGroup[]> = {
  admin:                  ['ceo-overview', 'operations', 'my-requests'],
  ceo:                    ['ceo-overview', 'my-requests'],
  operations:             ['operations', 'my-requests'],
  sales:                  ['sales', 'my-requests'],
  'sales-staff':          ['sales', 'my-requests'],
  finance:                ['my-requests'],
  logistics:              ['logistics', 'my-requests'],
  'logistics-officer':    ['logistics', 'my-requests'],
  supervisor:             ['workshop', 'machines', 'my-requests'],
  storekeeper:            ['workshop', 'my-requests'],
  'storekeeper-assistant':['workshop', 'my-requests'],
  mechanician:            ['machines', 'my-requests'],
  'harvesting-leader':     ['harvest', 'my-requests'],
  'sawmill-leader':        ['sawmill', 'my-requests'],
  'poles-leader':          ['poles', 'my-requests'],
  'vat-leader':            ['my-requests'],
  'harvesting-supervisor': ['harvest'],
  'sawmill-supervisor':    ['sawmill'],
  'poles-supervisor':      ['poles'],
  'vat-supervisor':        [],
};
