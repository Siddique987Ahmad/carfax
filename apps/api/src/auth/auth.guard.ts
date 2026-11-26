import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../errors/app-error';
import { type SessionUser, TokenService } from './token.service';

type AuthedRequest = Request & { user?: SessionUser };

/**
 * Requires a valid access token (`Authorization: Bearer …`) and puts the signed-in user on the
 * request. Role and garage checks build on this in api/04.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer (\S+)$/.exec(header) : null;
    if (!match) throw new AppError('UNAUTHORIZED', 401, 'Sign in first', { reason: 'missing' });
    req.user = await this.tokens.verifyAccess(match[1]!);
    return true;
  }
}

/** The signed-in user, in a route behind AuthGuard: `me(@CurrentUser() user: SessionUser)`. */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): SessionUser => {
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'Sign in first');
    return user;
  },
);
