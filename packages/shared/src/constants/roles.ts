/**
 * Platform-wide roles, stored in user_roles (db/02). One person can hold several.
 * `admin` is shown as "Super admin" in the admin panel.
 */
export const PLATFORM_ROLES = ['buyer', 'dealer', 'car_owner', 'admin', 'ops', 'support'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** Roles inside one garage, stored in garage_members (db/03). */
export const GARAGE_ROLES = ['owner', 'mechanic'] as const;
export type GarageRole = (typeof GARAGE_ROLES)[number];

/** Team roles allowed into the admin panel. */
export const ADMIN_ROLES = ['admin', 'ops', 'support'] as const satisfies readonly PlatformRole[];
export type AdminRole = (typeof ADMIN_ROLES)[number];
