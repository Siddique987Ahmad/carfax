import type {
  AdminPermission as AdminPermissionName,
  GaragePermission as GaragePermissionName,
} from '@carfax/shared';
import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/token.service';
import { AppError } from '../errors/app-error';

/**
 * Every route declares exactly one access rule (api/04). A route without one is refused by the
 * AccessGuard and fails the route-coverage test: access is denied by default.
 */
export type AccessRule =
  | { kind: 'public' }
  | { kind: 'signedIn' }
  | { kind: 'garage'; permission: GaragePermissionName }
  | { kind: 'admin'; permission: AdminPermissionName };

export const ACCESS_RULE = 'carfax:access-rule';

/** Anyone, signed in or not. */
export const Public = () => SetMetadata(ACCESS_RULE, { kind: 'public' } satisfies AccessRule);

/** Any signed-in user. */
export const SignedIn = () =>
  applyDecorators(
    SetMetadata(ACCESS_RULE, { kind: 'signedIn' } satisfies AccessRule),
    ApiBearerAuth(),
  );

/**
 * A member of the garage whose role allows the permission (GARAGE_PERMISSIONS). The garage comes
 * from the X-Garage-Id header, or is the caller's only garage. Membership is read fresh from the
 * database, so removing a mechanic takes effect at once. Suspended garages can't write; pending
 * garages can only finish their setup.
 */
export const GaragePermission = (permission: GaragePermissionName) =>
  applyDecorators(
    SetMetadata(ACCESS_RULE, { kind: 'garage', permission } satisfies AccessRule),
    ApiBearerAuth(),
    ApiHeader({
      name: 'X-Garage-Id',
      required: false,
      description: 'Needed when you belong to several garages',
    }),
  );

/** A team member whose platform roles allow the permission (ADMIN_PERMISSIONS, admin/06). Read fresh. */
export const AdminPermission = (permission: AdminPermissionName) =>
  applyDecorators(
    SetMetadata(ACCESS_RULE, { kind: 'admin', permission } satisfies AccessRule),
    ApiBearerAuth(),
  );

export interface GarageContext {
  garageId: string;
  role: 'owner' | 'mechanic';
  status: 'pending' | 'active' | 'suspended';
}

export type AccessRequest = Request & { user?: SessionUser; garage?: GarageContext };

/** The signed-in user (any route that isn't @Public). */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): SessionUser => {
    const user = context.switchToHttp().getRequest<AccessRequest>().user;
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'Sign in first');
    return user;
  },
);

/** The garage this request acts for, with the caller's role in it (@GaragePermission routes). */
export const CurrentGarage = createParamDecorator(
  (_: unknown, context: ExecutionContext): GarageContext => {
    const garage = context.switchToHttp().getRequest<AccessRequest>().garage;
    if (!garage) throw new AppError('FORBIDDEN', 403, 'This route has no garage');
    return garage;
  },
);
