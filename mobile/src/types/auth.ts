// All role strings that the API JWT may contain
export type UserRole =
  | 'admin'
  | 'ceo'
  | 'operations'
  | 'sales'
  | 'sales-staff'
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
  | 'vat-supervisor';

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

// Roles that are confined to a single workshop
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
];

// Roles that see all workshops (cross-workshop)
export const CROSS_WORKSHOP_ROLES: UserRole[] = [
  'admin',
  'ceo',
  'operations',
  'logistics',
  'logistics-officer',
  'sales',
  'sales-staff',
  'finance',
];
