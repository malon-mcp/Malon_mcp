import { MalonError } from '../types.js';

export type Role = 'admin' | 'operator' | 'service' | 'user' | 'viewer';

export type Permission =
  | 'search'
  | 'memory_read'
  | 'memory_write'
  | 'checkpoint'
  | 'status'
  | 'manage_api_keys'
  | 'manage_users'
  | 'manage_sessions'
  | 'view_usage'
  | 'purge_data'
  | 'manage_mfa'
  | 'admin';

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  operator: 80,
  service: 60,
  user: 40,
  viewer: 10,
};

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    'search',
    'memory_read',
    'memory_write',
    'checkpoint',
    'status',
    'manage_api_keys',
    'manage_users',
    'manage_sessions',
    'view_usage',
    'purge_data',
    'manage_mfa',
    'admin',
  ],
  operator: [
    'search',
    'memory_read',
    'memory_write',
    'checkpoint',
    'status',
    'manage_api_keys',
    'view_usage',
    'manage_mfa',
  ],
  service: ['search', 'memory_read', 'memory_write', 'status'],
  user: ['search', 'memory_read', 'memory_write', 'checkpoint', 'status'],
  viewer: ['status'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function roleLevel(role: Role): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

export function isRoleAtLeast(role: Role, minimum: Role): boolean {
  return roleLevel(role) >= roleLevel(minimum);
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new MalonError(
      'config',
      `Role "${role}" does not have permission "${permission}"`,
      'Request a higher-privilege API key or session role.',
    );
  }
}

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function listRoles(): Role[] {
  return Object.keys(ROLE_HIERARCHY) as Role[];
}
