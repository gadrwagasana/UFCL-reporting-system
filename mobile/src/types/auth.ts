// All role strings that the API JWT may contain
export type UserRole =
  | 'admin'
  | 'ceo'
  | 'operations'
  | 'sales'
  | 'sales-staff'
  | 'showroom-staff'
  | 'finance'
  | 'logistics'
  | 'logistics-officer'
  | 'supervisor'
  | 'storekeeper'
  | 'storekeeper-assistant'
  | 'mechanician'
  | 'harvesting-leader'
  | 'sawmill-leader'
  | 'poles-leader'
  | 'vat-leader'
  | 'harvesting-supervisor'
  | 'sawmill-supervisor'
  | 'poles-supervisor'
  | 'vat-supervisor'
  | 'procurement-officer'
  | 'procurement-manager'
  | 'department-manager';

// Shape returned by GET /api/auth/me and POST /api/auth/login
export interface User {
  id:           string | number;
  name:         string;
  role:         UserRole;
  workshopId:   number | null;
  workshopName: string | null;
  active?:      boolean;
}

// JWT payload decoded by the server; echoed back in login response
export interface JWTClaims {
  userId:     string | number;
  role:       UserRole;
  workshopId: number | null;
  iat:        number;
  exp:        number;
}

// Login request body
export interface LoginRequest {
  username: string;
  password: string;
}

// Login response body
export interface LoginResponse {
  ok:    true;
  token: string;
  user:  User;
}

// Roles that are confined to a single workshop.
// Mirrors Desktop's renderer/app.js isCrossWorkshop() — every role not listed
// there is workshop-restricted. 'logistics-officer' is intentionally absent:
// on Desktop it is cross-workshop only when the user has no workshop_id, so
// it cannot be classified statically — see isCrossWorkshop() below.
export const WORKSHOP_RESTRICTED_ROLES: UserRole[] = [
  'supervisor',
  'storekeeper',
  'storekeeper-assistant',
  'mechanician',
  'harvesting-leader',
  'sawmill-leader',
  'poles-leader',
  'vat-leader',
  'harvesting-supervisor',
  'sawmill-supervisor',
  'poles-supervisor',
  'vat-supervisor',
  'sales-staff',
  'showroom-staff',
  'finance',
];

// Roles that always see all workshops, regardless of the user's workshop_id.
// Mirrors Desktop's renderer/app.js isCrossWorkshop(). 'logistics-officer' is
// excluded here because it is conditional — use isCrossWorkshop() instead.
export const CROSS_WORKSHOP_ROLES: UserRole[] = [
  'admin',
  'ceo',
  'operations',
  'logistics',
  'sales',
];

// Mirrors Desktop's renderer/app.js isCrossWorkshop() exactly: most roles are
// statically classified, but 'logistics-officer' is cross-workshop only when
// the user has no workshop assigned.
export function isCrossWorkshop(role: UserRole, workshopId: number | null): boolean {
  if (CROSS_WORKSHOP_ROLES.includes(role)) return true;
  if (role === 'logistics-officer' && !workshopId) return true;
  return false;
}
