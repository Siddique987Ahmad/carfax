import type { AdminRole, PlatformRole } from './roles';

/**
 * Admin panel permissions (admin/06). The API guards and the admin UI both read this map:
 * the UI hides what a role can't do, and the API still refuses it.
 */
export const ADMIN_PERMISSIONS = {
  'garages.view': ['admin', 'ops', 'support'],
  'garages.manage': ['admin', 'ops'],
  'jobs.view': ['admin', 'ops', 'support'],
  'jobs.review': ['admin', 'ops'],
  'cars.view': ['admin', 'ops', 'support'],
  'cars.edit': ['admin', 'ops'],
  'disputes.manage': ['admin', 'ops', 'support'],
  'orders.view': ['admin', 'ops', 'support'],
  'orders.refund': ['admin'],
  'dealers.manage': ['admin'],
  'team.manage': ['admin'],
  'audit.view': ['admin'],
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

/** True if any of the user's roles grants the permission. */
export function can(roles: readonly PlatformRole[], permission: AdminPermission): boolean {
  const allowed: readonly PlatformRole[] = ADMIN_PERMISSIONS[permission];
  return roles.some((role) => allowed.includes(role));
}
