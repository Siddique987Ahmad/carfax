import { type Db, schema, withSystem } from '@carfax/db';
import { can, canInGarage, GARAGE_WRITES_WHILE_PENDING } from '@carfax/shared';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { TokenService } from '../auth/token.service';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';
import { ACCESS_RULE, type AccessRequest, type AccessRule } from './access.decorators';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Runs on every route (registered as APP_GUARD) and enforces its access rule (api/04). */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger('Access');

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AccessRequest>();
    const rule = this.reflector.getAllAndOverride<AccessRule | undefined>(ACCESS_RULE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule) {
      // A developer mistake: deny, and say so loudly.
      this.logger.error(
        `route has no access rule, so it's refused: ${req.method} ${req.route?.path ?? req.path}`,
      );
      throw new AppError('FORBIDDEN', 403, 'This route is not available');
    }
    if (rule.kind === 'public') return true;

    const header = req.headers.authorization;
    const bearer = typeof header === 'string' ? /^Bearer (\S+)$/.exec(header) : null;
    if (!bearer) throw new AppError('UNAUTHORIZED', 401, 'Sign in first', { reason: 'missing' });
    req.user = await this.tokens.verifyAccess(bearer[1]!);
    if (rule.kind === 'signedIn') return true;

    if (rule.kind === 'admin') {
      const fresh = await this.tokens.loadSessionUser(req.user.id, req.user.audience);
      if (!fresh.isActive) throw new AppError('FORBIDDEN', 403, 'This account is disabled');
      req.user.roles = fresh.roles;
      if (!can(fresh.roles as never, rule.permission)) {
        throw new AppError('FORBIDDEN', 403, 'Your role does not allow this');
      }
      return true;
    }

    // Garage routes: which garage, and is the caller still a member with the right role? Read from
    // the database, not the token, so a new garage or a removed mechanic counts at once.
    const userId = req.user.id;
    const memberships = await withSystem(this.db, (tx) =>
      tx
        .select({
          garageId: schema.garageMembers.garageId,
          role: schema.garageMembers.role,
          status: schema.garages.status,
          isActive: schema.users.isActive,
        })
        .from(schema.garageMembers)
        .innerJoin(schema.garages, eq(schema.garages.id, schema.garageMembers.garageId))
        .innerJoin(schema.users, eq(schema.users.id, schema.garageMembers.userId))
        .where(eq(schema.garageMembers.userId, userId)),
    );

    const requested = req.headers['x-garage-id'];
    let membership: (typeof memberships)[number] | undefined;
    if (typeof requested === 'string' && requested !== '') {
      if (!UUID.test(requested))
        throw new AppError('BAD_REQUEST', 400, 'X-Garage-Id is not a garage id');
      membership = memberships.find((m) => m.garageId === requested);
      if (!membership) throw new AppError('FORBIDDEN', 403, 'You are not a member of this garage');
    } else if (memberships.length === 1) {
      membership = memberships[0]!;
    } else if (memberships.length === 0) {
      throw new AppError('FORBIDDEN', 403, 'You are not a member of any garage');
    } else {
      throw new AppError('GARAGE_REQUIRED', 400, 'You are in several garages: send X-Garage-Id', {
        garages: memberships.map((m) => m.garageId),
      });
    }
    const garageId = membership.garageId;
    if (!membership.isActive) throw new AppError('FORBIDDEN', 403, 'This account is disabled');
    if (!canInGarage(membership.role, rule.permission)) {
      throw new AppError('FORBIDDEN', 403, 'Your role in this garage does not allow this');
    }
    if (WRITE_METHODS.has(req.method)) {
      if (membership.status === 'suspended') {
        throw new AppError(
          'GARAGE_SUSPENDED',
          403,
          'This garage is suspended: it can be viewed, not changed',
        );
      }
      if (
        membership.status === 'pending' &&
        !GARAGE_WRITES_WHILE_PENDING.includes(rule.permission)
      ) {
        throw new AppError('GARAGE_PENDING', 403, 'This garage is waiting for approval');
      }
    }
    req.garage = { garageId, role: membership.role, status: membership.status };
    return true;
  }
}
