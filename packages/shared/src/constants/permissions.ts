import type { AdminRole, GarageRole, PlatformRole } from './roles';

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

/**
 * What each role may do inside a garage (api/04, garage-app/14). The API checks these on every
 * garage route; the garage app reads them to hide what a role can't do.
 */
export const GARAGE_PERMISSIONS = {
  'garage.view': ['owner', 'mechanic'],
  'garage.edit': ['owner'],
  'staff.manage': ['owner'],
  'jobs.view': ['owner', 'mechanic'],
  'jobs.create': ['owner', 'mechanic'],
  /** Editing a job more than 24 hours after it was logged. */
  'jobs.edit_late': ['owner'],
  'bills.send': ['owner', 'mechanic'],
  'customers.view': ['owner', 'mechanic'],
  'customers.edit': ['owner', 'mechanic'],
  'customers.delete': ['owner'],
  'reminders.send': ['owner', 'mechanic'],
  /** Rupee totals and earnings. */
  'earnings.view': ['owner'],
} as const satisfies Record<string, readonly GarageRole[]>;

export type GaragePermission = keyof typeof GARAGE_PERMISSIONS;

/**
 * Writes a garage may still make while waiting for approval: the owner finishes the profile and
 * adds staff, but no jobs are accepted until ops approve it (admin/08).
 */
export const GARAGE_WRITES_WHILE_PENDING: readonly GaragePermission[] = [
  'garage.edit',
  'staff.manage',
];

/** True if the role inside the garage grants the permission. */
export function canInGarage(role: GarageRole, permission: GaragePermission): boolean {
  const allowed: readonly GarageRole[] = GARAGE_PERMISSIONS[permission];
  return allowed.includes(role);
}
